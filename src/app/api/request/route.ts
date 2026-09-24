import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { sendDiscordNotification } from "@/lib/discord";
import { fetchKomgaBookNumbers, findKomgaSeries } from "@/lib/komga";
import { findMediaLibrarySeries, OPEN_REQUEST_STATUSES, refreshMediaStatus, upsertMedia } from "@/lib/media";
import { libraryStatus } from "@/lib/library";
import { getQuotaStatus, quotaError, requestWeight } from "@/lib/quota";
import type { RequestPayload } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Verify authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vous devez être connecté pour faire une demande." },
      { status: 401 }
    );
  }

  try {
    const body: RequestPayload = await request.json();
    const { mediaType, externalId, title, coverUrl, year, publisher, author } = body;
    const volumes = body.volumes?.length ? [...new Set(body.volumes)].sort((a, b) => a - b) : undefined;

    // Validation
    if (!mediaType || !externalId || !title) {
      return NextResponse.json(
        { error: "mediaType, externalId, and title are required." },
        { status: 400 }
      );
    }

    // Quota de tomes sur la période glissante (les admins n'en ont pas)
    const quotaMessage = quotaError(await getQuotaStatus(user), requestWeight(volumes));
    if (quotaMessage) {
      return NextResponse.json({ error: quotaMessage }, { status: 403 });
    }

    const media = await upsertMedia(body);

    // Une seule demande en cours par utilisateur et par œuvre : on modifie la demande existante
    const ownOpenRequest = await prisma.request.findFirst({
      where: { mediaId: media.id, userId: user.id, status: { in: OPEN_REQUEST_STATUSES } },
    });
    if (ownOpenRequest) {
      return NextResponse.json(
        { error: "Vous avez déjà une demande en cours pour cette œuvre : modifiez-la depuis « Mes demandes »." },
        { status: 409 }
      );
    }

    // Rien à demander si tout est déjà dans la bibliothèque
    const series = await findMediaLibrarySeries(media);
    if (series) {
      const bookNumbers = volumes ? await fetchKomgaBookNumbers(series.id) : null;
      const alreadyOwned = volumes
        ? bookNumbers !== null && volumes.every((v) => bookNumbers.includes(v))
        : libraryStatus(series, media.volumeCount).status === "available";
      if (alreadyOwned) {
        return NextResponse.json(
          { error: volumes ? "Ces tomes sont déjà disponibles dans la bibliothèque." : "Cette œuvre est déjà disponible dans la bibliothèque." },
          { status: 409 }
        );
      }
    }

    // Détection de doublons pour l'admin : demandes existantes sur la même œuvre + présence dans Komga
    const [previousRequests, komgaMatches] = await Promise.all([
      prisma.request.findMany({
        where: { mediaId: media.id },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      findKomgaSeries(title),
    ]);

    // Create request record in DB
    const dbRequest = await prisma.request.create({
      data: {
        userId: user.id,
        mediaId: media.id,
        mediaType,
        externalId,
        title,
        coverUrl: coverUrl || null,
        volumes: volumes ? JSON.stringify(volumes) : null,
        status: "pending",
      },
    });
    await refreshMediaStatus(media.id);

    // Notification Discord pour l'admin
    await sendDiscordNotification({
      title,
      mediaType,
      externalId,
      coverUrl,
      volumes,
      year,
      publisher,
      author,
      userName: user.name || user.email,
      previousRequests: previousRequests.map((req) => ({
        userName: req.user.name || req.user.email,
        status: req.status,
        createdAt: req.createdAt,
      })),
      komgaMatches,
    });

    return NextResponse.json({
      success: true,
      message: "Demande ajoutée à la liste de souhaits.",
      requestId: dbRequest.id,
    });
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

const HISTORY_PAGE_SIZE = 25;
const HISTORY_STATUSES = ["pending", "approved", "declined", "available"];

// GET : historique paginé de l'utilisateur (?page=N, ?status=…, ?q=titre)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const status = params.get("status");
  const q = params.get("q")?.trim();

  const where = {
    userId: user.id,
    ...(status && HISTORY_STATUSES.includes(status) && { status }),
    // SQLite : `contains` est insensible à la casse pour les lettres ASCII
    ...(q && { title: { contains: q } }),
  };

  try {
    const [requests, total, grouped] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * HISTORY_PAGE_SIZE,
        take: HISTORY_PAGE_SIZE,
      }),
      prisma.request.count({ where }),
      prisma.request.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    ]);

    const counts = Object.fromEntries(HISTORY_STATUSES.map((s) => [s, 0]));
    for (const g of grouped) counts[g.status] = g._count;

    return NextResponse.json({ requests, total, counts, page, pageSize: HISTORY_PAGE_SIZE });
  } catch (error) {
    console.error("Request history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch request history." },
      { status: 500 }
    );
  }
}

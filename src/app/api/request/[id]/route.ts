import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDiscordRequestChangeNotification } from "@/lib/discord";
import { refreshMediaStatus } from "@/lib/media";
import { parseJsonArray } from "@/lib/titles";
import type { MediaType } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

/** Seules les demandes pas encore traitées par l'admin peuvent être modifiées ou retirées. */
const EDITABLE_STATUSES = new Set(["pending"]);

/**
 * Récupère une demande appartenant à l'utilisateur connecté et encore modifiable.
 * Renvoie soit la demande, soit la réponse d'erreur à retourner telle quelle.
 */
async function getEditableRequest(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }

  const existing = await prisma.request.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "Demande introuvable." }, { status: 404 }) };
  }

  if (!EDITABLE_STATUSES.has(existing.status)) {
    return {
      error: NextResponse.json(
        { error: "Cette demande a déjà été traitée et ne peut plus être modifiée." },
        { status: 409 }
      ),
    };
  }

  return { request: existing, userName: session.user.name || session.user.email };
}

// PATCH : modifier les tomes demandés
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = await getEditableRequest(id);
  if (result.error) return result.error;
  const existing = result.request;

  try {
    const body: { volumes?: unknown } = await request.json();
    const volumes = body.volumes;

    if (
      !Array.isArray(volumes) ||
      volumes.length === 0 ||
      !volumes.every((v) => Number.isInteger(v) && v > 0)
    ) {
      return NextResponse.json(
        { error: "Sélectionnez au moins un tome." },
        { status: 400 }
      );
    }

    const sortedVolumes = [...new Set(volumes as number[])].sort((a, b) => a - b);

    const updated = await prisma.request.update({
      where: { id },
      data: { volumes: JSON.stringify(sortedVolumes) },
    });

    await sendDiscordRequestChangeNotification({
      action: "updated",
      title: existing.title,
      mediaType: existing.mediaType as MediaType,
      coverUrl: existing.coverUrl,
      previousVolumes: parseJsonArray<number>(existing.volumes),
      volumes: sortedVolumes,
      userName: result.userName,
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error("Request update error:", error);
    return NextResponse.json(
      { success: false, error: "Impossible de modifier la demande." },
      { status: 500 }
    );
  }
}

// DELETE : retirer la demande
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = await getEditableRequest(id);
  if (result.error) return result.error;
  const existing = result.request;

  try {
    await prisma.request.delete({ where: { id } });
    await refreshMediaStatus(existing.mediaId);

    await sendDiscordRequestChangeNotification({
      action: "cancelled",
      title: existing.title,
      mediaType: existing.mediaType as MediaType,
      coverUrl: existing.coverUrl,
      previousVolumes: parseJsonArray<number>(existing.volumes),
      userName: result.userName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Request delete error:", error);
    return NextResponse.json(
      { success: false, error: "Impossible de retirer la demande." },
      { status: 500 }
    );
  }
}

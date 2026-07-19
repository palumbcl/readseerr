import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RequestPayload } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Vous devez être connecté pour faire une demande." },
      { status: 401 }
    );
  }

  try {
    const body: RequestPayload = await request.json();
    const { mediaType, externalId, title, coverUrl, volumes } = body;

    // Validation
    if (!mediaType || !externalId || !title) {
      return NextResponse.json(
        { error: "mediaType, externalId, and title are required." },
        { status: 400 }
      );
    }

    // Create request record in DB
    const dbRequest = await prisma.request.create({
      data: {
        userId: session.user.id,
        mediaType,
        externalId,
        title,
        coverUrl: coverUrl || null,
        volumes: volumes ? JSON.stringify(volumes) : null,
        status: "pending",
        targetService: "manual",
      },
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

// GET: Fetch request history for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const requests = await prisma.request.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Request history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch request history." },
      { status: 500 }
    );
  }
}

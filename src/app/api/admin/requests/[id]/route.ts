import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { markRequestsAvailable, refreshMediaStatus } from "@/lib/media";
import { sendRequestStatusEmail } from "@/lib/notifications";

type RouteContext = { params: Promise<{ id: string }> };

type AdminAction = "approve" | "decline" | "available" | "pending";
const ACTIONS: AdminAction[] = ["approve", "decline", "available", "pending"];

// PATCH : accepter, refuser (avec motif), marquer disponible ou remettre en attente
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  try {
    const body: { action?: AdminAction; reason?: string } = await request.json();
    const action = body.action;
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    const existing = await prisma.request.findUnique({ where: { id }, include: { user: true, media: true } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    if (action === "available") {
      // Notifie le demandeur (email) et Discord, comme un ajout détecté dans Komga
      await markRequestsAvailable({
        media: existing.media,
        requests: [existing],
        seriesName: existing.media.title,
        handledById: admin.id,
      });
    } else {
      const reason = action === "decline" ? body.reason?.trim().slice(0, 500) || null : null;
      await prisma.request.update({
        where: { id },
        data: {
          status: action === "approve" ? "approved" : action === "decline" ? "declined" : "pending",
          declineReason: reason,
          handledById: action === "pending" ? null : admin.id,
          handledAt: action === "pending" ? null : new Date(),
        },
      });
      await refreshMediaStatus(existing.mediaId);

      if (action === "approve" || action === "decline") {
        await sendRequestStatusEmail({
          kind: action === "approve" ? "approved" : "declined",
          user: existing.user,
          title: existing.title,
          coverUrl: existing.coverUrl,
          reason,
        });
      }
    }

    const updated = await prisma.request.findUnique({ where: { id } });
    return NextResponse.json({ success: true, request: updated });
  } catch (err) {
    console.error("Admin request update error:", err);
    return NextResponse.json({ error: "Impossible de modifier la demande." }, { status: 500 });
  }
}

// DELETE : supprimer définitivement une demande (doublon, erreur…)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  try {
    const existing = await prisma.request.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    await prisma.request.delete({ where: { id } });
    await refreshMediaStatus(existing.mediaId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin request delete error:", err);
    return NextResponse.json({ error: "Impossible de supprimer la demande." }, { status: 500 });
  }
}

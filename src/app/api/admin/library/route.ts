import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { getLibrarySyncState, syncLibrary } from "@/lib/media";

async function getLibraryInfo() {
  const [seriesCount, lastRow] = await Promise.all([
    prisma.librarySeries.count(),
    prisma.librarySeries.findFirst({ select: { syncedAt: true }, orderBy: { syncedAt: "desc" } }),
  ]);
  const state = getLibrarySyncState();
  return {
    ...state,
    // Après un redémarrage l'état en mémoire est vide : la base garde la trace de la dernière synchro
    lastSyncAt: state.lastSyncAt ?? lastRow?.syncedAt.toISOString() ?? null,
    seriesCount,
  };
}

// GET : état de la synchronisation Komga
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await getLibraryInfo());
}

// POST : synchroniser maintenant
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  await syncLibrary();
  return NextResponse.json(await getLibraryInfo());
}

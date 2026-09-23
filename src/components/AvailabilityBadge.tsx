"use client";

import type { Availability } from "@/lib/types";

const LABELS: Record<Availability["status"], string> = {
  available: "Disponible",
  partially_available: "Partiel",
  processing: "En cours",
  pending: "Demandé",
};

interface AvailabilityBadgeProps {
  availability: Availability;
  /** Nombre total de tomes, pour afficher "12 / 20" quand la série est incomplète */
  volumeCount?: number | null;
  inline?: boolean;
}

export default function AvailabilityBadge({ availability, volumeCount, inline = false }: AvailabilityBadgeProps) {
  const { status, booksInLibrary } = availability;
  const detail =
    status === "partially_available" && booksInLibrary !== undefined && volumeCount
      ? ` · ${booksInLibrary}/${volumeCount}`
      : "";

  return (
    <span className={`availability-badge ${status.replace("_", "-")}${inline ? " inline" : ""}`}>
      {LABELS[status]}
      {detail}
    </span>
  );
}

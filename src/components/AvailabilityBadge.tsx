"use client";

import type { Availability } from "@/lib/types";
import { CheckIcon, ClockIcon, MinusIcon } from "./Icons";

const LABELS: Record<Availability["status"], string> = {
  available: "Disponible",
  partially_available: "Partiellement disponible",
  processing: "En cours",
  pending: "Demandé",
};

interface AvailabilityBadgeProps {
  availability: Availability;
  /** Nombre total de tomes, pour afficher "12 / 20" quand la série est incomplète */
  volumeCount?: number | null;
  /** Pastille avec libellé (fiche) plutôt que pastille ronde (carte) */
  inline?: boolean;
}

export default function AvailabilityBadge({ availability, volumeCount, inline = false }: AvailabilityBadgeProps) {
  const { status, booksInLibrary } = availability;
  const detail =
    status === "partially_available" && booksInLibrary !== undefined && volumeCount
      ? ` · ${booksInLibrary}/${volumeCount}`
      : "";
  const label = `${LABELS[status]}${detail}`;
  const className = status.replace("_", "-");

  if (inline) {
    return <span className={`status-pill ${className}`}>{label}</span>;
  }

  const Icon = status === "available" ? CheckIcon : status === "partially_available" ? MinusIcon : ClockIcon;
  return (
    <span className={`availability-dot ${className}`} title={label} aria-label={label}>
      <Icon size={14} strokeWidth={3} />
    </span>
  );
}

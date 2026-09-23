"use client";

interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  approved: "Acceptée",
  declined: "Refusée",
  available: "Disponible",
};

const statusIcons: Record<string, string> = {
  pending: "◷",
  approved: "→",
  declined: "✕",
  available: "●",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      <span>{statusIcons[status] ?? "•"}</span>
      {statusLabels[status] || status}
    </span>
  );
}

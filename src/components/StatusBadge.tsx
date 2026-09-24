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

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge ${status}`}>{statusLabels[status] || status}</span>;
}

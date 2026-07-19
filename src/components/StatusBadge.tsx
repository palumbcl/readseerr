"use client";

interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  pending: "En attente d'ajout",
  sent: "Envoyée",
  success: "Disponible",
  error: "Erreur",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = statusLabels[status] || status;
  const dotClass = status === "success" ? "●" : status === "error" ? "✕" : status === "pending" ? "◷" : "→";

  return (
    <span className={`status-badge ${status}`}>
      <span>{dotClass}</span>
      {label}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import LoadingSpinner from "./LoadingSpinner";
import type { RequestRecord } from "@/lib/types";

export default function RequestHistory() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/request");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch {
      console.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">Aucune demande</div>
        <p>Vous n&apos;avez pas encore fait de demande. Recherchez un manga, comic ou BD pour commencer !</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    manga: "🇯🇵 Manga",
    comic: "🇺🇸 Comic",
    bd: "🇫🇷 BD",
  };

  return (
    <div className="requests-table-wrapper">
      <table className="requests-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Type</th>
            <th>Service</th>
            <th>Tomes</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>
                <div className="request-title-cell">
                  {req.coverUrl && (
                    <img
                      className="request-cover-thumb"
                      src={req.coverUrl}
                      alt=""
                    />
                  )}
                  <span>{req.title}</span>
                </div>
              </td>
              <td>{typeLabels[req.mediaType] || req.mediaType}</td>
              <td style={{ textTransform: "capitalize" }}>{req.targetService}</td>
              <td>
                {req.volumes
                  ? JSON.parse(req.volumes).join(", ")
                  : "Tous"}
              </td>
              <td>
                <StatusBadge status={req.status} />
              </td>
              <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {new Date(req.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

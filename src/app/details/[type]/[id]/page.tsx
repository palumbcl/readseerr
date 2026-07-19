"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MediaDetails from "@/components/MediaDetails";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { MediaDetail } from "@/lib/types";

export default function DetailsPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/details?id=${encodeURIComponent(id)}&type=${type}`);
        const data = await response.json();

        if (response.ok) {
          setDetail(data.detail);
        } else {
          setError(data.error || "Erreur lors du chargement.");
        }
      } catch {
        setError("Erreur réseau.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, type]);

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-content">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">😕</div>
            <div className="empty-state-title">Erreur</div>
            <p>{error || "Œuvre introuvable."}</p>
          </div>
        </div>
      </div>
    );
  }

  return <MediaDetails detail={detail} />;
}

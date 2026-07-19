"use client";

import { useState } from "react";
import type { VolumeInfo } from "@/lib/types";

interface VolumeSelectorProps {
  volumes: VolumeInfo[];
  onConfirm: (selectedVolumes: number[]) => void;
  onClose: () => void;
}

export default function VolumeSelector({ volumes, onConfirm, onClose }: VolumeSelectorProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const allSelected = selected.size === volumes.length;

  const toggleVolume = (num: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(volumes.map((v) => v.number)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Sélectionner les tomes</h3>

        {/* Select all */}
        <div
          className={`modal-volume-item ${allSelected ? "selected" : ""}`}
          onClick={toggleAll}
          style={{ marginBottom: 12 }}
        >
          <div className="modal-volume-checkbox">{allSelected && "✓"}</div>
          <span style={{ fontWeight: 600 }}>Tous les tomes ({volumes.length})</span>
        </div>

        <div className="modal-volume-list">
          {volumes.map((vol) => (
            <div
              key={vol.number}
              className={`modal-volume-item ${selected.has(vol.number) ? "selected" : ""}`}
              onClick={() => toggleVolume(vol.number)}
            >
              <div className="modal-volume-checkbox">
                {selected.has(vol.number) && "✓"}
              </div>
              <span>
                Tome {vol.number}
                {vol.title && ` — ${vol.title}`}
              </span>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            Demander {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

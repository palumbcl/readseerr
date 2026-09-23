"use client";

import { useState } from "react";
import type { VolumeInfo } from "@/lib/types";

interface VolumeSelectorProps {
  volumes: VolumeInfo[];
  onConfirm: (selectedVolumes: number[]) => void;
  onClose: () => void;
  /** Tomes pré-cochés (modification d'une demande existante). */
  initialSelected?: number[];
  /** Tomes déjà présents dans la bibliothèque : affichés mais non sélectionnables. */
  ownedVolumes?: number[] | null;
  /** Nombre maximum de tomes sélectionnables (quota restant), illimité si absent */
  maxSelectable?: number | null;
  confirmLabel?: string;
}

export default function VolumeSelector({
  volumes,
  onConfirm,
  onClose,
  initialSelected,
  ownedVolumes,
  maxSelectable = null,
  confirmLabel = "Demander",
}: VolumeSelectorProps) {
  const owned = new Set(ownedVolumes ?? []);
  const selectable = volumes.filter((v) => !owned.has(v.number));
  const [selected, setSelected] = useState<Set<number>>(
    new Set((initialSelected ?? []).filter((n) => !owned.has(n)))
  );
  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const overQuota = maxSelectable !== null && selected.size > maxSelectable;

  const toggleVolume = (num: number) => {
    if (owned.has(num)) return;
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
      setSelected(new Set(selectable.map((v) => v.number)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Sélectionner les tomes</h3>
        {owned.size > 0 && (
          <p className="modal-hint">
            {owned.size} tome{owned.size > 1 ? "s sont" : " est"} déjà dans la bibliothèque.
          </p>
        )}
        {maxSelectable !== null && (
          <p className={`modal-hint ${overQuota ? "over-quota" : ""}`}>
            Quota : vous pouvez demander encore {maxSelectable} tome{maxSelectable > 1 ? "s" : ""}
            {overQuota ? ` (${selected.size} sélectionnés)` : ""}.
          </p>
        )}

        {/* Select all */}
        <div
          className={`modal-volume-item ${allSelected ? "selected" : ""}`}
          onClick={toggleAll}
          style={{ marginBottom: 12 }}
        >
          <div className="modal-volume-checkbox">{allSelected && "✓"}</div>
          <span style={{ fontWeight: 600 }}>
            {owned.size > 0 ? `Tous les tomes manquants (${selectable.length})` : `Tous les tomes (${volumes.length})`}
          </span>
        </div>

        <div className="modal-volume-list">
          {volumes.map((vol) => {
            const isOwned = owned.has(vol.number);
            return (
              <div
                key={vol.number}
                className={`modal-volume-item ${selected.has(vol.number) ? "selected" : ""} ${isOwned ? "owned" : ""}`}
                onClick={() => toggleVolume(vol.number)}
                aria-disabled={isOwned}
              >
                <div className="modal-volume-checkbox">
                  {selected.has(vol.number) && "✓"}
                </div>
                <span>
                  Tome {vol.number}
                  {vol.title && ` — ${vol.title}`}
                </span>
                {isOwned && <span className="modal-volume-owned-tag">Dans la bibliothèque</span>}
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selected.size === 0 || overQuota}
          >
            {confirmLabel} {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MediaType } from "@/lib/types";

interface SearchBarProps {
  defaultQuery?: string;
  defaultType?: MediaType;
  compact?: boolean;
}

export default function SearchBar({ defaultQuery = "", defaultType = "manga", compact = false }: SearchBarProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [type, setType] = useState<MediaType>(defaultType);
  const router = useRouter();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim().length < 2) return;
      router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${type}`);
    },
    [query, type, router]
  );

  const types: { value: MediaType; label: string; emoji: string }[] = [
    { value: "manga", label: "Manga", emoji: "🇯🇵" },
    { value: "comic", label: "Comic", emoji: "🇺🇸" },
    { value: "bd", label: "BD", emoji: "🇫🇷" },
  ];

  return (
    <div className="search-container">
      <form onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={compact ? "Rechercher..." : "Rechercher un manga, comic ou BD..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={!compact}
          />
        </div>
      </form>

      <div className="search-tabs">
        {types.map((t) => (
          <button
            key={t.value}
            className={`search-tab ${type === t.value ? "active" : ""}`}
            onClick={() => setType(t.value)}
            type="button"
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

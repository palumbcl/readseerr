"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MediaResult } from "@/lib/types";

interface SearchBarProps {
  defaultQuery?: string;
  compact?: boolean;
}

const MEDIA_TYPES = ["manga", "comic", "bd"] as const;
const SUGGESTIONS_PER_SOURCE = 6;

const TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  manga: { emoji: "🇯🇵", label: "Manga" },
  comic: { emoji: "🇺🇸", label: "Comic" },
  bd: { emoji: "🇫🇷", label: "BD" },
};

export default function SearchBar({ defaultQuery = "", compact = false }: SearchBarProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<MediaResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search for autocomplete
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Cancel any in-flight requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setShowDropdown(true);

    try {
      // Fire 3 parallel per-source requests for speed
      const fetches = MEDIA_TYPES.map((type) =>
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&type=${type}`, { signal })
          .then((res) => (res.ok ? res.json() : { results: [] }))
          .then((data) => ((data.results || []) as MediaResult[]).slice(0, SUGGESTIONS_PER_SOURCE))
          .catch(() => [] as MediaResult[])
      );

      // As each resolves, merge results progressively
      const allResults: MediaResult[] = [];
      const promises = fetches.map(async (p) => {
        const results = await p;
        allResults.push(...results);
        if (!signal.aborted) {
          setSuggestions([...allResults]);
        }
      });

      await Promise.allSettled(promises);

      if (!signal.aborted) {
        setSuggestions([...allResults]);
        setLoading(false);
      }
    } catch {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    },
    [fetchSuggestions]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim().length < 2) return;
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    [query, router]
  );

  const handleSelect = useCallback(
    (media: MediaResult) => {
      setShowDropdown(false);
      router.push(`/details/${media.type}/${media.id}`);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
        setActiveIndex(-1);
        return;
      }

      if (!showDropdown || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            handleSelect(suggestions[activeIndex]);
          }
          // If activeIndex is -1 (no selection), let the form submit naturally
          break;
      }
    },
    [showDropdown, suggestions, activeIndex, handleSelect]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className="search-container" ref={containerRef}>
      <form onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={compact ? "Rechercher..." : "Rechercher un titre..."}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            autoFocus={!compact}
            autoComplete="off"
          />
          {loading && (
            <div className="search-spinner">
              <svg className="spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      </form>

      {showDropdown && (suggestions.length > 0 || loading) && (
        <div className="autocomplete-dropdown">
          {suggestions.map((item, index) => {
            const typeInfo = TYPE_LABELS[item.type] || { emoji: "📚", label: item.type };
            return (
              <button
                key={`${item.type}-${item.id}`}
                className={`autocomplete-item ${index === activeIndex ? "active" : ""}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
              >
                <div className="autocomplete-item-cover">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" />
                  ) : (
                    <span className="autocomplete-item-no-cover">📚</span>
                  )}
                </div>
                <div className="autocomplete-item-info">
                  <span className="autocomplete-item-title">{item.title}</span>
                  {item.year && <span className="autocomplete-item-year">{item.year}</span>}
                </div>
                <span className={`autocomplete-item-badge ${item.type}`}>
                  {typeInfo.emoji} {typeInfo.label}
                </span>
              </button>
            );
          })}
          {loading && suggestions.length === 0 && (
            <div className="autocomplete-loading">
              <svg className="spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              <span>Recherche en cours…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


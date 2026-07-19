"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

const suggestions = [
  { label: "One Piece", type: "manga" },
  { label: "Batman", type: "comic" },
  { label: "Astérix", type: "bd" },
  { label: "Naruto", type: "manga" },
  { label: "Spider-Man", type: "comic" },
  { label: "Tintin", type: "bd" },
  { label: "Berserk", type: "manga" },
  { label: "Lucky Luke", type: "bd" },
];

export default function HomePage() {
  const router = useRouter();

  const handleSuggestion = (label: string, type: string) => {
    router.push(`/search?q=${encodeURIComponent(label)}&type=${type}`);
  };

  return (
    <main className="hero">
      <h1 className="hero-title">ReadSeerr</h1>
      <p className="hero-subtitle">
        Recherchez et demandez vos mangas, comics et BD franco-belges préférés.
        Tout est automatisé.
      </p>

      <div className="hero-search">
        <SearchBar />
      </div>

      <div className="hero-suggestions">
        {suggestions.map((s) => (
          <button
            key={s.label}
            className="hero-suggestion-pill"
            onClick={() => handleSuggestion(s.label, s.type)}
          >
            {s.type === "manga" ? "🇯🇵" : s.type === "comic" ? "🇺🇸" : "🇫🇷"} {s.label}
          </button>
        ))}
      </div>
    </main>
  );
}

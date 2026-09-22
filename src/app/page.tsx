"use client";

import SearchBar from "@/components/SearchBar";

export default function HomePage() {
  return (
    <main className="hero">
      <h1 className="hero-title">ReadSeerr</h1>
      <p className="hero-subtitle">
        Recherchez et demandez vos lectures préférées.
        Tout est automatisé.
      </p>

      <div className="hero-search">
        <SearchBar />
      </div>
    </main>
  );
}


/**
 * Forme canonique d'un titre pour la comparaison :
 * "L'Arabe du futur (2014) [Intégrale]" -> "arabe du futur", "Billy Bat" -> "billy bat".
 */
export function normalizeTitle(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // "(2014)", "[Intégrale]"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|le|la|les|l) /, "")
    .replace(/\s+/g, " ");

  // Mentions d'édition : "Injustice ... intégrale" = "Injustice ..." dans Komga
  // et plages de tomes des noms de dossier : "Kingdom.T01-T78" = "Kingdom"
  const withoutEdition = base
    .replace(EDITION_WORDS, " ")
    .replace(VOLUME_RANGE, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutEdition || base;
}

const VOLUME_RANGE = /(?:\s+t\d+(?:\s+(?:a\s+)?t\d+)?)+$/;
const EDITION_WORDS = /\b(?:l )?(?:integrale?|omnibus|deluxe|coffret)\b/g;

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Deux titres normalisés quasi identiques (faute de frappe : "parmis" / "parmi").
 * Réservé aux titres longs, et les nombres doivent être identiques ("Spider-Man 2099" ≠ "2098").
 */
export function isNearTitle(a: string, b: string): boolean {
  const shortest = Math.min(a.length, b.length);
  if (shortest < 12) return false;
  if ((a.match(/\d+/g) ?? []).join() !== (b.match(/\d+/g) ?? []).join()) return false;
  const maxDistance = shortest >= 25 ? 2 : 1;
  return levenshtein(a, b, maxDistance) <= maxDistance;
}

/** "Billy Bat - Tome 03" / "Billy Bat #3" / "Billy Bat T03" -> "Billy Bat" */
export function stripVolumeNumber(bookName: string): string {
  return bookName.replace(/[\s,._-]*(?:tome|vol(?:ume)?\.?|t|#|n°)?\s*\d+\s*$/i, "");
}

/** "Spider-Man (2018)" -> 2018 : distingue les séries homonymes de comics. */
export function extractYear(title: string): number | null {
  const match = title.match(/\((\d{4})\)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Titres normalisés distincts, sans valeurs vides. */
export function normalizedTitles(titles: (string | null | undefined)[]): string[] {
  return [...new Set(titles.filter((t): t is string => !!t && t.trim() !== "").map(normalizeTitle))].filter(Boolean);
}

export function parseJsonArray<T>(raw: string | null | undefined): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

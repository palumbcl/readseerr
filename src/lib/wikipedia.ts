/**
 * Consultations d'articles Wikipédia (API MediaWiki, sans clé) : 50 articles par appel,
 * redirections suivies (« Saga (comic book) » -> « Saga (comics) »).
 */
const USER_AGENT = "ReadSeerr/1.0 (self-hosted reading request app)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface QueryResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; pageviews?: Record<string, number | null> }[];
  };
}

/** Consultations des `days` derniers jours (60 max) pour chaque titre demandé ; 0 si l'article n'existe pas. */
export async function getPageviews(lang: "en" | "fr", titles: string[], days = 60): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const viewsByTitle = new Map<string, number>();
    let normalized: { from: string; to: string }[] = [];
    let redirects: { from: string; to: string }[] = [];
    // L'API ne renvoie les consultations que d'une partie des pages à la fois : on suit la continuation
    let continuation: Record<string, string> = {};

    for (let round = 0; round < 10; round++) {
      const params = new URLSearchParams({
        action: "query",
        titles: chunk.join("|"),
        redirects: "1",
        prop: "pageviews",
        pvipdays: String(Math.min(days, 60)),
        format: "json",
        formatversion: "2",
        ...continuation,
      });
      const request = () =>
        fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(15000),
        });
      let response = await request();
      // Limite de débit : une nouvelle tentative, puis on garde les consultations déjà obtenues
      if (response.status === 429) {
        await sleep(2000);
        response = await request();
      }
      if (response.status === 429) break;
      if (!response.ok) throw new Error(`Wikipédia (${lang}) a répondu ${response.status}.`);
      const data: QueryResponse & { continue?: Record<string, string> } = await response.json();

      normalized = data.query?.normalized ?? normalized;
      redirects = data.query?.redirects ?? redirects;
      for (const page of data.query?.pages ?? []) {
        const views = Object.values(page.pageviews ?? {}).reduce<number>((sum, v) => sum + (v ?? 0), 0);
        viewsByTitle.set(page.title, Math.max(viewsByTitle.get(page.title) ?? 0, page.missing ? 0 : views));
      }

      if (!data.continue) break;
      continuation = data.continue;
      await sleep(300);
    }

    // Retrouve le titre demandé derrière la normalisation (espaces, casse) et les redirections
    const follow = (title: string, steps: { from: string; to: string }[]) =>
      steps.find((s) => s.from === title)?.to ?? title;
    for (const title of chunk) {
      result.set(title, viewsByTitle.get(follow(follow(title, normalized), redirects)) ?? 0);
    }
  }
  return result;
}

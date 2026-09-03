export type LilyHit = {
  kind: "x" | "web" | "github" | "manual";
  url: string;
  title: string;
  snippet: string;
  author?: string;
};

export type LilyProduct = {
  name: string;
  maker: string;
  urls: string[];
  claims: string[];
};

export type LilyQuote = {
  text: string;
  author: string;
  url: string;
  genuine: boolean;
};

export type LilyBrief = {
  id: string;
  generatedAt: number;
  products: LilyProduct[];
  quotes: LilyQuote[];
  killedBait: number;
  raw: number;
  kept: number;
  checks: string[];
  paths: { path: string; note: string }[];
  verdict: string;
  confidence: number;
  action: "observe" | "stand-down" | "size-me";
};

const BAIT = [
  /\bgiveaway\b/i,
  /\brt if\b/i,
  /\blike if\b/i,
  /\bcomment \W?yes\b/i,
  /\b(you won't believe|gone wrong|insane|unbelievable)\b/i,
  /\b(link in bio|dm me|send me a dm)\b/i,
  /\b(100x|guaranteed returns|risk[- ]free)\b/i,
  /\b(follow me for|follow for more)\b/i,
  /\bsubscribe for the alpha\b/i,
  /\bthis will change everything\b/i,
];

const LOW = /^(wow|nice|good|gm|gn|this|lol|lmao|same|facts|true|fire)+\W*$/i;

const STOP = new Set([
  "The",
  "This",
  "That",
  "New",
  "Just",
  "How",
  "Why",
  "What",
  "Open",
  "Source",
  "Google",
  "Microsoft",
  "Amazon",
  "Today",
  "Introducing",
  "Launch",
  "Released",
]);

export function isBait(text: string): boolean {
  const t = (text || "").trim();
  if (!t || t.length < 12) return true;
  if (LOW.test(t)) return true;
  return BAIT.some((p) => p.test(t));
}

export function filterHits(hits: LilyHit[]) {
  const kept: LilyHit[] = [];
  let killed = 0;
  for (const h of hits) {
    if (isBait(`${h.title} ${h.snippet}`)) {
      killed += 1;
      continue;
    }
    kept.push(h);
  }
  return { kept, killed };
}

function guessName(h: LilyHit): string {
  if (h.kind === "github" && h.title.includes("/")) {
    return h.title.split("/").pop() || h.title;
  }
  const blob = `${h.title} ${h.snippet}`;
  const matches = blob.match(/\b([A-Z][A-Za-z0-9]{2,}(?:[ -][A-Z][A-Za-z0-9]{2,}){0,3})\b/g) ?? [];
  for (const c of matches) {
    if (!STOP.has(c) && c !== c.toUpperCase()) return c.slice(0, 48);
  }
  const words = h.title.match(/[A-Za-z][A-Za-z0-9+\-]{2,}/g) ?? [];
  return words.slice(0, 3).join(" ").slice(0, 48);
}

export function clusterProducts(hits: LilyHit[], max = 8): LilyProduct[] {
  const buckets = new Map<string, LilyProduct>();
  for (const h of hits) {
    const name = guessName(h);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = buckets.get(key) ?? { name, maker: h.author ?? "", urls: [], claims: [] };
    if (h.url && !existing.urls.includes(h.url)) existing.urls.push(h.url);
    const claim = (h.snippet || h.title).trim().slice(0, 240);
    if (claim && !existing.claims.includes(claim)) existing.claims.push(claim);
    if (h.author && !existing.maker) existing.maker = h.author;
    buckets.set(key, existing);
  }
  return [...buckets.values()].slice(0, max);
}

export function quotesFromHits(hits: LilyHit[]) {
  const quotes: LilyQuote[] = [];
  let killed = 0;
  const seen = new Set<string>();
  for (const h of hits) {
    const text = (h.snippet || h.title).trim();
    const key = text.toLowerCase().replace(/\W+/g, " ").slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    const bait = isBait(text);
    if (bait) killed += 1;
    quotes.push({
      text: text.slice(0, bait ? 280 : 400),
      author: h.author ?? "",
      url: h.url,
      genuine: !bait,
    });
  }
  return { quotes, killed };
}

export function assembleBrief(input: {
  hits: LilyHit[];
  fundConnected: boolean;
  paper: boolean;
}): LilyBrief {
  const { kept, killed: baitHits } = filterHits(input.hits);
  const products = clusterProducts(kept);
  const { quotes, killed: baitQuotes } = quotesFromHits(kept);
  const killed = baitHits + baitQuotes;
  const genuine = quotes.filter((q) => q.genuine);
  let action: LilyBrief["action"] = "stand-down";
  let confidence = 0.4;
  let verdict = "No product survived hygiene this cycle. Loop holds fire.";
  if (products.length && input.fundConnected) {
    action = "observe";
    confidence = 0.62;
    verdict = "Products clustered. Fund keys are attached. LilyRose observes — she does not size tickets.";
  } else if (products.length) {
    action = "observe";
    confidence = 0.55;
    verdict = "Intelligence is live. Attach Kraken keys if you want the fund sleeve on this brief.";
  }
  return {
    id: Math.random().toString(16).slice(2, 14),
    generatedAt: Date.now(),
    products,
    quotes: genuine,
    killedBait: killed,
    raw: input.hits.length,
    kept: kept.length,
    checks: [
      `raw ${input.hits.length} → kept ${kept.length}`,
      `fund attached=${input.fundConnected} paper=${input.paper}`,
    ],
    paths: [
      {
        path: "competitors",
        note: products.length ? products.map((p) => p.name).slice(0, 5).join(", ") : "no cluster",
      },
      { path: "code", note: `${kept.filter((h) => h.kind === "github").length} github hits` },
      {
        path: "gaps",
        note: products.length ? `${products.length} clustered, ${killed} bait dropped` : "gap: silence on launches",
      },
      {
        path: "fund",
        note: input.fundConnected ? "keys stored locally — observe only" : "no keys",
      },
    ],
    verdict,
    confidence,
    action,
  };
}

export async function scanGithub(): Promise<LilyHit[]> {
  const q = encodeURIComponent("ai agent created:>2026-08-01");
  const res = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=updated&per_page=12`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub search ${res.status}`);
  const data = (await res.json()) as {
    items?: { full_name: string; html_url: string; description: string | null; owner?: { login: string } }[];
  };
  return (data.items ?? []).map((r) => ({
    kind: "github" as const,
    url: r.html_url,
    title: r.full_name,
    snippet: r.description || "",
    author: r.owner?.login,
  }));
}

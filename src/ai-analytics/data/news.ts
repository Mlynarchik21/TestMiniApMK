import type { NewsBlock, NewsItem } from "../types/market-brief";
import {
  IMPORTANT_NEWS_EXCLUDE,
  IMPORTANT_NEWS_KEYWORDS,
  MAX_NEWS_ITEMS,
  TRUSTED_NEWS_DOMAINS,
} from "../constants/filters";
import { fetchJson } from "../utils/http";

type CryptoPanicPost = {
  title?: string;
  published_at?: string;
  url?: string;
  domain?: string;
  kind?: string;
  source?: {
    title?: string;
    domain?: string;
  };
};

type CryptoPanicResp = {
  results?: CryptoPanicPost[];
};

function containsImportantKeyword(text: string) {
  const t = text.toLowerCase();
  return IMPORTANT_NEWS_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

function containsExcludedKeyword(text: string) {
  const t = text.toLowerCase();
  return IMPORTANT_NEWS_EXCLUDE.some((k) => t.includes(k.toLowerCase()));
}

function isTrustedDomain(url?: string | null, domain?: string | null) {
  const value = `${url || ""} ${domain || ""}`.toLowerCase();
  return TRUSTED_NEWS_DOMAINS.some((d) => value.includes(d.toLowerCase()));
}

function detectCategory(title: string): string {
  const t = title.toLowerCase();

  if (t.includes("etf")) return "ETF";
  if (
    t.includes("sec") ||
    t.includes("court") ||
    t.includes("regulation") ||
    t.includes("lawsuit")
  ) {
    return "Regulation";
  }
  if (t.includes("hack") || t.includes("exploit") || t.includes("breach")) {
    return "Security";
  }
  if (t.includes("listing") || t.includes("listed")) return "Listing";
  if (t.includes("unlock")) return "Unlock";
  if (t.includes("binance") || t.includes("coinbase") || t.includes("kraken")) {
    return "Exchange";
  }
  if (
    t.includes("blackrock") ||
    t.includes("grayscale") ||
    t.includes("fidelity") ||
    t.includes("ark")
  ) {
    return "Institutional";
  }
  if (t.includes("tether") || t.includes("circle") || t.includes("stablecoin")) {
    return "Stablecoin";
  }

  return "General";
}

function buildWhyItMatters(title: string): string {
  const t = title.toLowerCase();

  if (t.includes("etf")) {
    return "Может усилить или ослабить институциональный спрос.";
  }

  if (
    t.includes("sec") ||
    t.includes("court") ||
    t.includes("regulation") ||
    t.includes("lawsuit")
  ) {
    return "Влияет на регуляторный риск и настроение рынка.";
  }

  if (t.includes("hack") || t.includes("exploit") || t.includes("breach")) {
    return "Повышает risk-off настроение и давление на сектор.";
  }

  if (t.includes("listing") || t.includes("listed")) {
    return "Может дать краткосрочный приток ликвидности и внимания.";
  }

  if (t.includes("unlock")) {
    return "Может создать дополнительное давление предложения.";
  }

  if (
    t.includes("blackrock") ||
    t.includes("grayscale") ||
    t.includes("fidelity") ||
    t.includes("institutional")
  ) {
    return "Важно для оценки институционального участия.";
  }

  if (t.includes("tether") || t.includes("circle") || t.includes("stablecoin")) {
    return "Важно для ликвидности и устойчивости крипторынка.";
  }

  return "Может повлиять на направление рынка и краткосрочный сентимент.";
}

function mapPost(post: CryptoPanicPost): NewsItem {
  const title = String(post.title || "").trim();

  return {
    title,
    summary: title,
    whyItMatters: buildWhyItMatters(title),
    source: post.source?.title || post.domain || null,
    url: post.url || null,
    publishedAt: post.published_at || null,
    category: detectCategory(title),
  };
}

function sortByPublishedAtDesc(items: NewsItem[]): NewsItem[] {
  return items
    .slice()
    .sort((a, b) => {
      const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bt - at;
    });
}

function dedupeByTitle(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export async function getNewsBlock(): Promise<NewsBlock> {
  try {
    const token = process.env.CRYPTOPANIC_API_TOKEN?.trim();

    if (!token) {
      return { items: [] };
    }

    const url =
      `https://cryptopanic.com/api/v1/posts/?auth_token=${token}` +
      `&kind=news&public=true&filter=rising&regions=en`;

    const data = await fetchJson<CryptoPanicResp>(url);

    const raw = Array.isArray(data?.results) ? data.results : [];

    const mapped = raw
      .filter((post) => {
        const title = String(post.title || "").trim();
        if (!title) return false;
        if (containsExcludedKeyword(title)) return false;
        return true;
      })
      .map(mapPost);

    const strongMatches = mapped.filter((item) => {
      const title = String(item.title || "");
      return containsImportantKeyword(title) && isTrustedDomain(item.url, item.source);
    });

    const fallbackMatches = mapped.filter((item) => {
      const title = String(item.title || "");
      return containsImportantKeyword(title);
    });

    const finalItems = dedupeByTitle(
      sortByPublishedAtDesc(
        strongMatches.length > 0 ? strongMatches : fallbackMatches
      )
    ).slice(0, MAX_NEWS_ITEMS);

    return {
      items: finalItems,
    };
  } catch {
    return {
      items: [],
    };
  }
}
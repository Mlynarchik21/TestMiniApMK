import type { NewsBlock, NewsItem } from "../types/market-brief";
import {
  IMPORTANT_NEWS_EXCLUDE,
  IMPORTANT_NEWS_KEYWORDS,
  MAX_NEWS_ITEMS,
  TRUSTED_NEWS_DOMAINS,
} from "../constants/filters";
import { fetchText } from "../utils/http";

type RssItem = {
  title: string;
  link: string | null;
  description: string | null;
  pubDate: string | null;
  source: string;
};

const RSS_FEEDS = [
  {
    source: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
  },
  {
    source: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
  },
];

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1] ? decodeHtml(m[1]) : null;
}

function containsImportantKeyword(text: string) {
  const t = text.toLowerCase();
  return IMPORTANT_NEWS_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

function containsExcludedKeyword(text: string) {
  const t = text.toLowerCase();
  return IMPORTANT_NEWS_EXCLUDE.some((k) => t.includes(k.toLowerCase()));
}

function isTrustedDomain(url?: string | null, source?: string | null) {
  const value = `${url || ""} ${source || ""}`.toLowerCase();
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

function parseRss(xml: string, source: string): RssItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const title = getTag(item, "title") || "";
      const link = getTag(item, "link");
      const description = getTag(item, "description");
      const pubDate = getTag(item, "pubDate");

      return {
        title,
        link,
        description,
        pubDate,
        source,
      };
    })
    .filter((item) => item.title);
}

function mapItem(item: RssItem): NewsItem {
  return {
    title: item.title,
    summary: item.description || item.title,
    whyItMatters: buildWhyItMatters(item.title),
    source: item.source,
    url: item.link,
    publishedAt: item.pubDate,
    category: detectCategory(item.title),
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
    const results = await Promise.all(
      RSS_FEEDS.map(async (feed) => {
        try {
          const xml = await fetchText(feed.url, undefined, 8000);
          return parseRss(xml, feed.source);
        } catch {
          return [];
        }
      })
    );

    const raw = results.flat();

    const mapped = raw
      .filter((item) => {
        const text = `${item.title} ${item.description || ""}`.trim();
        if (!text) return false;
        if (containsExcludedKeyword(text)) return false;
        if (!containsImportantKeyword(text)) return false;
        if (!isTrustedDomain(item.link, item.source)) return false;
        return true;
      })
      .map(mapItem);

    const finalItems = dedupeByTitle(sortByPublishedAtDesc(mapped)).slice(
      0,
      MAX_NEWS_ITEMS
    );

    return {
      items: finalItems,
    };
  } catch {
    return {
      items: [],
    };
  }
}
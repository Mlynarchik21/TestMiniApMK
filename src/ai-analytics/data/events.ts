import type { EventItem, EventsBlock } from "../types/market-brief";
import {
  IMPORTANT_EVENT_KEYWORDS,
  MAX_EVENTS_PER_BUCKET,
} from "../constants/filters";
import { fetchJson } from "../utils/http";
import { groupEventsByTime, sortByDateAsc, toIso } from "../utils/dates";

type CoinGeckoEventsResp = {
  data?: Array<{
    type?: string;
    title?: string;
    description?: string;
    organizer?: string;
    start_date?: string;
    end_date?: string;
    website?: string;
  }>;
};

function containsImportantEventKeyword(text: string) {
  const t = text.toLowerCase();
  return IMPORTANT_EVENT_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

function detectEventCategory(title: string): string | null {
  const t = title.toLowerCase();

  if (t.includes("unlock")) return "Unlock";
  if (t.includes("listing")) return "Listing";
  if (t.includes("etf")) return "ETF";
  if (t.includes("sec") || t.includes("court")) return "Regulation";
  if (t.includes("governance") || t.includes("vote")) return "Governance";
  if (t.includes("upgrade") || t.includes("mainnet") || t.includes("testnet"))
    return "Upgrade";
  if (t.includes("launch")) return "Launch";
  if (t.includes("token")) return "Token Event";

  return "General";
}

function buildWhyItMatters(title: string): string {
  const t = title.toLowerCase();

  if (t.includes("unlock")) return "Может повлиять на предложение и давление продаж.";
  if (t.includes("listing")) return "Может привести к росту ликвидности и волатильности.";
  if (t.includes("etf")) return "Важно для институционального спроса и настроения рынка.";
  if (t.includes("sec") || t.includes("court"))
    return "Важно для регуляторного риска и рыночного сентимента.";
  if (t.includes("governance") || t.includes("vote"))
    return "Может изменить токеномику, стимулы или параметры протокола.";
  if (t.includes("upgrade") || t.includes("mainnet") || t.includes("testnet"))
    return "Может стать катализатором движения по конкретному активу.";
  if (t.includes("launch")) return "Может привлечь внимание и спекулятивный поток.";

  return "Может стать локальным катализатором волатильности.";
}

function mapEvent(item: CoinGeckoEventsResp["data"][number]): EventItem | null {
  const title = String(item?.title || "").trim();
  const description = String(item?.description || "").trim();
  const merged = `${title} ${description}`.trim();

  if (!title) return null;
  if (!containsImportantEventKeyword(merged)) return null;

  const when = toIso(item?.start_date || item?.end_date || null);
  if (!when) return null;

  return {
    title,
    when,
    whyItMatters: buildWhyItMatters(title),
    source: item?.organizer || "CoinGecko",
    url: item?.website || null,
    category: detectEventCategory(title),
  };
}

export async function getEventsBlock(): Promise<EventsBlock> {
  try {
    /**
     * CoinGecko public events endpoint
     * Иногда бывает пустой — это нормально
     */
    const data = await fetchJson<CoinGeckoEventsResp>(
      "https://api.coingecko.com/api/v3/events"
    ).catch(() => ({ data: [] }));

    const items = (Array.isArray(data?.data) ? data.data : [])
      .map(mapEvent)
      .filter(Boolean) as EventItem[];

    const sorted = sortByDateAsc(items);
    const grouped = groupEventsByTime(sorted);

    return {
      today: grouped.today.slice(0, MAX_EVENTS_PER_BUCKET),
      tomorrow: grouped.tomorrow.slice(0, MAX_EVENTS_PER_BUCKET),
      thisWeek: grouped.thisWeek.slice(0, MAX_EVENTS_PER_BUCKET),
    };
  } catch {
    return {
      today: [],
      tomorrow: [],
      thisWeek: [],
    };
  }
}
import type { EtfFlowBlock } from "../types/market-brief";
import { fetchText } from "../utils/http";
import { toNumber } from "../utils/numbers";

const BTC_ETF_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
const ETH_ETF_URL = "https://farside.co.uk/ethereum-etf-flow-all-data/";

type ParsedEtfPage = {
  tradingDate: string | null;
  totalFlow: number | null;
};

function parseNumber(str: string): number | null {
  if (!str) return null;

  const trimmed = str.trim();
  if (!trimmed || trimmed === "-") return null;

  const negativeBracket = /^\((.+)\)$/.exec(trimmed);
  const normalized = negativeBracket ? `-${negativeBracket[1]}` : trimmed;
  const clean = normalized.replace(/[^0-9.\-]/g, "");

  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isDateLike(value: string): boolean {
  return /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(value.trim());
}

function extractLatestEtfTotal(html: string): ParsedEtfPage {
  const text = stripTags(html);

  /**
   * На страницах Farside данные идут плоским текстом:
   * Date ... Total 11 Jan 2024 ... 655.3 12 Jan 2024 ... 203.0 ...
   *
   * Берем все даты и последнее число перед следующей датой / концом текста.
   */
  const dateRegex = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/g;
  const matches = Array.from(text.matchAll(dateRegex));

  if (!matches.length) {
    return {
      tradingDate: null,
      totalFlow: null,
    };
  }

  let latestDate: string | null = null;
  let latestTotal: number | null = null;

  for (let i = 0; i < matches.length; i++) {
    const currentDate = matches[i]?.[1] ?? null;
    const startIndex = matches[i]?.index ?? 0;
    const endIndex =
      i + 1 < matches.length ? matches[i + 1]!.index! : text.length;

    if (!currentDate) continue;

    const segment = text.slice(startIndex, endIndex).trim();
    const segmentWithoutDate = segment.replace(currentDate, "").trim();

    const numericTokens =
      segmentWithoutDate.match(/\(?-?\d+(?:\.\d+)?\)?/g) ?? [];

    if (!numericTokens.length) continue;

    const lastNumeric = numericTokens[numericTokens.length - 1] ?? "";
    const parsed = parseNumber(lastNumeric);

    if (parsed === null) continue;

    latestDate = currentDate;
    latestTotal = parsed;
  }

  return {
    tradingDate: latestDate,
    totalFlow: latestTotal,
  };
}

function buildSummary(
  btc: number | null,
  eth: number | null
): string | null {
  if (btc == null && eth == null) return null;

  const total = (btc || 0) + (eth || 0);

  if (total > 0) return "Net inflow";
  if (total < 0) return "Net outflow";
  return "Neutral";
}

function pickTradingDate(
  btcDate: string | null,
  ethDate: string | null
): string | null {
  if (btcDate && ethDate) {
    return btcDate === ethDate ? btcDate : `${btcDate} / ${ethDate}`;
  }

  return btcDate || ethDate || null;
}

export async function getEtfBlock(): Promise<EtfFlowBlock> {
  try {
    const [btcHtml, ethHtml] = await Promise.all([
      fetchText(BTC_ETF_URL),
      fetchText(ETH_ETF_URL),
    ]);

    const btc = extractLatestEtfTotal(btcHtml);
    const eth = extractLatestEtfTotal(ethHtml);

    return {
      bitcoinSpotEtfNetflow: toNumber(btc.totalFlow),
      ethereumSpotEtfNetflow: toNumber(eth.totalFlow),
      summary: buildSummary(btc.totalFlow, eth.totalFlow),
      tradingDate: pickTradingDate(btc.tradingDate, eth.tradingDate),
    };
  } catch {
    return {
      bitcoinSpotEtfNetflow: null,
      ethereumSpotEtfNetflow: null,
      summary: null,
      tradingDate: null,
    };
  }
}
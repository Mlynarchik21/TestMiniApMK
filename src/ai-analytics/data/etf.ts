import type { EtfFlowBlock } from "../types/market-brief";
import { fetchText } from "../utils/http";
import { toNumber } from "../utils/numbers";

/**
 * Парсим ETF данные с Farside
 * Это лучший публичный источник по ETF flows
 */

function parseNumber(str: string): number | null {
  if (!str) return null;

  const clean = str.replace(/[^0-9\.-]/g, "");
  const n = Number(clean);

  return Number.isFinite(n) ? n : null;
}

function extractLatestETFRow(html: string): {
  date: string | null;
  btcFlow: number | null;
  ethFlow: number | null;
} {
  /**
   * Мы ищем последнюю строку таблицы ETF flows
   * Обычно там структура:
   * Date | BTC | ... | ETH
   */

  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  // Берем последние строки (там свежие данные)
  const lastRows = rows.slice(-10).reverse();

  for (const row of lastRows) {
    const cols = row.match(/<td[\s\S]*?<\/td>/gi);
    if (!cols || cols.length < 2) continue;

    const texts = cols.map((c) =>
      c.replace(/<[^>]+>/g, "").trim()
    );

    const date = texts[0] || null;

    // BTC flow обычно 2-3 колонка
    const btcFlow = parseNumber(texts[1] || "");

    // ETH иногда есть дальше
    const ethFlow = parseNumber(texts[texts.length - 1] || "");

    if (btcFlow !== null || ethFlow !== null) {
      return {
        date,
        btcFlow,
        ethFlow,
      };
    }
  }

  return {
    date: null,
    btcFlow: null,
    ethFlow: null,
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

export async function getEtfBlock(): Promise<EtfFlowBlock> {
  try {
    const html = await fetchText(
      "https://farside.co.uk/bitcoin-etf-flow-all-data/"
    );

    const parsed = extractLatestETFRow(html);

    return {
      bitcoinSpotEtfNetflow: toNumber(parsed.btcFlow),
      ethereumSpotEtfNetflow: toNumber(parsed.ethFlow),
      summary: buildSummary(parsed.btcFlow, parsed.ethFlow),
      tradingDate: parsed.date,
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
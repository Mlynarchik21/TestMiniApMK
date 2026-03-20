import type { ExchangeAdapter, ExchangeName } from "@/lib/exchanges/types";
import { bybitAdapter } from "@/lib/exchanges/bybit";

export function getExchangeAdapter(exchange: ExchangeName): ExchangeAdapter {
  if (exchange === "BYBIT") return bybitAdapter;
  throw new Error(`Exchange adapter not implemented: ${exchange}`);
}
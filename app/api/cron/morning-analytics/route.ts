// app/api/cron/morning-analytics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

function authFail() {
  return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
}

async function fetchCmcGlobal(): Promise<string> {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) return "CMC данные недоступны";
  try {
    const res = await fetch("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", {
      headers: { "X-CMC_PRO_API_KEY": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    if (!json?.data) return "CMC данные недоступны";
    const d = json.data;
    const mc = d.quote?.USD?.total_market_cap ? `$${(d.quote.USD.total_market_cap / 1e12).toFixed(2)}T` : "N/A";
    const vol = d.quote?.USD?.total_volume_24h ? `$${(d.quote.USD.total_volume_24h / 1e9).toFixed(1)}B` : "N/A";
    const btcDom = d.btc_dominance ? `${d.btc_dominance.toFixed(1)}%` : "N/A";
    const ethDom = d.eth_dominance ? `${d.eth_dominance.toFixed(1)}%` : "N/A";
    const active = d.active_cryptocurrencies ?? "N/A";
    return `Общая капитализация: ${mc}, Объём 24h: ${vol}, Доминирование BTC: ${btcDom}, ETH: ${ethDom}, Активных монет: ${active}`;
  } catch {
    return "CMC данные недоступны";
  }
}

async function fetchFearAndGreed(): Promise<string> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      signal: AbortSignal.timeout(6000),
    });
    const json = await res.json().catch(() => null);
    const item = json?.data?.[0];
    if (!item) return "Fear & Greed недоступен";
    return `Fear & Greed Index: ${item.value} (${item.value_classification})`;
  } catch {
    return "Fear & Greed недоступен";
  }
}

async function fetchBybitTopMovers(): Promise<string> {
  try {
    const res = await fetch("https://api.bybit.com/v5/market/tickers?category=spot", {
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    const list: any[] = json?.result?.list ?? [];
    if (!list.length) return "Топ-муверы недоступны";

    const sorted = list
      .filter((t) => typeof t.price24hPcnt === "string" && t.symbol.endsWith("USDT"))
      .map((t) => ({ symbol: t.symbol, pct: parseFloat(t.price24hPcnt) * 100 }))
      .filter((t) => Number.isFinite(t.pct))
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 10);

    const gainers = sorted.filter((t) => t.pct > 0).slice(0, 5);
    const losers = sorted.filter((t) => t.pct < 0).slice(0, 5);

    const fmtGainers = gainers.map((t) => `${t.symbol} +${t.pct.toFixed(1)}%`).join(", ");
    const fmtLosers = losers.map((t) => `${t.symbol} ${t.pct.toFixed(1)}%`).join(", ");
    return `Топ растущие: ${fmtGainers || "нет"}. Топ падающие: ${fmtLosers || "нет"}`;
  } catch {
    return "Топ-муверы недоступны";
  }
}

function buildFallbackDigest(cmc: string, fg: string, movers: string, date: string): string {
  return `📊 Утренний крипто-дайджест — ${date}\n\n🌍 Рынок:\n${cmc}\n\n😨 Настроения:\n${fg}\n\n📈 Движение монет (Bybit Spot):\n${movers}`;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) return authFail();

  const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  // Fetch market data in parallel
  const [cmc, fg, movers] = await Promise.all([
    fetchCmcGlobal(),
    fetchFearAndGreed(),
    fetchBybitTopMovers(),
  ]);

  const prompt = `Ты — крипто-аналитик. Напиши утренний дайджест на русском языке (~350-400 слов) для трейдеров на основе следующих данных:

Дата: ${date}
${cmc}
${fg}
${movers}

Структура дайджеста:
1. Заголовок с датой (используй эмодзи 📊)
2. Общее состояние рынка (2-3 предложения)
3. Настроение рынка по Fear & Greed (что это значит для трейдеров)
4. Топ-муверы дня (краткий анализ)
5. Вывод и рекомендации на день

Пиши живо и по делу. Не добавляй данные которых нет выше.`;

  const geminiResult = await generateText({ prompt, maxOutputTokens: 700, temperature: 0.6 });

  const digestText = geminiResult.ok
    ? geminiResult.text
    : buildFallbackDigest(cmc, fg, movers, date);

  // Find active Basic/Pro users
  const now = new Date();
  const activeSubs = await prisma.subscription.findMany({
    where: {
      plan: { in: ["basic", "pro"] },
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { userId: true },
  });

  const userIds = activeSubs.map((s) => s.userId);
  if (!userIds.length) {
    return NextResponse.json({ ok: true, sent: 0, digest: digestText });
  }

  // Get tgIds for these users
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, tgId: true },
  });

  // Save notifications in bulk
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "ANALYTICS",
      title: `Утренний дайджест — ${date}`,
      body: digestText.slice(0, 500),
    })),
    skipDuplicates: true,
  }).catch(() => {});

  // Send Telegram messages in batches of 20
  const botToken = process.env.BOT_TOKEN;
  let sent = 0;

  if (botToken) {
    const batches: typeof users[] = [];
    for (let i = 0; i < users.length; i += 20) {
      batches.push(users.slice(i, i + 20));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((u) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: Number(u.tgId), text: digestText }),
          }).then(() => { sent++; }).catch(() => {})
        )
      );
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  return NextResponse.json({ ok: true, sent, usersFound: users.length, geminiOk: geminiResult.ok });
}

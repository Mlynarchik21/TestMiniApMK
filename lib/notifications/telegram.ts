import { prisma } from "@/lib/db";

type OpenTradePayload = {
  userId: string;
  symbol: string;
  positionId: string;
  avgPrice: number;
  qty: number;
  usdtAmount: number;
  tpPrice: number;
};

type AveragedPayload = {
  userId: string;
  symbol: string;
  positionId: string;
  orderId: string;
  fillPrice: number;
  newAvgPrice: number;
  newTpPrice: number;
  totalQty: number;
  totalUsdtAmount: number;
};

type ClosedPayload = {
  userId: string;
  symbol: string;
  positionId: string;
  avgEntryPrice: number;
  exitPrice: number;
  qty: number;
  entryValue: number;
  exitValue: number;
  pnl: number;
};

function shortDealId(id: string) {
  return `#${id.slice(-8)}`;
}

function shortOrderId(id: string) {
  return `#${id.slice(-8)}`;
}

function fmtNum(v: number, digits = 8) {
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function fmtPrice(v: number) {
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function fmtUsdt(v: number) {
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function sendTelegramMessageByUserId(userId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tgId: true,
    },
  });

  if (!user?.tgId) return;

  const chatId = user.tgId.toString();

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: "no-store",
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Telegram sendMessage failed:", txt || r.status);
    }
  } catch (e) {
    console.error("Telegram sendMessage error:", e);
  }
}

export async function notifyTradeOpened(payload: OpenTradePayload) {
  const text =
    `🟢 Сделка открыта\n\n` +
    `Актив: ${payload.symbol}\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Цена входа: ${fmtPrice(payload.avgPrice)}\n` +
    `Объём: ${fmtNum(payload.qty)} ${payload.symbol.replace("USDT", "")}\n` +
    `Сумма: ${fmtUsdt(payload.usdtAmount)} USDT\n` +
    `Target: ${fmtPrice(payload.tpPrice)}`;

  await sendTelegramMessageByUserId(payload.userId, text);
}

export async function notifyTradeAveraged(payload: AveragedPayload) {
  const text =
    `🟡 Позиция усреднена\n\n` +
    `Актив: ${payload.symbol}\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Ордер: ${shortOrderId(payload.orderId)}\n` +
    `Цена добора: ${fmtPrice(payload.fillPrice)}\n` +
    `Новая средняя: ${fmtPrice(payload.newAvgPrice)}\n` +
    `Новый Target: ${fmtPrice(payload.newTpPrice)}\n` +
    `Общий объём: ${fmtNum(payload.totalQty)} ${payload.symbol.replace("USDT", "")}\n` +
    `Общая сумма: ${fmtUsdt(payload.totalUsdtAmount)} USDT`;

  await sendTelegramMessageByUserId(payload.userId, text);
}

export async function notifyTradeClosed(payload: ClosedPayload) {
  const text =
    `✅ Сделка закрыта\n\n` +
    `Актив: ${payload.symbol}\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Средняя цена входа: ${fmtPrice(payload.avgEntryPrice)}\n` +
    `Цена закрытия: ${fmtPrice(payload.exitPrice)}\n` +
    `Объём: ${fmtNum(payload.qty)} ${payload.symbol.replace("USDT", "")}\n` +
    `Вход: ${fmtUsdt(payload.entryValue)} USDT\n` +
    `Выход: ${fmtUsdt(payload.exitValue)} USDT\n` +
    `Прибыль: ${payload.pnl >= 0 ? "+" : ""}${fmtUsdt(payload.pnl)} USDT`;

  await sendTelegramMessageByUserId(payload.userId, text);
}
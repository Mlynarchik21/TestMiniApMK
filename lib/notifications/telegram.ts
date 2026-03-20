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

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
  result?: AnyJson;
};

type AnyJson = any;

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

function escapeTelegramHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessageByUserId(userId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!botToken) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN missing");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tgId: true,
    },
  });

  if (!user) {
    console.error("[telegram] user not found", { userId });
    return;
  }

  if (!user.tgId) {
    console.error("[telegram] user has no tgId", { userId });
    return;
  }

  const chatId = String(user.tgId).trim();

  if (!chatId) {
    console.error("[telegram] tgId is empty after cast", {
      userId,
      tgId: user.tgId,
    });
    return;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: escapeTelegramHtml(text),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });

    const rawText = await r.text().catch(() => "");
    let data: TelegramApiResponse | null = null;

    try {
      data = rawText ? (JSON.parse(rawText) as TelegramApiResponse) : null;
    } catch {
      data = null;
    }

    if (!r.ok) {
      console.error("[telegram] HTTP sendMessage failed", {
        userId,
        chatId,
        status: r.status,
        response: rawText,
      });
      return;
    }

    if (!data?.ok) {
      console.error("[telegram] API sendMessage failed", {
        userId,
        chatId,
        error_code: data?.error_code,
        description: data?.description,
        response: rawText,
      });
      return;
    }

    console.log("[telegram] message sent", {
      userId,
      chatId,
      messageId: data?.result?.message_id ?? null,
    });
  } catch (e) {
    console.error("[telegram] sendMessage error", {
      userId,
      chatId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function notifyTradeOpened(payload: OpenTradePayload) {
  const baseAsset = payload.symbol.replace("USDT", "");

  const text =
    `🟢 <b>Сделка открыта</b>\n\n` +
    `Актив: <b>${payload.symbol}</b>\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Цена входа: <b>${fmtPrice(payload.avgPrice)}</b>\n` +
    `Объём: <b>${fmtNum(payload.qty)} ${baseAsset}</b>\n` +
    `Сумма: <b>${fmtUsdt(payload.usdtAmount)} USDT</b>\n` +
    `Target: <b>${fmtPrice(payload.tpPrice)}</b>`;

  await sendTelegramMessageByUserId(payload.userId, text);
}

export async function notifyTradeAveraged(payload: AveragedPayload) {
  const baseAsset = payload.symbol.replace("USDT", "");

  const text =
    `🟡 <b>Позиция усреднена</b>\n\n` +
    `Актив: <b>${payload.symbol}</b>\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Ордер: ${shortOrderId(payload.orderId)}\n` +
    `Цена добора: <b>${fmtPrice(payload.fillPrice)}</b>\n` +
    `Новая средняя: <b>${fmtPrice(payload.newAvgPrice)}</b>\n` +
    `Новый Target: <b>${fmtPrice(payload.newTpPrice)}</b>\n` +
    `Общий объём: <b>${fmtNum(payload.totalQty)} ${baseAsset}</b>\n` +
    `Общая сумма: <b>${fmtUsdt(payload.totalUsdtAmount)} USDT</b>`;

  await sendTelegramMessageByUserId(payload.userId, text);
}

export async function notifyTradeClosed(payload: ClosedPayload) {
  const baseAsset = payload.symbol.replace("USDT", "");

  const text =
    `✅ <b>Сделка закрыта</b>\n\n` +
    `Актив: <b>${payload.symbol}</b>\n` +
    `Сделка: ${shortDealId(payload.positionId)}\n` +
    `Средняя цена входа: <b>${fmtPrice(payload.avgEntryPrice)}</b>\n` +
    `Цена закрытия: <b>${fmtPrice(payload.exitPrice)}</b>\n` +
    `Объём: <b>${fmtNum(payload.qty)} ${baseAsset}</b>\n` +
    `Вход: <b>${fmtUsdt(payload.entryValue)} USDT</b>\n` +
    `Выход: <b>${fmtUsdt(payload.exitValue)} USDT</b>\n` +
    `Прибыль: <b>${payload.pnl >= 0 ? "+" : ""}${fmtUsdt(payload.pnl)} USDT</b>`;

  await sendTelegramMessageByUserId(payload.userId, text);
}
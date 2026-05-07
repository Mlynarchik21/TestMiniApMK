// app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const PLAN_MONTHS: Record<string, number> = { basic: 1, pro: 1 };

async function answerPreCheckout(botToken: string, queryId: string, ok: boolean, errorMessage?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pre_checkout_query_id: queryId, ok, ...(errorMessage ? { error_message: errorMessage } : {}) }),
  });
}

async function checkAndGrantReferralReward(referrerId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count how many referred users subscribed to any paid plan this month
  const paidThisMonth = await prisma.payment.count({
    where: {
      user: { referredById: referrerId },
      createdAt: { gte: monthStart },
    },
  });

  // Count how many referred users bought Pro this month
  const proThisMonth = await prisma.payment.count({
    where: {
      user: { referredById: referrerId },
      plan: "pro",
      createdAt: { gte: monthStart },
    },
  });

  const referrerSub = await prisma.subscription.findUnique({ where: { userId: referrerId } });

  let rewardPlan: string | null = null;

  if (proThisMonth >= 5) {
    rewardPlan = "pro";
  } else if (paidThisMonth >= 5) {
    rewardPlan = "basic";
  }

  if (!rewardPlan) return;

  // Don't downgrade an already active Pro
  if (rewardPlan === "basic" && referrerSub?.plan === "pro" && referrerSub.status === "active") return;

  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId: referrerId },
    create: { userId: referrerId, plan: rewardPlan, status: "active", expiresAt },
    update: { plan: rewardPlan, status: "active", expiresAt },
  });

  const title = rewardPlan === "pro" ? "Pro план активирован!" : "Basic план активирован!";
  const body = `Вы привлекли 5 пользователей, которые оформили ${rewardPlan === "pro" ? "Pro" : "платную"} подписку. В награду — 1 месяц ${rewardPlan === "pro" ? "Pro" : "Basic"} бесплатно!`;

  await prisma.notification.create({
    data: { userId: referrerId, type: "SUBSCRIPTION", title, body },
  });
}

async function handleSuccessfulPayment(botToken: string, update: any) {
  const payment = update.message?.successful_payment;
  const tgId = update.message?.from?.id;

  if (!payment || !tgId) return;

  const chargeId: string = payment.telegram_payment_charge_id;
  const stars: number = payment.total_amount;
  const rawPayload: string = payment.invoice_payload || "";

  let plan = "basic";
  let userId: string | null = null;

  try {
    const parsed = JSON.parse(rawPayload);
    plan = parsed.plan ?? "basic";
    userId = parsed.userId ?? null;
  } catch {}

  // Lookup user by tgId if userId not in payload
  if (!userId) {
    const user = await prisma.user.findUnique({ where: { tgId: BigInt(tgId) }, select: { id: true } });
    userId = user?.id ?? null;
  }

  if (!userId) return;

  // Record payment (idempotent)
  try {
    await prisma.payment.create({
      data: { userId, plan, stars, telegramChargeId: chargeId, payload: rawPayload },
    });
  } catch {
    // Duplicate — already processed
    return;
  }

  // Extend subscription
  const months = PLAN_MONTHS[plan] ?? 1;
  const now = new Date();
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  const base = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan, status: "active", expiresAt },
    update: { plan, status: "active", expiresAt },
  });

  // Notify user
  const planLabel = plan === "pro" ? "Pro" : "Basic";
  await prisma.notification.create({
    data: {
      userId,
      type: "SUBSCRIPTION",
      title: `${planLabel} план активирован`,
      body: `Оплата прошла успешно. Ваш ${planLabel} план активен до ${expiresAt.toLocaleDateString("ru-RU")}.`,
    },
  }).catch(() => {});

  // Check referral rewards for the referrer
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });
  if (user?.referredById) {
    await checkAndGrantReferralReward(user.referredById).catch(() => {});
  }
}

export async function POST(req: Request) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return NextResponse.json({ ok: false }, { status: 500 });

  // Verify request is from Telegram using secret token header
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretToken) {
    const header = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (header !== secretToken) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  try {
    // Handle pre_checkout_query — must answer within 10 seconds
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      // Accept all valid XTR payments
      await answerPreCheckout(botToken, q.id, true);
      return NextResponse.json({ ok: true });
    }

    // Handle successful_payment
    if (update.message?.successful_payment) {
      await handleSuccessfulPayment(botToken, update);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}

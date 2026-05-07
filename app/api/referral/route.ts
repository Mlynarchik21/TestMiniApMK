// app/api/referral/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    // Ensure user has a referral code
    let referralCode = user.referralCode;
    if (!referralCode) {
      let code = generateCode();
      // Retry on collision (extremely rare)
      for (let i = 0; i < 5; i++) {
        try {
          const updated = await prisma.user.update({
            where: { id: user.id },
            data: { referralCode: code },
            select: { referralCode: true },
          });
          referralCode = updated.referralCode;
          break;
        } catch {
          code = generateCode();
        }
      }
    }

    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
    const referralLink = botUsername
      ? `https://t.me/${botUsername}?start=ref_${referralCode}`
      : `ref_${referralCode}`;

    // Get referred users
    const referred = await prisma.user.findMany({
      where: { referredById: user.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true } },
        payments: { select: { plan: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Monthly stats
    const paidThisMonth = await prisma.payment.count({
      where: {
        user: { referredById: user.id },
        createdAt: { gte: monthStart },
      },
    });
    const proThisMonth = await prisma.payment.count({
      where: {
        user: { referredById: user.id },
        plan: "pro",
        createdAt: { gte: monthStart },
      },
    });

    const stats = {
      totalReferred: referred.length,
      paidThisMonth,
      proThisMonth,
      nextReward: paidThisMonth >= 5
        ? (proThisMonth >= 5 ? null : `ещё ${5 - proThisMonth} Pro-покупок → Pro план`)
        : `ещё ${5 - paidThisMonth} подписок → Basic план`,
    };

    const referredList = referred.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.username || "Пользователь",
      username: r.username,
      joinedAt: r.createdAt.toISOString(),
      plan: r.subscription?.plan ?? "free",
      subscribed: (r.subscription?.plan ?? "free") !== "free",
      lastPaymentPlan: r.payments[0]?.plan ?? null,
    }));

    return ok({ referralCode, referralLink, stats, referred: referredList });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}

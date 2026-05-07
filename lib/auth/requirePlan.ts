// lib/auth/requirePlan.ts
import { prisma } from "@/lib/db";

export type PlanInfo = {
  plan: "free" | "basic" | "pro";
  isActive: boolean;
  canRunBot: boolean;
  maxActiveSymbols: number;
};

export async function getPlanInfo(userId: string): Promise<PlanInfo> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, expiresAt: true },
  });

  const now = new Date();
  const rawPlan = sub?.plan ?? "free";
  const isActive =
    sub?.status === "active" &&
    (sub.expiresAt == null || sub.expiresAt > now);

  // Free plan has no expiry — treat as always "active" but no bot access
  const effectivePlan =
    rawPlan === "free" ? "free" : isActive ? (rawPlan as "basic" | "pro") : "free";

  const canRunBot = effectivePlan === "basic" || effectivePlan === "pro";
  const maxActiveSymbols =
    effectivePlan === "pro" ? 10 : effectivePlan === "basic" ? 3 : 0;

  return { plan: effectivePlan, isActive, canRunBot, maxActiveSymbols };
}

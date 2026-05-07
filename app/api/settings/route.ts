// app/api/settings/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    { ...init, headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) } }
  );
}
function ok(data: any) { return json({ ok: true, ...data }); }
function fail(status: number, error: string, extra?: any) {
  return json({ ok: false, error, ...(extra ? { extra } : {}) }, { status });
}

const SELECT = {
  timezone: true,
  currency: true,
  riskMode: true,
  theme: true,
  notifyTradeOpen: true,
  notifyTradeClose: true,
  notifyBotStop: true,
  notifyBotError: true,
  notifySubscription: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: SELECT,
    });

    if (!settings) {
      return ok({
        settings: {
          timezone: "UTC", currency: "USD", riskMode: "normal", theme: "dark",
          notifyTradeOpen: true, notifyTradeClose: true,
          notifyBotStop: true, notifyBotError: true, notifySubscription: true,
          createdAt: null, updatedAt: null,
        },
      });
    }

    return ok({ settings });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", { message: e?.message ?? String(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => null);

    const timezone =
      typeof body?.timezone === "string" && body.timezone.length <= 64 ? body.timezone : undefined;
    const currency =
      typeof body?.currency === "string" && body.currency.length <= 16 ? body.currency : undefined;
    const riskModeRaw = typeof body?.riskMode === "string" ? body.riskMode : undefined;
    const riskMode =
      riskModeRaw === "normal" || riskModeRaw === "conservative" || riskModeRaw === "aggressive"
        ? riskModeRaw : undefined;
    const themeRaw = typeof body?.theme === "string" ? body.theme : undefined;
    const theme = themeRaw === "dark" || themeRaw === "light" ? themeRaw : undefined;

    const boolField = (key: string) =>
      key in (body ?? {}) && typeof body[key] === "boolean" ? (body[key] as boolean) : undefined;

    const notifyTradeOpen = boolField("notifyTradeOpen");
    const notifyTradeClose = boolField("notifyTradeClose");
    const notifyBotStop = boolField("notifyBotStop");
    const notifyBotError = boolField("notifyBotError");
    const notifySubscription = boolField("notifySubscription");

    const update: Record<string, any> = {};
    if (timezone !== undefined) update.timezone = timezone;
    if (currency !== undefined) update.currency = currency;
    if (riskMode !== undefined) update.riskMode = riskMode;
    if (theme !== undefined) update.theme = theme;
    if (notifyTradeOpen !== undefined) update.notifyTradeOpen = notifyTradeOpen;
    if (notifyTradeClose !== undefined) update.notifyTradeClose = notifyTradeClose;
    if (notifyBotStop !== undefined) update.notifyBotStop = notifyBotStop;
    if (notifyBotError !== undefined) update.notifyBotError = notifyBotError;
    if (notifySubscription !== undefined) update.notifySubscription = notifySubscription;

    if (Object.keys(update).length === 0) return fail(400, "NO_FIELDS");

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        timezone: update.timezone ?? "UTC",
        currency: update.currency ?? "USD",
        riskMode: update.riskMode ?? "normal",
        theme: update.theme ?? "dark",
        notifyTradeOpen: update.notifyTradeOpen ?? true,
        notifyTradeClose: update.notifyTradeClose ?? true,
        notifyBotStop: update.notifyBotStop ?? true,
        notifyBotError: update.notifyBotError ?? true,
        notifySubscription: update.notifySubscription ?? true,
      },
      update,
      select: SELECT,
    });

    return ok({ settings });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", { message: e?.message ?? String(e) });
  }
}

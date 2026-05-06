import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export async function GET(req: Request) {
  try {
    // SECURITY: По default требуем аутентификацию для health check
    // Можно разрешить через ENABLE_OPEN_HEALTH_ENDPOINT=true
    const enableOpenHealth = process.env.ENABLE_OPEN_HEALTH_ENDPOINT === "true";
    
    if (!enableOpenHealth) {
      // Требуем авторизацию если открытый доступ отключен (default)
      await requireUser(req);
    }

    const now = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return NextResponse.json({ ok: true, db: true, now: now?.[0]?.now ?? null });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json(
      { ok: false, db: false, error: status === 401 ? "UNAUTHORIZED" : "DB_ERROR" },
      { status }
    );
  }
}

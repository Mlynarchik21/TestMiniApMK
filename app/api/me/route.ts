// app/api/me/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// BigInt-safe JSON
function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    // если тебе нужно свежее из БД (не обязательно)
    // const fresh = await prisma.user.findUnique({ where: { id: user.id } });

    return json({
      ok: true,
      user: {
        id: user.id,
        tgId: user.tgId, // bigint -> превратится в string сериализатором
        username: user.username ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message },
      { status }
    );
  }
}

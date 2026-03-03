// app/api/keys/[id]/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// ✅ BigInt-safe JSON
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

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser(); // ✅ единая авторизация (Bearer/cookie + hash + expires)

    const id = String(ctx.params?.id || "").trim();
    if (!id) return json({ ok: false, error: "bad_id" }, { status: 400 });

    // удаляем только свой ключ
    const result = await prisma.userKey.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}

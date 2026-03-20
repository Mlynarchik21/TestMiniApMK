// app/api/keys/[id]/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

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

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser(req);

    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const key = await prisma.userKey.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        exchange: true,
      },
    });

    if (!key) {
      return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.botConfig.updateMany({
        where: {
          userId: user.id,
          keyId: id,
        },
        data: {
          keyId: null,
          enabled: false,
        },
      });

      await tx.userKey.deleteMany({
        where: {
          id,
          userId: user.id,
        },
      });
    });

    return json({
      ok: true,
      deletedKeyId: id,
      message: "Ключ удалён. Если он был подключён к боту, бот автоматически отключён.",
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
        message: e?.message ?? String(e),
      },
      { status }
    );
  }
}
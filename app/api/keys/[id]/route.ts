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
      select: { id: true },
    });

    if (!key) {
      return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const botConfigUsingKey = await prisma.botConfig.findFirst({
      where: {
        userId: user.id,
        keyId: id,
      },
      select: {
        id: true,
        enabled: true,
      },
    });

    if (botConfigUsingKey) {
      return json(
        {
          ok: false,
          error: "KEY_IN_USE",
          message:
            "Этот ключ сейчас используется в настройках бота. Сначала выбери другой ключ в /bot или отключи/перенастрой бота.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.userKey.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
        message: e?.message,
      },
      { status }
    );
  }
}

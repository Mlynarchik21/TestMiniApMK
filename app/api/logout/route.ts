import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/db";
import { cookies } from "next/headers";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST() {
  const token = cookies().get("session")?.value;

  if (token) {
    const tokenHash = sha256hex(token);
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

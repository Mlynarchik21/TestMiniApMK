// app/profile/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export default async function ProfilePage() {
  const token = cookies().get("session")?.value;

  if (!token) {
    redirect("/"); // или "/login" если есть
  }

  const tokenHash = sha256hex(token);

  const session = await prisma.session.findUnique({
    // ✅ уникальный ключ в БД
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    redirect("/");
  }

  const user = session.user;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Profile</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <div>
          <b>ID:</b> {user.id}
        </div>
        <div>
          <b>TG ID:</b> {user.tgId}
        </div>
        <div>
          <b>Username:</b> {user.username ?? "-"}
        </div>
        <div>
          <b>Name:</b>{" "}
          {[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}
        </div>
      </div>
    </main>
  );
}

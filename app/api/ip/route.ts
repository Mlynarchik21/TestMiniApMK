export const runtime = "nodejs";

export async function GET() {
  const r = await fetch("https://api.ipify.org?format=json", {
    cache: "no-store",
  });

  const data = await r.json();

  return Response.json({
    vercel_region: process.env.VERCEL_REGION,
    ip: data.ip,
  });
}

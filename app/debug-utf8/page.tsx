async function getData() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/ai-analytics/debug-utf8`,
    { cache: "no-store" }
  );

  return res.json();
}

export default async function DebugUtf8Page() {
  const data = await getData();

  return (
    <main style={{ padding: 24, color: "white", background: "black", minHeight: "100vh" }}>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
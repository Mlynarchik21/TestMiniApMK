async function getData() {
  const res = await fetch(
    "https://test-mini-ap-mk.vercel.app/api/ai-analytics/debug-market-read",
    {
      cache: "no-store",
    }
  );

  return res.json();
}

export default async function DebugApiPage() {
  const data = await getData();

  return (
    <main
      style={{
        padding: "24px",
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "monospace",
        lineHeight: 1.8,
      }}
    >
      <h1>DEBUG API</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
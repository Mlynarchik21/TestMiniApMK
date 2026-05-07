import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --bg: #000000;
              --bg-surface: #0a0a0a;
              --bg-card: rgba(255,255,255,0.04);
              --text: #f3f3f3;
              --text-main: rgba(255,255,255,0.96);
              --text-soft: rgba(255,255,255,0.78);
              --text-muted: rgba(255,255,255,0.60);
              --text-faint: rgba(255,255,255,0.42);
              --border: rgba(255,255,255,0.12);
              --border-soft: rgba(255,255,255,0.09);
              --border-hard: rgba(255,255,255,0.18);
              --green: #64d97b;
              --red: #ff6a6a;
              --blue: #8eb2ff;
              --yellow: #f3d709;
              --brand: #2979ff;
            }
            [data-theme="light"] {
              --bg: #f2f2f7;
              --bg-surface: #ffffff;
              --bg-card: rgba(0,0,0,0.03);
              --text: #111111;
              --text-main: rgba(0,0,0,0.96);
              --text-soft: rgba(0,0,0,0.76);
              --text-muted: rgba(0,0,0,0.55);
              --text-faint: rgba(0,0,0,0.38);
              --border: rgba(0,0,0,0.12);
              --border-soft: rgba(0,0,0,0.07);
              --border-hard: rgba(0,0,0,0.18);
              --green: #16a34a;
              --red: #dc2626;
              --blue: #2563eb;
              --yellow: #d97706;
              --brand: #1d4ed8;
            }
            html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
          `
        }} />
        {/* Apply theme from localStorage before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})()`
        }} />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#000" }}>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}

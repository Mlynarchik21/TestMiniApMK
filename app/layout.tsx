import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "TestMiniApMK",
  description: "Telegram Mini App",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* Подключаем официальный Telegram WebApp SDK */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#000",
        }}
      >
        {children}
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Mini App",
  description: "Start page"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

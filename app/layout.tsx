import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toduo",
  description: "Чат-портал с задачами для команды из двух человек",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}

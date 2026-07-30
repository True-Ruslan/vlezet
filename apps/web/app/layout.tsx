import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./editor-viewport.css";
import "./editor-shell.css";
import "./planning-exact-gap.css";

export const metadata: Metadata = {
  title: "Vlezet",
  description: "Точный планировщик квартиры — проверь, что влезет.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

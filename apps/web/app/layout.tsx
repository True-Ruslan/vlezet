import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./design-tokens.css";
import "./ui-primitives.css";
import "./globals.css";
import "./editor-viewport.css";
import "./editor-shell.css";
import "./context-panel.css";
import "./recognition-panel.css";
import "./design-system-migrations.css";
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

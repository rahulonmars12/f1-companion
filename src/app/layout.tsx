import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Companion",
  description: "Live Formula 1 race companion powered by OpenF1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-f1-dark text-white antialiased">{children}</body>
    </html>
  );
}

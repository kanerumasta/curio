import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curio — Make room for wonder",
  description: "A little spark for your next big thought. Explore 480 conversation-starting topics with Curio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

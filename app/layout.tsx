import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Switch Incident Command Center",
  description: "Chaos Dashboard and Switch Agent Bridge for Incident Monitoring with Sentry and Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-rose-500 selection:text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}

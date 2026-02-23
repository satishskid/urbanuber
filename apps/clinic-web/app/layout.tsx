import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skids Admin | Healthcare Aggregator",
  description: "Admin dashboard for Skids Healthcare Aggregator — monitor patients, providers, and service requests in real time.",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/patients", label: "Patients", icon: "👶" },
  { href: "/requests", label: "Service Requests", icon: "📋" },
  { href: "/providers", label: "Providers", icon: "🩺" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0f] text-gray-100`}
      >
        <div className="flex h-screen overflow-hidden">
          {/* ── Sidebar ──────────────────────────────────── */}
          <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-[#0d0d14] flex flex-col">
            <div className="p-6 border-b border-white/5">
              <h1 className="text-2xl font-black tracking-tight text-white">Skids</h1>
              <p className="text-xs text-gray-500 mt-0.5">Admin Console</p>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 px-3">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-sm">
                  👤
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-300">Admin</p>
                  <p className="text-[10px] text-gray-600">satish@skids.health</p>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main Content ─────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

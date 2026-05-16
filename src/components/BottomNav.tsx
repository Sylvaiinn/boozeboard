"use client";

import Link from "next/link";

const TABS = [
  { key: "log",   icon: "🍺", label: "Logger", href: (c: string) => `/soiree/${c}/log` },
  { key: "board", icon: "🏆", label: "Board",  href: (c: string) => `/soiree/${c}/board` },
  { key: "me",    icon: "👤", label: "Moi",    href: (c: string) => `/soiree/${c}/me` },
  { key: "recap", icon: "🎉", label: "Récap",  href: (c: string) => `/soiree/${c}/recap` },
  { key: "setup", icon: "👥", label: "Potes",  href: (c: string) => `/soiree/${c}/setup` },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function BottomNav({ code, active }: { code: string; active: TabKey }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex z-30">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href(code)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
              isActive ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

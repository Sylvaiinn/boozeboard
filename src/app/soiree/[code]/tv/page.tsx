"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, calculateBAC } from "@/lib/utils";
import type { Party, Participant, Drink, DrinkLog } from "@/types/database";

interface ParticipantStats {
  participant: Participant;
  totalDrinks: number;
  totalUnits: number;
  totalGrams: number;
  bac: number | null;
}

function computeStats(
  participants: Participant[],
  drinksMap: Map<string, Drink>,
  logs: DrinkLog[]
): ParticipantStats[] {
  const now = Date.now();
  return participants
    .map((p) => {
      const pLogs = logs.filter((l) => l.participant_id === p.id);
      let totalUnits = 0;
      let totalGrams = 0;
      for (const log of pLogs) {
        const drink = drinksMap.get(log.drink_id);
        if (!drink) continue;
        totalUnits += calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
        totalGrams += drink.volume_cl * 10 * (drink.alcohol_pct / 100) * 0.8;
      }
      let bac: number | null = null;
      if (p.weight_kg && p.sex && pLogs.length > 0) {
        const firstLog = [...pLogs].sort((a, b) =>
          (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
        )[0];
        const hours = (now - new Date(firstLog.logged_at ?? now).getTime()) / 3_600_000;
        bac = calculateBAC(totalGrams, p.weight_kg, p.sex as "M" | "F" | "other", hours);
      }
      return { participant: p, totalDrinks: pLogs.length, totalUnits, totalGrams, bac };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || b.totalDrinks - a.totalDrinks);
}

const MEDALS = ["🥇", "🥈", "🥉"];

const ROW_STYLES = [
  "border-yellow-400/40 bg-yellow-400/10 shadow-yellow-900/30",
  "border-zinc-400/40 bg-zinc-400/10 shadow-zinc-700/30",
  "border-amber-700/40 bg-amber-800/10 shadow-amber-900/30",
];

function bacColor(bac: number) {
  if (bac < 0.2) return "#4ade80";
  if (bac < 0.5) return "#facc15";
  if (bac < 0.8) return "#fb923c";
  return "#f87171";
}

// Bar showing drink count relative to leader
function DrinkBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export default function TvPage() {
  const { code } = useParams<{ code: string }>();
  const [party, setParty] = useState<Party | null>(null);
  const [stats, setStats] = useState<ParticipantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const participantIds = useRef<string[]>([]);
  const drinksMapRef = useRef<Map<string, Drink>>(new Map());
  const participantsRef = useRef<Participant[]>([]);

  const reloadLogs = useCallback(async () => {
    if (!participantIds.current.length) return;
    const { data } = await supabase
      .from("drink_logs")
      .select("*")
      .in("participant_id", participantIds.current)
      .order("logged_at");
    setStats(computeStats(participantsRef.current, drinksMapRef.current, data ?? []));
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties").select("*").eq("code", code).maybeSingle();
      if (!partyData) return;
      setParty(partyData);

      const [{ data: parts }, { data: preset }, { data: custom }] = await Promise.all([
        supabase.from("participants").select("*").eq("party_id", partyData.id).order("joined_at"),
        supabase.from("drinks").select("*").eq("is_preset", true),
        supabase.from("drinks").select("*").eq("party_id", partyData.id),
      ]);

      const map = new Map([...(preset ?? []), ...(custom ?? [])].map((d) => [d.id, d]));
      drinksMapRef.current = map;
      participantsRef.current = parts ?? [];
      participantIds.current = (parts ?? []).map((p) => p.id);

      if (participantIds.current.length) {
        const { data: logs } = await supabase
          .from("drink_logs").select("*")
          .in("participant_id", participantIds.current).order("logged_at");
        setStats(computeStats(parts ?? [], map, logs ?? []));
      }
      setLoading(false);
    }
    load();
  }, [code]);

  useEffect(() => {
    if (!party) return;
    const channel = supabase
      .channel(`tv-${party.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_logs" }, reloadLogs)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, async () => {
        const { data } = await supabase
          .from("participants").select("*").eq("party_id", party.id).order("joined_at");
        participantsRef.current = data ?? [];
        participantIds.current = (data ?? []).map((p) => p.id);
        reloadLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [party, reloadLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1b2a]">
        <p className="text-white/40 text-2xl font-bold tracking-widest animate-pulse">BOOZEBOARD</p>
      </div>
    );
  }

  const maxDrinks = Math.max(...stats.map((s) => s.totalDrinks), 1);
  const totalDrinks = stats.reduce((s, p) => s + p.totalDrinks, 0);
  const totalUnits = stats.reduce((s, p) => s + p.totalUnits, 0);
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="min-h-screen w-full flex flex-col select-none overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #1a2744 60%, #0d1b2a 100%)" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-black tracking-widest text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
            🍻 <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              BOOZEBOARD
            </span>
          </div>
          <div className="border border-white/20 rounded-lg px-3 py-1">
            <span className="text-amber-400 font-mono font-bold tracking-widest text-lg">{code}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div className="text-center">
            <p className="text-3xl font-black text-amber-400">{totalDrinks}</p>
            <p className="text-white/40 text-xs uppercase tracking-wider">verres</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-amber-400">{totalUnits.toFixed(1)}</p>
            <p className="text-white/40 text-xs uppercase tracking-wider">unités</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${pulse ? "bg-amber-300" : "bg-green-400"} transition-colors duration-200`} />
            <span className="text-white/40 text-sm font-mono">{now}</span>
          </div>
        </div>
      </header>

      {/* Subtitle */}
      {party?.name && (
        <p className="px-8 text-white/30 text-sm font-medium tracking-wide mb-2">
          {party.name}{party.location ? ` · 📍 ${party.location}` : ""}
        </p>
      )}

      {/* Leaderboard */}
      <div className="flex-1 px-8 pb-6 flex flex-col gap-3">
        {stats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-7xl">🫗</p>
              <p className="text-white/30 text-2xl font-bold">En attente de consommations...</p>
              <p className="text-white/20 text-base">Rejoins sur <span className="text-amber-400 font-mono">{code}</span></p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {stats.map((s, i) => {
              const isTop3 = i < 3;
              const barPct = maxDrinks > 0 ? (s.totalDrinks / maxDrinks) * 100 : 0;

              return (
                <motion.div
                  key={s.participant.id}
                  layout
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{
                    layout: { type: "spring", stiffness: 350, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className={`
                    flex items-center gap-5 rounded-2xl border px-6 py-4 shadow-lg backdrop-blur-sm
                    ${isTop3 ? ROW_STYLES[i] : "border-white/10 bg-white/5"}
                  `}
                >
                  {/* Rank */}
                  <div className="w-16 text-center flex-shrink-0">
                    {isTop3 ? (
                      <span className="text-4xl">{MEDALS[i]}</span>
                    ) : (
                      <span className="text-2xl font-black text-white/30">#{i + 1}</span>
                    )}
                  </div>

                  {/* Avatar emoji */}
                  <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-4xl flex-shrink-0
                    ${isTop3 ? "bg-white/15 border border-white/20" : "bg-white/5"}
                  `}>
                    {s.participant.emoji ?? "🍺"}
                  </div>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className={`font-black truncate leading-tight ${isTop3 ? "text-3xl text-white" : "text-2xl text-white/80"}`}>
                      {s.participant.name}
                    </p>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-white/30 text-sm flex-shrink-0">
                        {s.totalDrinks} verre{s.totalDrinks > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 flex-shrink-0 text-right">
                    {s.bac !== null && (
                      <div>
                        <p className="text-xl font-bold" style={{ color: bacColor(s.bac) }}>
                          {s.bac.toFixed(2)}
                        </p>
                        <p className="text-white/30 text-xs">g/L</p>
                      </div>
                    )}
                    <div>
                      <p className={`font-black ${isTop3 ? "text-4xl text-amber-300" : "text-3xl text-amber-400/80"}`}>
                        {s.totalUnits.toFixed(1)}
                      </p>
                      <p className="text-white/30 text-xs uppercase tracking-wide">unités</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <footer className="px-8 pb-4 flex items-center justify-between text-white/20 text-xs">
        <span>boozeboard.sl-information.fr · rejoindre : <span className="text-amber-400/50 font-mono">{code}</span></span>
        <span>⚠️ Alcoolémies estimées — indicatif uniquement — ne conduisez pas</span>
      </footer>
    </div>
  );
}

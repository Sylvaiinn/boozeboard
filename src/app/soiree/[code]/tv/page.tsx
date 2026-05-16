"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, calculateBAC } from "@/lib/utils";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import type { Party, Participant, Drink, DrinkLog, VomitLog } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParticipantStats {
  participant: Participant;
  totalDrinks: number;
  totalUnits: number;
  totalGrams: number;
  bac: number | null;
  vomitCount: number;
}

// ─── Compute ──────────────────────────────────────────────────────────────────

function computeStats(
  participants: Participant[],
  drinksMap: Map<string, Drink>,
  logs: DrinkLog[],
  vomitLogs: VomitLog[]
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
        const first = [...pLogs].sort((a, b) =>
          (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
        )[0];
        const hours = (now - new Date(first.logged_at ?? now).getTime()) / 3_600_000;
        bac = calculateBAC(totalGrams, p.weight_kg, p.sex as "M" | "F" | "other", hours);
      }
      const vomitCount = vomitLogs.filter((v) => v.participant_id === p.id).length;
      return { participant: p, totalDrinks: pLogs.length, totalUnits, totalGrams, bac, vomitCount };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || b.totalDrinks - a.totalDrinks);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bacColor(bac: number) {
  if (bac < 0.2) return "#4ade80";
  if (bac < 0.5) return "#facc15";
  if (bac < 0.8) return "#fb923c";
  return "#f87171";
}

// ─── Podium ───────────────────────────────────────────────────────────────────

interface PodiumSlotProps {
  stats: ParticipantStats;
  rank: 1 | 2 | 3;
}

function PodiumSlot({ stats: s, rank }: PodiumSlotProps) {
  const isFirst = rank === 1;
  const heights = { 1: "h-24", 2: "h-16", 3: "h-12" };
  const avatarSizes = { 1: "w-24 h-24 text-6xl", 2: "w-18 h-18 text-5xl", 3: "w-16 h-16 text-4xl" };
  const nameSizes = { 1: "text-2xl", 2: "text-xl", 3: "text-lg" };
  const scoreColors = { 1: "text-amber-300", 2: "text-zinc-300", 3: "text-amber-700/80" };
  const podiumColors = {
    1: "bg-gradient-to-b from-amber-400/30 to-amber-600/10 border-amber-400/40",
    2: "bg-gradient-to-b from-zinc-400/20 to-zinc-600/10 border-zinc-400/30",
    3: "bg-gradient-to-b from-amber-800/20 to-amber-900/10 border-amber-800/30",
  };
  const glowColors = {
    1: "shadow-[0_0_40px_rgba(251,191,36,0.25)]",
    2: "shadow-[0_0_20px_rgba(161,161,170,0.15)]",
    3: "shadow-[0_0_20px_rgba(180,83,9,0.15)]",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center gap-3 ${isFirst ? "mt-0" : "mt-8"}`}
    >
      {/* Crown for #1 */}
      {isFirst && (
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="text-4xl"
        >
          👑
        </motion.div>
      )}

      {/* Avatar */}
      <div className={`
        ${avatarSizes[rank]} rounded-full flex items-center justify-center
        border-2 backdrop-blur-sm overflow-hidden
        ${podiumColors[rank]} ${glowColors[rank]}
      `}>
        <ParticipantAvatar
          participant={s.participant}
          size={rank === 1 ? "2xl" : rank === 2 ? "xl" : "lg"}
          className="border-0"
        />
      </div>

      {/* Name + score */}
      <div className="text-center space-y-1">
        <p className={`font-black text-white leading-tight ${nameSizes[rank]} drop-shadow`}>
          {s.participant.name}
        </p>
        <p className={`font-black ${scoreColors[rank]} ${isFirst ? "text-3xl" : "text-2xl"}`}>
          {s.totalUnits.toFixed(1)}
          <span className="text-sm font-normal text-white/40 ml-1">u</span>
        </p>
        <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
          <span>🍺 {s.totalDrinks}</span>
          {s.vomitCount > 0 && <span className="text-red-400">🤮 {s.vomitCount}</span>}
          {s.bac !== null && (
            <span style={{ color: bacColor(s.bac) }}>{s.bac.toFixed(2)} g/L</span>
          )}
        </div>
      </div>

      {/* Podium block */}
      <div className={`
        w-full ${heights[rank]} rounded-t-2xl border backdrop-blur-sm
        ${podiumColors[rank]} ${glowColors[rank]}
        flex items-center justify-center
      `}>
        <span className="font-black text-white/30 text-4xl">#{rank}</span>
      </div>
    </motion.div>
  );
}

// ─── VomitStrip ───────────────────────────────────────────────────────────────

interface VomitEntry {
  log: VomitLog;
  participant: Participant;
}

function VomitStrip({ entries }: { entries: VomitEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="border-t border-white/10 px-8 py-4 flex items-center gap-6 overflow-x-hidden flex-shrink-0">
      <div className="flex-shrink-0 space-y-0.5 w-16">
        <p className="text-white/25 text-[11px] font-black uppercase tracking-widest leading-tight">🤮 Hall</p>
        <p className="text-white/25 text-[11px] font-black uppercase tracking-widest leading-tight">of Shame</p>
      </div>
      <div className="flex gap-4 overflow-x-auto">
        {entries.map((e) => (
          <motion.div
            key={e.log.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 flex flex-col items-center gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.log.photo_url}
              alt="Preuve"
              className="w-44 h-36 rounded-2xl object-cover border-2 border-red-800/60 shadow-xl shadow-red-950/50"
            />
            <div className="text-center">
              <p className="text-white/75 text-sm font-bold leading-tight">
                {e.participant.emoji} {e.participant.name}
              </p>
              <p className="text-red-400/50 text-xs">
                {new Date(e.log.logged_at ?? "").toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TvPage() {
  const { code } = useParams<{ code: string }>();
  const [party, setParty] = useState<Party | null>(null);
  const [stats, setStats] = useState<ParticipantStats[]>([]);
  const [vomitEntries, setVomitEntries] = useState<VomitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [clock, setClock] = useState("");

  const participantIds = useRef<string[]>([]);
  const drinksMapRef = useRef<Map<string, Drink>>(new Map());
  const participantsRef = useRef<Participant[]>([]);

  // Clock
  useEffect(() => {
    function tick() {
      setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  const reloadAll = useCallback(async () => {
    if (!participantIds.current.length) return;
    const ids = participantIds.current;
    const [{ data: drinkData }, { data: vomitData }] = await Promise.all([
      supabase.from("drink_logs").select("*").in("participant_id", ids).order("logged_at"),
      supabase.from("vomit_logs").select("*").in("participant_id", ids).order("logged_at"),
    ]);
    const vomits = vomitData ?? [];
    setStats(computeStats(participantsRef.current, drinksMapRef.current, drinkData ?? [], vomits));
    // Build VomitEntry[]
    const participantMap = new Map(participantsRef.current.map((p) => [p.id, p]));
    setVomitEntries(
      vomits
        .map((v) => ({ log: v, participant: participantMap.get(v.participant_id)! }))
        .filter((e) => e.participant)
    );
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

      if (participantIds.current.length) await reloadAll();
      setLoading(false);
    }
    load();
  }, [code, reloadAll]);

  useEffect(() => {
    if (!party) return;
    const channel = supabase
      .channel(`tv2-${party.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_logs" }, reloadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "vomit_logs" }, reloadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, async () => {
        const { data } = await supabase
          .from("participants").select("*").eq("party_id", party.id).order("joined_at");
        participantsRef.current = data ?? [];
        participantIds.current = (data ?? []).map((p) => p.id);
        reloadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [party, reloadAll]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
      >
        <p className="text-white/40 text-3xl font-black tracking-widest animate-pulse">BOOZEBOARD</p>
      </div>
    );
  }

  const totalDrinks = stats.reduce((s, p) => s + p.totalDrinks, 0);
  const totalUnits = stats.reduce((s, p) => s + p.totalUnits, 0);
  const totalVomits = vomitEntries.length;

  // Podium order: [2nd, 1st, 3rd]
  const first = stats[0] ?? null;
  const second = stats[1] ?? null;
  const third = stats[2] ?? null;
  const rest = stats.slice(3);

  return (
    <div
      className="min-h-screen w-full flex flex-col select-none overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 pt-5 pb-3 flex-shrink-0">
        {/* Left: logo + party */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black tracking-widest">
              🍻 <span
                className="bg-gradient-to-r from-violet-300 to-amber-300 bg-clip-text text-transparent"
              >BOOZEBOARD</span>
            </span>
            <div className="border border-white/20 rounded-lg px-2.5 py-0.5">
              <span className="text-amber-400 font-mono font-bold tracking-widest text-base">{code}</span>
            </div>
          </div>
          {party?.name && (
            <p className="text-white/30 text-sm">
              {party.name}{party.location ? ` · 📍 ${party.location}` : ""}
            </p>
          )}
        </div>

        {/* Right: global stats + live */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-black text-amber-300">{totalDrinks}</p>
            <p className="text-white/30 text-xs uppercase tracking-wider">verres</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-amber-300">{totalUnits.toFixed(1)}</p>
            <p className="text-white/30 text-xs uppercase tracking-wider">unités</p>
          </div>
          {totalVomits > 0 && (
            <div className="text-center">
              <p className="text-3xl font-black text-red-400">{totalVomits}</p>
              <p className="text-white/30 text-xs uppercase tracking-wider">vomi{totalVomits > 1 ? "s" : ""}</p>
            </div>
          )}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className={`w-2 h-2 rounded-full ${pulse ? "bg-amber-300" : "bg-emerald-400"} transition-colors duration-300`} />
            <span className="text-white/30 text-sm font-mono">{clock}</span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden px-8 gap-4 pb-2">
        {stats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-8xl">🫗</p>
              <p className="text-white/30 text-3xl font-black">En attente de consommations...</p>
              <p className="text-white/20 text-lg">
                Rejoins sur <span className="text-amber-400 font-mono">{code}</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Podium (top 3) ── */}
            {first && (
              <div className="flex items-end justify-center gap-6 flex-shrink-0">
                {second && <div className="w-48"><PodiumSlot stats={second} rank={2} /></div>}
                <div className="w-56"><PodiumSlot stats={first} rank={1} /></div>
                {third && <div className="w-44"><PodiumSlot stats={third} rank={3} /></div>}
              </div>
            )}

            {/* ── Full ranked list (all players) ── */}
            {stats.length > 1 && (
              <div className="flex-1 overflow-hidden">
                <div
                  className="rounded-2xl border border-white/10 overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}
                >
                  {/* List header */}
                  <div className="grid grid-cols-[3rem_3.5rem_1fr_5rem_6rem_5rem] gap-2 px-5 py-2 border-b border-white/10">
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold">#</p>
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold"></p>
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold">Nom</p>
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold text-right">Verres</p>
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold text-right">Unités</p>
                    <p className="text-white/20 text-xs uppercase tracking-wider font-bold text-right">Alcoolémie</p>
                  </div>

                  {/* Rows */}
                  <AnimatePresence mode="popLayout">
                    {stats.map((s, i) => {
                      const rankColors = [
                        "text-amber-300",
                        "text-zinc-300",
                        "text-amber-700",
                      ];
                      const rowBg = i === 0
                        ? "bg-amber-400/5 border-b border-amber-400/10"
                        : i === 1
                          ? "bg-zinc-400/5 border-b border-white/5"
                          : "border-b border-white/5";

                      return (
                        <motion.div
                          key={s.participant.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ layout: { type: "spring", stiffness: 400, damping: 35 } }}
                          className={`grid grid-cols-[3rem_3.5rem_1fr_5rem_6rem_5rem] gap-2 px-5 py-2.5 items-center ${rowBg}`}
                        >
                          {/* Rank */}
                          <span className={`font-black text-xl ${rankColors[i] ?? "text-white/25"}`}>
                            #{i + 1}
                          </span>

                          {/* Avatar */}
                          <ParticipantAvatar
                            participant={s.participant}
                            size="md"
                            className="bg-white/10 border border-white/10"
                          />

                          {/* Name + vomit badge */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-black truncate ${i < 3 ? "text-white text-xl" : "text-white/70 text-lg"}`}>
                              {s.participant.name}
                            </span>
                            {s.vomitCount > 0 && (
                              <span className="flex-shrink-0 bg-red-950/60 border border-red-900/50 text-red-400 text-xs font-bold px-1.5 py-0.5 rounded-lg">
                                🤮×{s.vomitCount}
                              </span>
                            )}
                          </div>

                          {/* Verres */}
                          <div className="text-right">
                            <span className="text-white/60 font-bold text-lg">{s.totalDrinks}</span>
                            <span className="text-white/20 text-sm ml-1">🍺</span>
                          </div>

                          {/* Units */}
                          <div className="text-right">
                            <span className={`font-black text-xl ${i === 0 ? "text-amber-300" : "text-white/80"}`}>
                              {s.totalUnits.toFixed(1)}
                            </span>
                            <span className="text-white/20 text-sm ml-1">u</span>
                          </div>

                          {/* BAC */}
                          <div className="text-right">
                            {s.bac !== null ? (
                              <span className="font-bold text-base" style={{ color: bacColor(s.bac) }}>
                                {s.bac.toFixed(2)} g/L
                              </span>
                            ) : (
                              <span className="text-white/15 text-sm">—</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Vomit Strip ── */}
      <VomitStrip entries={vomitEntries} />

      {/* ── Footer ── */}
      <footer className="px-8 py-2 flex items-center justify-between text-white/15 text-xs flex-shrink-0">
        <span>boozeboard.sl-information.fr · {code}</span>
        <span>⚠️ Alcoolémies estimées — ne conduisez pas</span>
      </footer>
    </div>
  );
}

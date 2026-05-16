"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, calculateBAC, cn } from "@/lib/utils";
import type { Party, Participant, Drink, DrinkLog } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParticipantStats {
  participant: Participant;
  totalDrinks: number;
  totalUnits: number;
  totalGrams: number;
  bac: number | null;
  favoriteDrink: Drink | null;
  logsLastHour: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(
  participants: Participant[],
  drinksMap: Map<string, Drink>,
  logs: DrinkLog[]
): ParticipantStats[] {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  return participants
    .map((p) => {
      const pLogs = logs.filter((l) => l.participant_id === p.id);

      let totalUnits = 0;
      let totalGrams = 0;
      const drinkCounts: Record<string, number> = {};

      for (const log of pLogs) {
        const drink = drinksMap.get(log.drink_id);
        if (!drink) continue;
        const units = calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
        totalUnits += units;
        totalGrams += drink.volume_cl * 10 * (drink.alcohol_pct / 100) * 0.8;
        drinkCounts[drink.id] = (drinkCounts[drink.id] ?? 0) + 1;
      }

      const favDrinkId = Object.entries(drinkCounts).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0];
      const favoriteDrink = favDrinkId ? (drinksMap.get(favDrinkId) ?? null) : null;

      const logsLastHour = pLogs.filter((l) => {
        const t = l.logged_at ? new Date(l.logged_at).getTime() : 0;
        return t > oneHourAgo;
      }).length;

      let bac: number | null = null;
      if (p.weight_kg && p.sex && pLogs.length > 0) {
        const firstLog = [...pLogs].sort((a, b) =>
          (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
        )[0];
        const hoursSinceFirst =
          (now - new Date(firstLog.logged_at ?? now).getTime()) / 3_600_000;
        bac = calculateBAC(
          totalGrams,
          p.weight_kg,
          p.sex as "M" | "F" | "other",
          hoursSinceFirst
        );
      }

      return {
        participant: p,
        totalDrinks: pLogs.length,
        totalUnits,
        totalGrams,
        bac,
        favoriteDrink,
        logsLastHour,
      };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || b.totalDrinks - a.totalDrinks);
}

function bacColor(bac: number): string {
  if (bac < 0.2) return "text-green-400";
  if (bac < 0.5) return "text-yellow-400";
  if (bac < 0.8) return "text-orange-400";
  return "text-red-400";
}

const RANK_STYLE = [
  "border-yellow-500/60 bg-yellow-950/40 shadow-yellow-900/20",
  "border-zinc-500/60 bg-zinc-800/40 shadow-zinc-700/20",
  "border-amber-700/60 bg-amber-950/40 shadow-amber-900/20",
];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899"];

// ─── ParticipantCard ──────────────────────────────────────────────────────────

function ParticipantCard({ stats, rank }: { stats: ParticipantStats; rank: number }) {
  const { participant: p, totalDrinks, totalUnits, bac, favoriteDrink, logsLastHour } = stats;
  const isTop3 = rank <= 3;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-lg transition-all",
        isTop3
          ? RANK_STYLE[rank - 1]
          : "border-zinc-800 bg-zinc-900/60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank + emoji */}
        <div className="flex flex-col items-center gap-1 min-w-[48px]">
          <span className="text-2xl">
            {rank <= 3 ? RANK_MEDALS[rank - 1] : `#${rank}`}
          </span>
          <span className="text-3xl">{p.emoji ?? "🍺"}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-xl leading-tight truncate">
            {p.name}
          </p>

          {/* Main stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <span className="text-amber-400 font-bold text-lg">
              {totalUnits.toFixed(1)}
              <span className="text-zinc-500 text-sm font-normal ml-1">unités</span>
            </span>
            <span className="text-zinc-300 font-semibold text-lg">
              {totalDrinks}
              <span className="text-zinc-500 text-sm font-normal ml-1">
                verre{totalDrinks > 1 ? "s" : ""}
              </span>
            </span>
          </div>

          {/* Secondary stats */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-sm">
            {bac !== null && (
              <span className={cn("font-semibold", bacColor(bac))}>
                ~{bac.toFixed(2)} g/L
              </span>
            )}
            {logsLastHour > 0 && (
              <span className="text-zinc-500">
                ⚡ {logsLastHour}/h
              </span>
            )}
            {favoriteDrink && (
              <span className="text-zinc-500">
                {favoriteDrink.emoji ?? "🍺"} {favoriteDrink.name}
              </span>
            )}
          </div>
        </div>

        {/* Rank number large (TV) */}
        {isTop3 && (
          <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-full bg-zinc-950/50 border border-zinc-700/50">
            <span className="text-2xl font-black text-zinc-400">#{rank}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DrinkPieChart ────────────────────────────────────────────────────────────

function DrinkPieChart({
  logs,
  drinksMap,
}: {
  logs: DrinkLog[];
  drinksMap: Map<string, Drink>;
}) {
  const counts: Record<string, { name: string; emoji: string; value: number }> = {};

  for (const log of logs) {
    const drink = drinksMap.get(log.drink_id);
    if (!drink) continue;
    if (!counts[drink.id]) {
      counts[drink.id] = { name: drink.name, emoji: drink.emoji ?? "🍺", value: 0 };
    }
    counts[drink.id].value++;
  }

  const data = Object.values(counts)
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (data.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-zinc-300 text-sm uppercase tracking-wider">
        Répartition des boissons
      </h3>

      {/* Donut chart — hauteur fixe, pas de légende intégrée */}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "12px",
              color: "#fafafa",
              fontSize: "13px",
            }}
            formatter={(value, name) => [
              `${value} verre${Number(value) > 1 ? "s" : ""}`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Légende HTML — wrap propre sur mobile */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="text-xs text-zinc-400 truncate">{item.name}</span>
            <span className="text-xs text-zinc-600 flex-shrink-0">({item.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const { code } = useParams<{ code: string }>();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drinksMap, setDrinksMap] = useState<Map<string, Drink>>(new Map());
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [stats, setStats] = useState<ParticipantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const participantIds = useRef<string[]>([]);

  // Reload logs from Supabase
  const reloadLogs = useCallback(async () => {
    if (!participantIds.current.length) return;
    const { data } = await supabase
      .from("drink_logs")
      .select("*")
      .in("participant_id", participantIds.current)
      .order("logged_at");
    setLogs(data ?? []);
    setLastUpdate(new Date());
  }, []);

  // Initial load
  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (!partyData) return;
      setParty(partyData);

      const [{ data: participantsData }, { data: presetDrinks }, { data: customDrinks }] =
        await Promise.all([
          supabase
            .from("participants")
            .select("*")
            .eq("party_id", partyData.id)
            .order("joined_at"),
          supabase.from("drinks").select("*").eq("is_preset", true),
          supabase.from("drinks").select("*").eq("party_id", partyData.id),
        ]);

      const allDrinks = [...(presetDrinks ?? []), ...(customDrinks ?? [])];
      const map = new Map(allDrinks.map((d) => [d.id, d]));
      setDrinksMap(map);

      const parts = participantsData ?? [];
      setParticipants(parts);
      participantIds.current = parts.map((p) => p.id);

      if (parts.length > 0) {
        const { data: logsData } = await supabase
          .from("drink_logs")
          .select("*")
          .in("participant_id", parts.map((p) => p.id))
          .order("logged_at");
        setLogs(logsData ?? []);
      }

      setLoading(false);
    }

    load();
  }, [code]);

  // Realtime subscription
  useEffect(() => {
    if (!party) return;

    const channel = supabase
      .channel(`board-${party.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drink_logs" },
        () => { reloadLogs(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        async () => {
          const { data } = await supabase
            .from("participants")
            .select("*")
            .eq("party_id", party.id)
            .order("joined_at");
          const parts = data ?? [];
          setParticipants(parts);
          participantIds.current = parts.map((p) => p.id);
          reloadLogs();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [party, reloadLogs]);

  // Recompute stats when data changes
  useEffect(() => {
    setStats(computeStats(participants, drinksMap, logs));
  }, [participants, drinksMap, logs]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-zinc-400 text-xl">Chargement du board...</div>
      </main>
    );
  }

  const totalDrinks = logs.length;
  const totalUnits = stats.reduce((s, p) => s + p.totalUnits, 0);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="font-black text-2xl sm:text-3xl text-white leading-tight">
              {party?.name}
            </h1>
            <span className="text-amber-400 font-mono text-sm tracking-widest">{code}</span>
          </div>

          {/* Global stats */}
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-2xl font-black text-amber-400">{totalDrinks}</p>
              <p className="text-xs text-zinc-500">verres</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400">{totalUnits.toFixed(1)}</p>
              <p className="text-xs text-zinc-500">unités</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Link
                href={`/soiree/${code}/tv`}
                target="_blank"
                className="text-xs bg-zinc-700 border border-zinc-600 text-zinc-200 font-bold rounded-lg px-3 py-1.5 hover:bg-zinc-600 transition-colors"
              >
                📺 TV
              </Link>
              <Link
                href={`/soiree/${code}/log`}
                className="text-xs bg-amber-400 text-zinc-900 font-bold rounded-lg px-3 py-1.5 hover:bg-amber-300 transition-colors"
              >
                🍺 Logger
              </Link>
            </div>
            <span className="text-zinc-600 text-xs">
              {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Leaderboard */}
        {stats.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="text-6xl">🍺</div>
            <p className="text-zinc-400 text-xl font-semibold">
              Aucune conso pour le moment
            </p>
            <p className="text-zinc-600 text-sm">
              Commence à logger depuis ton téléphone !
            </p>
            <Link
              href={`/soiree/${code}/log`}
              className="inline-block mt-4 bg-amber-400 text-zinc-900 font-bold rounded-xl px-6 py-3 hover:bg-amber-300 transition-colors"
            >
              Logger la première conso
            </Link>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              Classement
            </h2>
            <AnimatePresence mode="popLayout">
              {stats.map((s, i) => (
                <motion.div
                  key={s.participant.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    layout: { type: "spring", stiffness: 400, damping: 35 },
                    opacity: { duration: 0.2 },
                  }}
                >
                  <ParticipantCard stats={s} rank={i + 1} />
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        )}

        {/* Pie chart */}
        {logs.length > 0 && (
          <DrinkPieChart logs={logs} drinksMap={drinksMap} />
        )}

        {/* BAC Disclaimer */}
        {stats.some((s) => s.bac !== null) && (
          <div className="border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-500 text-center leading-relaxed">
            ⚠️ Les alcoolémies affichées sont des <strong className="text-zinc-400">estimations indicatives</strong> basées sur la formule de Widmark. Elles ne reflètent pas votre alcoolémie réelle.
            Ne conduisez pas après avoir bu. Limite légale en France : <strong className="text-zinc-400">0,5 g/L</strong> (0,2 g/L jeune permis).
          </div>
        )}

        {/* Nav */}
        <nav className="flex gap-3 pt-2">
          <Link
            href={`/soiree/${code}/log`}
            className="flex-1 text-center bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            🍺 Logger
          </Link>
          <Link
            href={`/soiree/${code}/setup`}
            className="flex-1 text-center bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            👥 Participants
          </Link>
          <Link
            href={`/soiree/${code}/recap`}
            className="flex-1 text-center bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            🎉 Récap
          </Link>
        </nav>
      </div>
    </main>
  );
}

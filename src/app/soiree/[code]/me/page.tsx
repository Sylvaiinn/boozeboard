"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, calculateBAC, cn } from "@/lib/utils";
import type { Party, Participant, Drink, DrinkLog } from "@/types/database";

// ─── Badges ───────────────────────────────────────────────────────────────────

interface Badge {
  emoji: string;
  name: string;
  desc: string;
}

function computeBadges(logs: DrinkLog[], drinksMap: Map<string, Drink>): Badge[] {
  const badges: Badge[] = [];

  if (logs.length === 0) return badges;

  // Nombre de verres
  if (logs.length >= 1) badges.push({ emoji: "🎯", name: "Premier verre", desc: "Le voyage commence !" });
  if (logs.length >= 5) badges.push({ emoji: "🔥", name: "Régulier", desc: "5 verres au compteur" });
  if (logs.length >= 10) badges.push({ emoji: "🏆", name: "Marathonien", desc: "10 verres, chapeau." });
  if (logs.length >= 15) badges.push({ emoji: "🌋", name: "Volcanique", desc: "15 verres... on est inquiets." });

  // Diversité
  const uniqueDrinks = new Set(logs.map((l) => l.drink_id)).size;
  if (uniqueDrinks >= 3) badges.push({ emoji: "🌈", name: "Diversifié", desc: "3+ boissons différentes" });
  if (uniqueDrinks >= 5) badges.push({ emoji: "🎨", name: "Curieux", desc: "5+ boissons goûtées" });

  // Sobre
  const allSoft = logs.every((l) => {
    const d = drinksMap.get(l.drink_id);
    return d?.alcohol_pct === 0;
  });
  if (allSoft) badges.push({ emoji: "💧", name: "Sobre", desc: "Que des softs, respect." });

  // Sprinter : 3 verres en 30 min
  const sorted = [...logs].sort((a, b) =>
    (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
  );
  if (sorted.length >= 3) {
    for (let i = 0; i <= sorted.length - 3; i++) {
      const t1 = new Date(sorted[i].logged_at ?? 0).getTime();
      const t3 = new Date(sorted[i + 2].logged_at ?? 0).getTime();
      if (t3 - t1 <= 30 * 60 * 1000) {
        badges.push({ emoji: "⚡", name: "Sprinter", desc: "3 verres en 30 minutes" });
        break;
      }
    }
  }

  // Tournée
  if (logs.some((l) => l.round_id !== null)) {
    badges.push({ emoji: "🥂", name: "Tournée royale", desc: "A participé à une tournée" });
  }

  // Shot lover
  const shots = logs.filter((l) => {
    const d = drinksMap.get(l.drink_id);
    return d && d.volume_cl <= 4 && d.alcohol_pct >= 30;
  });
  if (shots.length >= 3) badges.push({ emoji: "🥃", name: "Shot lover", desc: "3+ shots dans la soirée" });

  return badges;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bacColor(bac: number): string {
  if (bac < 0.2) return "text-green-400";
  if (bac < 0.5) return "text-yellow-400";
  if (bac < 0.8) return "text-orange-400";
  return "text-red-400";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MePage() {
  const { code } = useParams<{ code: string }>();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [drinksMap, setDrinksMap] = useState<Map<string, Drink>>(new Map());
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (!partyData) return;
      setParty(partyData);

      const [{ data: parts }, { data: preset }, { data: custom }] = await Promise.all([
        supabase.from("participants").select("*").eq("party_id", partyData.id).order("joined_at"),
        supabase.from("drinks").select("*").eq("is_preset", true),
        supabase.from("drinks").select("*").eq("party_id", partyData.id),
      ]);

      const map = new Map([...(preset ?? []), ...(custom ?? [])].map((d) => [d.id, d]));
      setDrinksMap(map);
      setParticipants(parts ?? []);
      if (parts?.length) setSelected(parts[0]);
      setLoading(false);
    }
    load();
  }, [code]);

  useEffect(() => {
    if (!selected) return;
    supabase
      .from("drink_logs")
      .select("*")
      .eq("participant_id", selected.id)
      .order("logged_at")
      .then(({ data }) => setLogs(data ?? []));
  }, [selected]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-lg">Chargement...</div>
      </main>
    );
  }

  // Compute stats
  let totalUnits = 0;
  let totalGrams = 0;
  for (const log of logs) {
    const d = drinksMap.get(log.drink_id);
    if (!d) continue;
    totalUnits += calculateAlcoholUnits(d.volume_cl, d.alcohol_pct);
    totalGrams += d.volume_cl * 10 * (d.alcohol_pct / 100) * 0.8;
  }

  let bac: number | null = null;
  if (selected?.weight_kg && selected?.sex && logs.length > 0) {
    const firstLog = logs[0];
    const hoursSince =
      (Date.now() - new Date(firstLog.logged_at ?? Date.now()).getTime()) / 3_600_000;
    bac = calculateBAC(
      totalGrams,
      selected.weight_kg,
      selected.sex as "M" | "F" | "other",
      hoursSince
    );
  }

  const badges = selected ? computeBadges(logs, drinksMap) : [];

  // Pace : verres / dernière heure
  const oneHourAgo = Date.now() - 3_600_000;
  const lastHourCount = logs.filter(
    (l) => new Date(l.logged_at ?? 0).getTime() > oneHourAgo
  ).length;

  // Favorite drink
  const drinkCounts: Record<string, number> = {};
  for (const log of logs) drinkCounts[log.drink_id] = (drinkCounts[log.drink_id] ?? 0) + 1;
  const favDrinkId = Object.entries(drinkCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
  const favDrink = favDrinkId ? drinksMap.get(favDrinkId) : null;

  return (
    <main className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-white text-base">Mes stats</h1>
            <span className="text-amber-400 font-mono text-xs tracking-widest">{code}</span>
          </div>
          <Link
            href={`/soiree/${code}/board`}
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors"
          >
            📺 Board
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* Participant selector */}
        <section>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-semibold">C&apos;est qui toi ?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "flex flex-col items-center gap-1 min-w-[72px] py-3 px-2 rounded-xl border transition-all flex-shrink-0 active:scale-95",
                  selected?.id === p.id
                    ? "bg-amber-400 border-amber-300 text-zinc-900"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                )}
              >
                <span className="text-2xl">{p.emoji ?? "🍺"}</span>
                <span className="text-xs font-bold truncate max-w-[68px]">{p.name}</span>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">{logs.length}</p>
                <p className="text-xs text-zinc-500 mt-1">verre{logs.length > 1 ? "s" : ""}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">{totalUnits.toFixed(1)}</p>
                <p className="text-xs text-zinc-500 mt-1">unités d&apos;alcool</p>
              </div>
              {bac !== null && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <p className={cn("text-3xl font-black", bacColor(bac))}>
                    {bac.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">g/L estimé ⚠️</p>
                </div>
              )}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-zinc-300">{lastHourCount}</p>
                <p className="text-xs text-zinc-500 mt-1">dernier/heure</p>
              </div>
              {favDrink && (
                <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-4xl">{favDrink.emoji ?? "🍺"}</span>
                  <div>
                    <p className="font-bold text-white">{favDrink.name}</p>
                    <p className="text-xs text-zinc-500">boisson favorite ({drinkCounts[favDrink.id]}x)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Badges */}
            {badges.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Badges débloqués ({badges.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {badges.map((b) => (
                    <div
                      key={b.name}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 flex items-center gap-3"
                    >
                      <span className="text-2xl flex-shrink-0">{b.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{b.name}</p>
                        <p className="text-xs text-zinc-500 leading-tight">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Historique */}
            <section className="space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Historique ({logs.length})
              </p>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-zinc-600">
                  <p className="text-4xl mb-2">🫗</p>
                  <p>Pas encore de conso</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...logs].reverse().map((log) => {
                    const drink = drinksMap.get(log.drink_id);
                    if (!drink) return null;
                    const units = calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                      >
                        <span className="text-xl">{drink.emoji ?? "🍺"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{drink.name}</p>
                          {log.note && <p className="text-xs text-zinc-500">{log.note}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-amber-400 text-sm font-bold">
                            {drink.alcohol_pct === 0 ? "—" : `${units.toFixed(1)}u`}
                          </p>
                          <p className="text-zinc-600 text-xs">{formatTime(log.logged_at)}</p>
                        </div>
                        {log.round_id && (
                          <span className="text-xs text-zinc-600" title="Tournée">🥂</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* BAC disclaimer */}
            {bac !== null && (
              <div className="border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-500 text-center leading-relaxed">
                ⚠️ Alcoolémie <strong className="text-zinc-400">estimée</strong> via formule de Widmark. Ne reflète pas votre alcoolémie réelle. Ne conduisez pas. Limite légale : <strong className="text-zinc-400">0,5 g/L</strong>.
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex z-30">
        <Link href={`/soiree/${code}/log`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">🍺</span>
          <span className="text-xs font-medium">Logger</span>
        </Link>
        <Link href={`/soiree/${code}/board`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">🏆</span>
          <span className="text-xs font-medium">Board</span>
        </Link>
        <Link href={`/soiree/${code}/me`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-amber-400">
          <span className="text-xl">👤</span>
          <span className="text-xs font-semibold">Moi</span>
        </Link>
        <Link href={`/soiree/${code}/setup`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">👥</span>
          <span className="text-xs font-medium">Potes</span>
        </Link>
      </nav>
    </main>
  );
}

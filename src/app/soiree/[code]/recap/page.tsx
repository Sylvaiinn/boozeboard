"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, calculateBAC } from "@/lib/utils";
import type { Party, Participant, Drink, DrinkLog } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParticipantStats {
  participant: Participant;
  totalDrinks: number;
  totalUnits: number;
  totalGrams: number;
  bac: number | null;
  uniqueDrinks: number;
  roundCount: number;
  logs: DrinkLog[];
}

interface Award {
  emoji: string;
  title: string;
  winner: string;
  winnerEmoji: string;
  detail: string;
}

// ─── Compute awards ───────────────────────────────────────────────────────────

function computeAll(
  participants: Participant[],
  drinksMap: Map<string, Drink>,
  allLogs: DrinkLog[]
): { stats: ParticipantStats[]; awards: Award[]; totalDrinks: number; totalUnits: number; durationMin: number } {
  const now = Date.now();

  const stats: ParticipantStats[] = participants.map((p) => {
    const pLogs = allLogs.filter((l) => l.participant_id === p.id);
    let totalUnits = 0;
    let totalGrams = 0;
    const drinkIds = new Set<string>();
    let roundCount = 0;

    for (const log of pLogs) {
      const drink = drinksMap.get(log.drink_id);
      if (!drink) continue;
      totalUnits += calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
      totalGrams += drink.volume_cl * 10 * (drink.alcohol_pct / 100) * 0.8;
      drinkIds.add(drink.id);
      if (log.round_id) roundCount++;
    }

    let bac: number | null = null;
    if (p.weight_kg && p.sex && pLogs.length > 0) {
      const firstLog = [...pLogs].sort((a, b) =>
        (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
      )[0];
      const hours = (now - new Date(firstLog.logged_at ?? now).getTime()) / 3_600_000;
      bac = calculateBAC(totalGrams, p.weight_kg, p.sex as "M" | "F" | "other", hours);
    }

    return {
      participant: p,
      totalDrinks: pLogs.length,
      totalUnits,
      totalGrams,
      bac,
      uniqueDrinks: drinkIds.size,
      roundCount,
      logs: pLogs,
    };
  });

  // Sort by units desc
  const sorted = [...stats].sort((a, b) => b.totalUnits - a.totalUnits);

  // Awards
  const awards: Award[] = [];

  // 🥇 Roi de la soirée — most units
  if (sorted.length > 0 && sorted[0].totalUnits > 0) {
    const w = sorted[0];
    awards.push({
      emoji: "🥇",
      title: "Roi de la soirée",
      winner: w.participant.name,
      winnerEmoji: w.participant.emoji ?? "🍺",
      detail: `${w.totalUnits.toFixed(1)} unités · ${w.totalDrinks} verres`,
    });
  }

  // 🐢 Le plus sage — fewest units (min 1 drink)
  const withDrinks = sorted.filter((s) => s.totalDrinks > 0);
  if (withDrinks.length > 1) {
    const w = withDrinks[withDrinks.length - 1];
    awards.push({
      emoji: "🐢",
      title: "Le plus sage",
      winner: w.participant.name,
      winnerEmoji: w.participant.emoji ?? "🍺",
      detail: `Seulement ${w.totalUnits.toFixed(1)} unités`,
    });
  }

  // 🎯 Le plus diversifié — most unique drinks
  if (stats.length > 0) {
    const w = [...stats].sort((a, b) => b.uniqueDrinks - a.uniqueDrinks)[0];
    if (w.uniqueDrinks >= 2) {
      awards.push({
        emoji: "🎯",
        title: "Le plus diversifié",
        winner: w.participant.name,
        winnerEmoji: w.participant.emoji ?? "🍺",
        detail: `${w.uniqueDrinks} boissons différentes goûtées`,
      });
    }
  }

  // ⚡ Sprinter — most drinks in any 30-min window
  let sprinterStat: ParticipantStats | null = null;
  let sprinterMax = 0;
  for (const s of stats) {
    const sorted30 = [...s.logs].sort((a, b) =>
      (a.logged_at ?? "") < (b.logged_at ?? "") ? -1 : 1
    );
    for (let i = 0; i < sorted30.length; i++) {
      const t1 = new Date(sorted30[i].logged_at ?? 0).getTime();
      let count = 1;
      for (let j = i + 1; j < sorted30.length; j++) {
        const t2 = new Date(sorted30[j].logged_at ?? 0).getTime();
        if (t2 - t1 <= 30 * 60 * 1000) count++;
        else break;
      }
      if (count > sprinterMax) {
        sprinterMax = count;
        sprinterStat = s;
      }
    }
  }
  if (sprinterStat && sprinterMax >= 3) {
    awards.push({
      emoji: "⚡",
      title: "Sprinter",
      winner: sprinterStat.participant.name,
      winnerEmoji: sprinterStat.participant.emoji ?? "🍺",
      detail: `${sprinterMax} verres en 30 minutes`,
    });
  }

  // 💰 Roi des tournées — most round logs
  const roundKing = [...stats].sort((a, b) => b.roundCount - a.roundCount)[0];
  if (roundKing && roundKing.roundCount >= 2) {
    awards.push({
      emoji: "💰",
      title: "Roi des tournées",
      winner: roundKing.participant.name,
      winnerEmoji: roundKing.participant.emoji ?? "🍺",
      detail: `${roundKing.roundCount} verres en tournée`,
    });
  }

  // 🍺 Boisson star — most consumed drink across everyone
  const drinkTotals: Record<string, number> = {};
  for (const log of allLogs) {
    drinkTotals[log.drink_id] = (drinkTotals[log.drink_id] ?? 0) + 1;
  }
  const topDrinkId = Object.entries(drinkTotals).sort(([, a], [, b]) => b - a)[0]?.[0];
  const topDrink = topDrinkId ? drinksMap.get(topDrinkId) : null;
  if (topDrink && drinkTotals[topDrinkId] >= 2) {
    awards.push({
      emoji: "🍺",
      title: "Boisson star",
      winner: topDrink.name,
      winnerEmoji: topDrink.emoji ?? "🍺",
      detail: `Commandée ${drinkTotals[topDrinkId]} fois`,
    });
  }

  // Global stats
  const totalDrinks = allLogs.length;
  const totalUnits = stats.reduce((s, p) => s + p.totalUnits, 0);

  // Duration: from first to last log
  let durationMin = 0;
  if (allLogs.length >= 2) {
    const times = allLogs
      .map((l) => new Date(l.logged_at ?? 0).getTime())
      .filter((t) => t > 0);
    const span = Math.max(...times) - Math.min(...times);
    durationMin = Math.round(span / 60_000);
  }

  return { stats: sorted, awards, totalDrinks, totalUnits, durationMin };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecapPage() {
  const { code } = useParams<{ code: string }>();
  const shareRef = useRef<HTMLDivElement>(null);

  const [party, setParty] = useState<Party | null>(null);
  const [stats, setStats] = useState<ParticipantStats[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [totalDrinks, setTotalDrinks] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (!partyData) return;
      setParty(partyData);

      const [{ data: parts }, { data: preset }, { data: custom }, { data: logs }] =
        await Promise.all([
          supabase.from("participants").select("*").eq("party_id", partyData.id).order("joined_at"),
          supabase.from("drinks").select("*").eq("is_preset", true),
          supabase.from("drinks").select("*").eq("party_id", partyData.id),
          supabase
            .from("drink_logs")
            .select("*")
            .in("participant_id", (
              await supabase.from("participants").select("id").eq("party_id", partyData.id)
            ).data?.map((p) => p.id) ?? [])
            .order("logged_at"),
        ]);

      const drinksMap = new Map(
        [...(preset ?? []), ...(custom ?? [])].map((d) => [d.id, d])
      );

      const result = computeAll(parts ?? [], drinksMap, logs ?? []);
      setStats(result.stats);
      setAwards(result.awards);
      setTotalDrinks(result.totalDrinks);
      setTotalUnits(result.totalUnits);
      setDurationMin(result.durationMin);
      setLoading(false);
    }

    load();
  }, [code]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      setSharing(true);
      try {
        await navigator.share({
          title: `BoozeBoard — ${party?.name}`,
          text: `Récap de la soirée ${party?.name} 🍻 ${totalDrinks} verres, ${totalUnits.toFixed(1)} unités !`,
          url,
        });
      } catch {
        // user cancelled — ignore
      }
      setSharing(false);
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Lien copié !");
    }
  }

  async function handleExportImage() {
    if (!shareRef.current) return;
    setExporting(true);
    try {
      // @ts-ignore
      const htmlToImage = await import("html-to-image");
      // Two attempts: first with skipFonts (fast), fallback without
      let dataUrl: string;
      try {
        dataUrl = await htmlToImage.toPng(shareRef.current, {
          pixelRatio: 2,
          skipFonts: true,
          filter: (node: Node) => {
            // skip script/style nodes that can cause cross-origin issues
            const tag = (node as Element).tagName;
            return tag !== "SCRIPT" && tag !== "LINK";
          },
        });
      } catch {
        dataUrl = await htmlToImage.toPng(shareRef.current, { pixelRatio: 1, skipFonts: true });
      }
      const link = document.createElement("a");
      link.download = `boozeboard-${code}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Image exportée !");
    } catch (err) {
      showToast(`Export impossible : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    }
    setExporting(false);
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-lg">Chargement du récap...</div>
      </main>
    );
  }

  const durationText =
    durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? `${durationMin % 60}min` : ""}`
      : `${durationMin} min`;

  return (
    <main className="min-h-screen bg-zinc-950 pb-28 px-4">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 -mx-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="font-black text-white text-base">Récap soirée</h1>
            <span className="text-amber-400 font-mono text-xs tracking-widest">{code}</span>
          </div>
          <Link
            href={`/soiree/${code}/board`}
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium rounded-lg px-3 py-2"
          >
            🏆 Board
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto pt-6 space-y-6">

        {/* Shareable card */}
        <div
          ref={shareRef}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5"
        >
          {/* Title */}
          <div className="text-center space-y-1">
            <p className="text-4xl">🍻</p>
            <h2 className="text-xl font-black text-white">{party?.name}</h2>
            {party?.location && (
              <p className="text-zinc-500 text-sm">📍 {party.location}</p>
            )}
          </div>

          {/* Global stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-amber-400">{totalDrinks}</p>
              <p className="text-xs text-zinc-500 mt-0.5">verres</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-amber-400">{totalUnits.toFixed(0)}</p>
              <p className="text-xs text-zinc-500 mt-0.5">unités</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-zinc-300">{durationMin > 0 ? durationText : "—"}</p>
              <p className="text-xs text-zinc-500 mt-0.5">durée</p>
            </div>
          </div>

          {/* Podium */}
          {stats.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">Podium</p>
              <div className="space-y-2">
                {stats.slice(0, 3).map((s, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div
                      key={s.participant.id}
                      className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2.5"
                    >
                      <span className="text-xl w-7 text-center">{medals[i]}</span>
                      <span className="text-xl">{s.participant.emoji ?? "🍺"}</span>
                      <span className="font-bold text-white flex-1 truncate">{s.participant.name}</span>
                      <span className="text-amber-400 font-bold text-sm">{s.totalUnits.toFixed(1)}u</span>
                      <span className="text-zinc-500 text-xs">{s.totalDrinks}🍺</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Awards */}
          {awards.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
                Awards ({awards.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {awards.map((award) => (
                  <div
                    key={award.title}
                    className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-3"
                  >
                    <span className="text-2xl w-8 text-center flex-shrink-0">{award.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{award.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-base">{award.winnerEmoji}</span>
                        <span className="font-bold text-white text-sm truncate">{award.winner}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 text-right flex-shrink-0 max-w-[100px] leading-tight">
                      {award.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer branding */}
          <p className="text-center text-zinc-700 text-xs pt-1">
            boozeboard.sl-information.fr · code {code}
          </p>
        </div>

        {/* Classement complet */}
        {stats.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              Classement complet
            </p>
            <div className="space-y-2">
              {stats.map((s, i) => (
                <div
                  key={s.participant.id}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                >
                  <span className="text-zinc-500 font-mono text-sm w-6 text-center">#{i + 1}</span>
                  <span className="text-2xl">{s.participant.emoji ?? "🍺"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{s.participant.name}</p>
                    <p className="text-xs text-zinc-500">
                      {s.totalDrinks} verre{s.totalDrinks > 1 ? "s" : ""} · {s.uniqueDrinks} boisson{s.uniqueDrinks > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-amber-400 font-bold">{s.totalUnits.toFixed(1)}u</p>
                    {s.bac !== null && (
                      <p className="text-xs text-zinc-500">~{s.bac.toFixed(2)} g/L</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No data */}
        {totalDrinks === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-5xl">🫗</p>
            <p className="text-zinc-400 font-semibold">Aucune conso enregistrée</p>
            <Link
              href={`/soiree/${code}/log`}
              className="inline-block bg-amber-400 text-zinc-900 font-bold rounded-xl px-5 py-2.5 text-sm"
            >
              🍺 Logger
            </Link>
          </div>
        )}
      </div>

      {/* Share buttons — sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-3 flex gap-3 z-30">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 bg-amber-400 text-zinc-900 font-bold rounded-xl py-3.5 text-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          {sharing ? "Partage..." : "📤 Partager le lien"}
        </button>
        <button
          onClick={handleExportImage}
          disabled={exporting}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold rounded-xl py-3.5 text-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          {exporting ? "Export..." : "🖼️ Exporter image"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateAlcoholUnits, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { Party, Participant, Drink, DrinkLog } from "@/types/database";

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl border",
        toast.type === "success"
          ? "bg-zinc-800 border-zinc-700 text-white"
          : "bg-red-900 border-red-800 text-red-100"
      )}
    >
      {toast.msg}
    </div>
  );
}

// ─── AddDrinkModal ────────────────────────────────────────────────────────────

function AddDrinkModal({
  partyId,
  onClose,
  onAdded,
}: {
  partyId: string;
  onClose: () => void;
  onAdded: (drink: Drink) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍺");
  const [volumeCl, setVolumeCl] = useState("");
  const [alcoholPct, setAlcoholPct] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !volumeCl || alcoholPct === "") return;
    setSaving(true);

    const { data, error } = await supabase
      .from("drinks")
      .insert({
        party_id: partyId,
        name: name.trim(),
        emoji,
        volume_cl: parseFloat(volumeCl),
        alcohol_pct: parseFloat(alcoholPct),
        is_preset: false,
      })
      .select()
      .single();

    if (!error && data) onAdded(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white text-lg">Boisson custom</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la boisson" required autoFocus className="h-12" />
          <div className="flex gap-3">
            <Input type="number" value={volumeCl} onChange={(e) => setVolumeCl(e.target.value)} placeholder="Volume (cl)" min="1" max="500" step="0.5" required className="h-12" />
            <Input type="number" value={alcoholPct} onChange={(e) => setAlcoholPct(e.target.value)} placeholder="Degré (%)" min="0" max="100" step="0.1" required className="h-12" />
          </div>
          {volumeCl && alcoholPct !== "" && (
            <p className="text-xs text-zinc-500 text-center">
              ≈ {calculateAlcoholUnits(parseFloat(volumeCl), parseFloat(alcoholPct)).toFixed(2)} unité(s)
            </p>
          )}
          <Button type="submit" className="w-full h-12 font-bold" disabled={saving}>
            {saving ? "Ajout..." : `${emoji} Ajouter`}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── TourneeModal ─────────────────────────────────────────────────────────────

function TourneeModal({
  participants,
  drinks,
  onClose,
  onDone,
  showToast,
}: {
  participants: Participant[];
  drinks: Drink[];
  onClose: () => void;
  onDone: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(participants.map((p) => p.id))
  );
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(drinks[0] ?? null);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedDrink || selectedIds.size === 0) return;
    setSaving(true);
    if (typeof navigator !== "undefined") navigator.vibrate?.(100);

    const roundId = crypto.randomUUID();
    const inserts = [...selectedIds].map((pid) => ({
      participant_id: pid,
      drink_id: selectedDrink.id,
      round_id: roundId,
    }));

    const { error } = await supabase.from("drink_logs").insert(inserts);

    if (error) {
      showToast("Erreur lors de la tournée", "error");
    } else {
      showToast(`🍻 Tournée pour ${selectedIds.size} pote${selectedIds.size > 1 ? "s" : ""} !`);
      onDone();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white text-lg">🍻 Tournée</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Pour qui ?</p>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all active:scale-95",
                  selectedIds.has(p.id)
                    ? "bg-amber-400 border-amber-300 text-zinc-900"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400"
                )}
              >
                <span>{p.emoji ?? "🍺"}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Quelle boisson ?</p>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {drinks.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDrink(d)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left",
                  selectedDrink?.id === d.id
                    ? "bg-amber-400 border-amber-300 text-zinc-900"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300"
                )}
              >
                <span className="text-xl flex-shrink-0">{d.emoji ?? "🍺"}</span>
                <span className="truncate">{d.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSave}
          className="w-full h-14 text-base font-black"
          disabled={saving || selectedIds.size === 0 || !selectedDrink}
        >
          {saving
            ? "En cours..."
            : `🍻 Logger pour ${selectedIds.size} pote${selectedIds.size > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ─── VomitModal ───────────────────────────────────────────────────────────────

function VomitModal({
  participants,
  onClose,
  showToast,
}: {
  participants: Participant[];
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(participants[0]?.id ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleConfirm() {
    if (!photoFile || !selectedId) return;
    setSaving(true);
    if (typeof navigator !== "undefined") navigator.vibrate?.([100, 50, 100]);

    // Upload photo to Supabase Storage
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const path = `${selectedId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("vomit-proofs")
      .upload(path, photoFile, { contentType: photoFile.type, upsert: false });

    if (uploadError) {
      showToast("Erreur upload photo", "error");
      setSaving(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("vomit-proofs").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    // Insert vomit_log
    const { error: insertError } = await supabase
      .from("vomit_logs")
      .insert({ participant_id: selectedId, photo_url: photoUrl });

    if (insertError) {
      showToast("Erreur enregistrement", "error");
    } else {
      const p = participants.find((p) => p.id === selectedId);
      showToast(`🤮 ${p?.name ?? "Quelqu'un"} a vomi. Bravo.`);
      onClose();
    }
    setSaving(false);
  }

  const selected = participants.find((p) => p.id === selectedId);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white text-lg">🤮 Logger un vomi</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Participant selector */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Qui a vomi ?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex flex-col items-center gap-1 min-w-[64px] py-2.5 px-2 rounded-xl border transition-all flex-shrink-0 active:scale-95",
                  selectedId === p.id
                    ? "bg-red-500 border-red-400 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300"
                )}
              >
                <span className="text-2xl">{p.emoji ?? "🍺"}</span>
                <span className="text-xs font-bold truncate max-w-[60px]">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Photo obligatoire */}
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Preuve photo <span className="text-red-400 normal-case tracking-normal font-normal ml-1">— obligatoire</span>
          </p>

          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preuve"
                className="w-full max-h-52 object-cover rounded-2xl border border-zinc-700"
              />
              <button
                onClick={() => { setPhotoFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-36 border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-red-400 transition-colors active:scale-95"
            >
              <span className="text-4xl">📸</span>
              <span className="text-sm font-semibold">Prendre la photo</span>
              <span className="text-xs text-zinc-600">Obligatoire pour valider</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!photoFile || !selectedId || saving}
          className="w-full h-14 text-base font-black bg-red-600 hover:bg-red-500 text-white border-0"
        >
          {saving
            ? "Enregistrement..."
            : photoFile
              ? `🤮 Confirmer — ${selected?.emoji ?? ""} ${selected?.name ?? ""}`
              : "📸 Photo requise pour confirmer"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { code } = useParams<{ code: string }>();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [lastLog, setLastLog] = useState<DrinkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [showAddDrink, setShowAddDrink] = useState(false);
  const [showTournee, setShowTournee] = useState(false);
  const [showVomit, setShowVomit] = useState(false);
  const [logging, setLogging] = useState(false);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 2500);
    },
    []
  );

  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (!partyData) return;
      setParty(partyData);

      const [{ data: participantsData }, { data: presetData }, { data: customData }] =
        await Promise.all([
          supabase.from("participants").select("*").eq("party_id", partyData.id).order("joined_at"),
          supabase.from("drinks").select("*").eq("is_preset", true).order("name"),
          supabase.from("drinks").select("*").eq("party_id", partyData.id).order("name"),
        ]);

      const allDrinks = [...(presetData ?? []), ...(customData ?? [])];
      setDrinks(allDrinks);
      setParticipants(participantsData ?? []);
      if (participantsData?.length) setSelectedParticipant(participantsData[0]);
      setLoading(false);
    }
    load();
  }, [code]);

  async function logDrink(drink: Drink) {
    if (!selectedParticipant || logging) return;
    setLogging(true);
    if (typeof navigator !== "undefined") navigator.vibrate?.(50);

    const { data, error } = await supabase
      .from("drink_logs")
      .insert({ participant_id: selectedParticipant.id, drink_id: drink.id })
      .select()
      .single();

    if (error || !data) {
      showToast("Erreur lors du log", "error");
    } else {
      setLastLog(data);
      const units = calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
      showToast(
        drink.alcohol_pct === 0
          ? `${drink.emoji ?? "💧"} ${drink.name} — Sans alcool`
          : `${drink.emoji ?? "🍺"} ${drink.name} — ${units.toFixed(1)} unité${units !== 1 ? "s" : ""}`
      );
    }
    setLogging(false);
  }

  async function undoLast() {
    if (!lastLog) return;
    await supabase.from("drink_logs").delete().eq("id", lastLog.id);
    setLastLog(null);
    showToast("↩️ Dernière conso annulée");
    if (typeof navigator !== "undefined") navigator.vibrate?.([30, 30, 30]);
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-lg">Chargement...</div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-white text-base leading-tight">{party?.name}</h1>
            <span className="text-amber-400 font-mono text-xs tracking-widest">{code}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowVomit(true)}
              className="text-xs bg-red-950 border border-red-900 text-red-400 font-bold rounded-lg px-3 py-2 hover:bg-red-900 transition-colors"
            >
              🤮 Vomi
            </button>
            <button
              onClick={() => setShowTournee(true)}
              className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors"
            >
              🍻 Tournée
            </button>
            <Link
              href={`/soiree/${code}/board`}
              className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors"
            >
              📺
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 px-4 pt-5">
        {/* Participant selector */}
        <section>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-semibold">Qui boit ?</p>
          {participants.length === 0 ? (
            <Link
              href={`/soiree/${code}/setup`}
              className="block text-center text-amber-400 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl py-4 text-sm hover:border-amber-700 transition-colors"
            >
              + Ajouter des participants
            </Link>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedParticipant(p)}
                  className={cn(
                    "flex flex-col items-center gap-1 min-w-[72px] py-3 px-2 rounded-xl border transition-all flex-shrink-0 active:scale-95",
                    selectedParticipant?.id === p.id
                      ? "bg-amber-400 border-amber-300 text-zinc-900"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                  )}
                >
                  <span className="text-2xl">{p.emoji ?? "🍺"}</span>
                  <span className="text-xs font-bold truncate max-w-[68px]">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Drink grid */}
        {selectedParticipant && (
          <section>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
              Que boit <span className="text-amber-400">{selectedParticipant.name}</span> ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {drinks.map((drink) => {
                const units = calculateAlcoholUnits(drink.volume_cl, drink.alcohol_pct);
                const isSoft = drink.alcohol_pct === 0;
                return (
                  <button
                    key={drink.id}
                    onClick={() => logDrink(drink)}
                    disabled={logging}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl py-5 px-3 border transition-all active:scale-95 disabled:opacity-60",
                      isSoft
                        ? "bg-zinc-900 border-blue-900 hover:border-blue-700 hover:bg-zinc-800"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800"
                    )}
                  >
                    <span className="text-4xl">{drink.emoji ?? "🍺"}</span>
                    <span className="font-semibold text-white text-sm text-center leading-tight">{drink.name}</span>
                    <span className={cn("text-xs font-medium", isSoft ? "text-blue-400" : "text-amber-500")}>
                      {isSoft ? "Sans alcool" : `${units.toFixed(1)} unité${units !== 1 ? "s" : ""}`}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowAddDrink(true)}
                className="flex flex-col items-center gap-2 bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl py-5 px-3 active:scale-95 transition-all hover:border-amber-700"
              >
                <span className="text-4xl">➕</span>
                <span className="font-semibold text-zinc-500 text-sm">Autre boisson</span>
              </button>
            </div>
          </section>
        )}
      </div>

      <Toast toast={toast} />

      {/* Undo */}
      {lastLog && (
        <div className="fixed bottom-[72px] left-4 right-4 z-40">
          <button
            onClick={undoLast}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl py-3 text-sm font-semibold hover:bg-zinc-700 active:scale-95 transition-all shadow-xl"
          >
            ↩️ Annuler la dernière conso
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex z-30">
        <Link href={`/soiree/${code}/log`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-amber-400">
          <span className="text-xl">🍺</span>
          <span className="text-xs font-semibold">Logger</span>
        </Link>
        <Link href={`/soiree/${code}/board`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">🏆</span>
          <span className="text-xs font-medium">Board</span>
        </Link>
        <Link href={`/soiree/${code}/me`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">👤</span>
          <span className="text-xs font-medium">Moi</span>
        </Link>
        <Link href={`/soiree/${code}/setup`} className="flex-1 flex flex-col items-center gap-0.5 py-3 text-zinc-500 hover:text-zinc-300 transition-colors">
          <span className="text-xl">👥</span>
          <span className="text-xs font-medium">Potes</span>
        </Link>
      </nav>

      {showAddDrink && party && (
        <AddDrinkModal
          partyId={party.id}
          onClose={() => setShowAddDrink(false)}
          onAdded={(drink) => {
            setDrinks((prev) => [...prev, drink]);
            setShowAddDrink(false);
            showToast(`${drink.emoji ?? "🍺"} ${drink.name} ajoutée !`);
          }}
        />
      )}

      {showTournee && (
        <TourneeModal
          participants={participants}
          drinks={drinks}
          onClose={() => setShowTournee(false)}
          onDone={() => setShowTournee(false)}
          showToast={showToast}
        />
      )}

      {showVomit && (
        <VomitModal
          participants={participants}
          onClose={() => setShowVomit(false)}
          showToast={showToast}
        />
      )}
    </main>
  );
}

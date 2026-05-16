"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { BottomNav } from "@/components/BottomNav";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";
import type { Party, Participant } from "@/types/database";

export default function SetupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [party, setParty] = useState<Party | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [avatarMode, setAvatarMode] = useState<"emoji" | "photo">("emoji");
  const [emoji, setEmoji] = useState("🍺");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "other" | "">("");
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?code=${code}`
    : `/join?code=${code}`;

  useEffect(() => {
    async function load() {
      const { data: partyData } = await supabase
        .from("parties").select("*").eq("code", code).maybeSingle();
      if (!partyData) { router.push("/"); return; }
      setParty(partyData);
      const { data } = await supabase
        .from("participants").select("*").eq("party_id", partyData.id).order("joined_at");
      setParticipants(data ?? []);
      setLoading(false);
    }
    load();
  }, [code, router]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoRef.current) photoRef.current.value = "";
  }

  function switchMode(mode: "emoji" | "photo") {
    setAvatarMode(mode);
    if (mode === "emoji") clearPhoto();
  }

  async function handleAddParticipant(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !party) return;
    if (avatarMode === "photo" && !photoFile) {
      setError("Ajoute une photo ou choisis un emoji.");
      return;
    }

    setSaving(true);
    setError("");

    let photoUrl: string | null = null;

    if (avatarMode === "photo" && photoFile) {
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `${party.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("participant-photos")
        .upload(path, photoFile, { contentType: photoFile.type });

      if (uploadError) {
        setError("Erreur upload photo. Réessaie.");
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("participant-photos")
        .getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        party_id: party.id,
        name: name.trim(),
        emoji: avatarMode === "emoji" ? emoji : null,
        photo_url: photoUrl,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        sex: sex || null,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError("Erreur lors de l'ajout. Réessaie.");
      setSaving(false);
      return;
    }

    setParticipants((prev) => [...prev, data]);
    setName("");
    setEmoji("🍺");
    clearPhoto();
    setAvatarMode("emoji");
    setWeightKg("");
    setSex("");
    setShowOptional(false);
    setSaving(false);
  }

  async function handleRemoveParticipant(id: string) {
    await supabase.from("participants").delete().eq("id", id);
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-lg">Chargement...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-white">{party?.name}</h1>
        {party?.location && <p className="text-zinc-400 text-sm">📍 {party.location}</p>}
        <div className="inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2">
          <span className="text-zinc-400 text-sm">Code :</span>
          <span className="text-amber-400 font-black text-xl tracking-widest">{code}</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <p className="text-zinc-400 text-sm font-medium">Scanner pour rejoindre</p>
        <div className="bg-white p-3 rounded-xl">
          <QRCodeSVG value={joinUrl} size={160} />
        </div>
        <p className="text-zinc-500 text-xs text-center break-all">{joinUrl}</p>
      </div>

      {/* Participants existants */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Participants ({participants.length})
          </h2>
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <ParticipantAvatar participant={p} size="sm" />
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    {p.weight_kg && (
                      <p className="text-xs text-zinc-500">
                        {p.weight_kg} kg{p.sex ? ` · ${p.sex === "M" ? "H" : p.sex === "F" ? "F" : "autre"}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveParticipant(p.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-lg px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire ajout */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-white">Ajouter un participant</h2>

        <form onSubmit={handleAddParticipant} className="space-y-4">

          {/* Avatar toggle */}
          <div className="space-y-3">
            <div className="flex rounded-xl overflow-hidden border border-zinc-700">
              <button
                type="button"
                onClick={() => switchMode("emoji")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold transition-colors",
                  avatarMode === "emoji"
                    ? "bg-amber-400 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                😄 Emoji
              </button>
              <button
                type="button"
                onClick={() => switchMode("photo")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold transition-colors",
                  avatarMode === "photo"
                    ? "bg-amber-400 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                📸 Photo
              </button>
            </div>

            {/* Emoji picker */}
            {avatarMode === "emoji" && (
              <EmojiPicker value={emoji} onChange={setEmoji} />
            )}

            {/* Photo picker */}
            {avatarMode === "photo" && (
              <div className="space-y-2">
                {photoPreview ? (
                  <div className="relative w-fit mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Aperçu"
                      className="w-24 h-24 rounded-full object-cover border-2 border-amber-400 mx-auto block"
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-amber-400 transition-colors"
                  >
                    <span className="text-3xl">📸</span>
                    <span className="text-sm font-semibold">Prendre ou choisir une photo</span>
                  </button>
                )}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Nom */}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom"
            maxLength={30}
            required
            className="h-12 text-base"
          />

          {/* Optionnel : alcoolémie */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {showOptional ? "▲" : "▼"} Données pour l&apos;alcoolémie (optionnel)
          </button>

          {showOptional && (
            <div className="space-y-3 pt-1">
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="Poids (kg)"
                  min="30"
                  max="200"
                  className="h-11"
                />
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "M" | "F" | "other" | "")}
                  className="flex-1 h-11 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Sexe</option>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <p className="text-xs text-zinc-600">
                ⚠️ Utilisé uniquement pour estimer l&apos;alcoolémie (formule de Widmark). Indicatif uniquement.
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            type="submit"
            variant="secondary"
            className="w-full h-12 font-bold"
            disabled={saving || !name.trim() || (avatarMode === "photo" && !photoFile)}
          >
            {saving
              ? "Ajout..."
              : avatarMode === "photo" && photoPreview
                ? `📸 Ajouter ${name || "le participant"}`
                : `${emoji} Ajouter ${name || "le participant"}`}
          </Button>
        </form>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <Button
          onClick={() => router.push(`/soiree/${code}/log`)}
          className="w-full h-16 text-xl font-black"
          disabled={participants.length === 0}
        >
          🍻 C&apos;est parti !
        </Button>
        {participants.length === 0 && (
          <p className="text-center text-zinc-500 text-sm">
            Ajoute au moins un participant pour commencer
          </p>
        )}
        <Link
          href={`/soiree/${code}/board`}
          className="block text-center text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
        >
          📺 Ouvrir le leaderboard TV
        </Link>
      </div>

      <BottomNav code={code} active="setup" />
    </main>
  );
}

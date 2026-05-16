"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generatePartyCode } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    // Générer un code unique (retry si collision)
    let code = "";
    let attempts = 0;
    while (attempts < 10) {
      code = generatePartyCode();
      const { data } = await supabase
        .from("parties")
        .select("code")
        .eq("code", code)
        .maybeSingle();
      if (!data) break;
      attempts++;
    }

    const { error: insertError } = await supabase.from("parties").insert({
      code,
      name: name.trim(),
      location: location.trim() || null,
    });

    if (insertError) {
      setError("Erreur lors de la création. Réessaie.");
      setLoading(false);
      return;
    }

    router.push(`/soiree/${code}/setup`);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-5xl">🎉</div>
          <h1 className="text-3xl font-black text-amber-400">Nouvelle soirée</h1>
          <p className="text-zinc-400 text-sm">Un code sera généré automatiquement</p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Nom de la soirée <span className="text-amber-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Soirée du vendredi soir"
              maxLength={50}
              required
              autoFocus
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Lieu <span className="text-zinc-500">(optionnel)</span>
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Chez Thomas"
              maxLength={50}
              className="h-12 text-base"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950 border border-red-800 rounded-xl p-3">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold"
            disabled={loading || !name.trim()}
          >
            {loading ? "Création en cours..." : "🚀 Créer la soirée"}
          </Button>
        </form>

        <Link
          href="/"
          className="block text-center text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
        >
          ← Retour
        </Link>
      </div>
    </main>
  );
}

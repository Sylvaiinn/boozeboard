"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.toUpperCase().trim();
    if (!cleaned) return;

    setLoading(true);
    setError("");

    const { data } = await supabase
      .from("parties")
      .select("code, status")
      .eq("code", cleaned)
      .maybeSingle();

    if (!data) {
      setError("Code introuvable. Vérifie l'orthographe.");
      setLoading(false);
      return;
    }

    router.push(`/soiree/${cleaned}/log`);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-5xl">🔑</div>
          <h1 className="text-3xl font-black text-amber-400">Rejoindre</h1>
          <p className="text-zinc-400">Entre le code de la soirée</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            placeholder="BIERE-42"
            className="w-full h-20 text-center text-3xl font-black tracking-widest rounded-xl border border-zinc-700 bg-zinc-800 text-amber-400 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            maxLength={12}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950 border border-red-800 rounded-xl p-3">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold"
            disabled={loading || !code.trim()}
          >
            {loading ? "Recherche..." : "Rejoindre 🍻"}
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

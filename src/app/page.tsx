import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-6 max-w-md w-full">
        {/* Logo / Title */}
        <div className="space-y-2">
          <div className="text-6xl">🍺</div>
          <h1 className="text-5xl font-black tracking-tight text-amber-400">
            BoozeBoard
          </h1>
          <p className="text-zinc-400 text-lg">
            Track your drinks. Rule the leaderboard.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4">
          <Link
            href="/create"
            className="w-full py-4 px-6 bg-amber-400 text-zinc-900 font-bold text-lg rounded-xl text-center hover:bg-amber-300 transition-colors active:scale-95"
          >
            🎉 Créer une soirée
          </Link>
          <Link
            href="/join"
            className="w-full py-4 px-6 bg-zinc-800 text-zinc-100 font-bold text-lg rounded-xl text-center hover:bg-zinc-700 transition-colors active:scale-95 border border-zinc-700"
          >
            🔑 Rejoindre avec un code
          </Link>
        </div>

        {/* Footer disclaimer */}
        <p className="text-xs text-zinc-600 pt-4">
          L&apos;abus d&apos;alcool est dangereux pour la santé. À consommer avec modération.
        </p>
      </div>
    </main>
  );
}

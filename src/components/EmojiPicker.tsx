"use client";

import { cn } from "@/lib/utils";

const EMOJIS = [
  "🍺", "🍻", "🥃", "🍷", "🍹", "🥂", "🍾", "🍸",
  "😎", "🔥", "💪", "🎉", "🤙", "👑", "🐻", "🦊",
  "🐺", "🦁", "🐯", "🐸", "🤠", "🥳", "😈", "🤡",
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            "text-2xl h-10 w-10 rounded-lg flex items-center justify-center transition-all active:scale-90",
            value === emoji
              ? "bg-amber-400 ring-2 ring-amber-300 scale-110"
              : "bg-zinc-800 hover:bg-zinc-700"
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

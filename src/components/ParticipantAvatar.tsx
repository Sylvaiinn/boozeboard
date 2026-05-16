import type { Participant } from "@/types/database";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE: Record<AvatarSize, { wrapper: string; emoji: string; img: string }> = {
  xs:  { wrapper: "w-7 h-7",   emoji: "text-base",  img: "w-7 h-7"   },
  sm:  { wrapper: "w-9 h-9",   emoji: "text-xl",    img: "w-9 h-9"   },
  md:  { wrapper: "w-11 h-11", emoji: "text-2xl",   img: "w-11 h-11" },
  lg:  { wrapper: "w-16 h-16", emoji: "text-4xl",   img: "w-16 h-16" },
  xl:  { wrapper: "w-20 h-20", emoji: "text-5xl",   img: "w-20 h-20" },
  "2xl": { wrapper: "w-24 h-24", emoji: "text-6xl", img: "w-24 h-24" },
};

interface Props {
  participant: Pick<Participant, "emoji" | "photo_url" | "name">;
  size?: AvatarSize;
  className?: string;
}

export function ParticipantAvatar({ participant, size = "md", className = "" }: Props) {
  const s = SIZE[size];

  if (participant.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={participant.photo_url}
        alt={participant.name}
        className={`${s.img} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${s.wrapper} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}>
      <span className={s.emoji}>{participant.emoji ?? "🍺"}</span>
    </div>
  );
}

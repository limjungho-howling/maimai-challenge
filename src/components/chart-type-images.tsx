import Image from "next/image";

export function ChartDifficultyImage({ difficulty }: { difficulty: number }) {
  const imageUrl =
    difficulty === 4
      ? "https://maimaidx-eng.com/maimai-mobile/img/diff_remaster.png"
      : "https://maimaidx-eng.com/maimai-mobile/img/diff_master.png";
  const label = difficulty === 4 ? "Re:MASTER" : "MASTER";

  return (
    <Image
      alt={label}
      className="h-[18px] w-auto shrink-0"
      height={20}
      loading="lazy"
      src={imageUrl}
      unoptimized
      width={88}
    />
  );
}

export function ChartKindImage({ kind }: { kind: string }) {
  const isDx = kind.toUpperCase() === "DX";
  const imageUrl = isDx
    ? "https://maimaidx-eng.com/maimai-mobile/img/music_dx.png"
    : "https://maimaidx-eng.com/maimai-mobile/img/music_standard.png";

  return (
    <Image
      alt={isDx ? "DX" : "STANDARD"}
      className="h-[18px] w-auto shrink-0"
      height={20}
      loading="lazy"
      src={imageUrl}
      unoptimized
      width={88}
    />
  );
}

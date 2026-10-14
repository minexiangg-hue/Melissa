import Image from "next/image";

export const assetPath = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

export function MelissaCharacter({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={`melissa-character ${className}`}
      src={assetPath("/brand/melissa-character.webp")}
      alt="Melissa, your golden-winged English companion"
      width={1122}
      height={1402}
      priority={priority}
      sizes="(max-width: 767px) 80vw, 440px"
    />
  );
}

export function MelissaAvatar({ size = 40 }: { size?: number }) {
  return (
    <Image
      className="melissa-avatar"
      src={assetPath("/brand/melissa-avatar.webp")}
      alt=""
      width={size}
      height={size}
    />
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

import Image from "next/image";
import Link from "next/link";

type Size = "sm" | "md" | "lg";

const MARK_PX: Record<Size, number> = { sm: 26, md: 36, lg: 48 };
const TEXT_CLASS: Record<Size, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-lg sm:text-xl",
};
const MARK_CLASS: Record<Size, string> = {
  sm: "",
  md: "",
  lg: "h-10 w-10 sm:h-12 sm:w-12",
};

export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/erota-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className={`shrink-0 select-none ${className}`}
    />
  );
}

export function BrandLockup({
  size = "md",
  className = "",
  textClassName = "",
  compactOnMobile = false,
}: {
  size?: Size;
  className?: string;
  textClassName?: string;
  /** Hide the "Sales Intelligence" suffix below the `sm` breakpoint so tight headers don't wrap. */
  compactOnMobile?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <BrandMark size={MARK_PX[size]} className={MARK_CLASS[size]} />
      <span className={`truncate font-semibold tracking-tight ${TEXT_CLASS[size]} ${textClassName}`}>
        <span className="text-brand">Erota</span>
        <span className={compactOnMobile ? "hidden sm:inline" : ""}> Sales Intelligence</span>
      </span>
    </span>
  );
}

export function BrandLink({
  href = "/",
  size = "md",
  className = "",
  textClassName = "",
  compactOnMobile = false,
}: {
  href?: string;
  size?: Size;
  className?: string;
  textClassName?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <Link href={href} aria-label="Erota Sales Intelligence home" className={`shrink-0 ${className}`}>
      <BrandLockup size={size} textClassName={textClassName} compactOnMobile={compactOnMobile} />
    </Link>
  );
}

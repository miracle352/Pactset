import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="Pactset home">
      <span className="brand-glyph" aria-hidden="true">
        <span />
        <span />
      </span>
      {!compact && <span className="brand-word">PACTSET</span>}
    </Link>
  );
}

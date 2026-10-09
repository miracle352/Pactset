import Link from "next/link";
import { PactsetSymbol } from "./pactset-symbol";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="Pactset home">
      <PactsetSymbol className="brand-glyph" />
      {!compact && <span className="brand-word">Pactset</span>}
    </Link>
  );
}

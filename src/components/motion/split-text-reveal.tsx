type RevealTag = "h1" | "h2" | "h3";

function Words({ text, emphasis = false }: { text: string; emphasis?: boolean }) {
  const words = text.split(/\s+/);
  const occurrences = new Map<string, number>();
  return <span className={emphasis ? "split-phrase split-emphasis" : "split-phrase"} aria-hidden="true">
    {words.map((word) => { const occurrence = (occurrences.get(word) ?? 0) + 1; occurrences.set(word, occurrence); return <span className="split-word" data-reveal-word key={`${word}-${occurrence}`}>{word}<span className="word-space"> </span></span>; })}
  </span>;
}

/** React Bits SplitText pattern, adapted to preserve semantic text and SSR visibility. */
export function SplitTextReveal({ as: Tag = "h2", text, emphasis, id, className }: { as?: RevealTag; text: string; emphasis?: string; id?: string; className?: string }) {
  const fullText = [text, emphasis].filter(Boolean).join(" ");
  return <Tag id={id} className={className} data-split-reveal aria-label={fullText}>
    <Words text={text} />{emphasis ? <><span aria-hidden="true"> </span><Words text={emphasis} emphasis /></> : null}
  </Tag>;
}

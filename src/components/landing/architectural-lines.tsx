export function ArchitecturalLines({ variant = "section" }: { variant?: "hero" | "section" | "footer" }) {
  return (
    <svg className={`architectural-lines architectural-lines-${variant}`} viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path className="architectural-line" d="M70 580 360 70l245 425L875 30" />
      <path className="architectural-line" d="M250 -40 565 510 900 110" />
      <path className="architectural-line" d="M430 560 655 175 900 560" />
      <path className="architectural-signal signal-a" d="M70 580 360 70l245 425L875 30" />
      <path className="architectural-signal signal-b" d="M430 560 655 175 900 560" />
    </svg>
  );
}

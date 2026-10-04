export function PactsetAvatar({ seed = "opal", style = "orbit", color = "indigo", label, size = "medium" }: { seed?: string; style?: string; color?: string; label: string; size?: "small" | "medium" | "large" }) {
  const tilt = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7 - 3;
  return <span className={`pactset-avatar avatar-${style} avatar-${color} avatar-${size}`} role="img" aria-label={`${label}'s cartoon avatar`} style={{ "--avatar-tilt": `${tilt}deg` } as React.CSSProperties}><span className="avatar-hair" /><span className="avatar-face"><i /><i /><b /></span></span>;
}

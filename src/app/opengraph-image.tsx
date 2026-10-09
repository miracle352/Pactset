import { ImageResponse } from "next/og";

export const alt = "Pactset · A thousand moving parts. One seamless experience.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "68px", color: "#f3f5ef", background: "radial-gradient(circle at 82% 22%, #205a55 0, transparent 38%), linear-gradient(145deg, #061f1e, #031716)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "23px", fontWeight: 700, letterSpacing: "8px" }}><span style={{ width: "34px", height: "34px", display: "flex", border: "3px solid #dfa12d", clipPath: "polygon(50% 0,100% 100%,0 100%)" }} /> PACTSET</div>
      <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", flexDirection: "column", fontSize: "82px", fontWeight: 500, letterSpacing: "-5px", lineHeight: .94 }}><span>A thousand moving parts.</span><span style={{ color: "#dfa12d", fontFamily: "Georgia, serif", fontStyle: "italic" }}>One seamless experience.</span></div><div style={{ marginTop: "28px", color: "#b7c9c4", fontSize: "24px" }}>Global event operations · Stellar Testnet</div></div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#b7c9c4", fontSize: "18px" }}><span>Venue · Crew · Milestones</span><span>Plan · Prepare · Approve · Release</span></div>
    </div>,
    size,
  );
}

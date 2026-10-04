import { ImageResponse } from "next/og";

export const alt = "Pactset · Every detail. One shared plan.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "68px", color: "#0b184d", background: "radial-gradient(circle at 82% 22%, #d9d5ff 0, transparent 38%), linear-gradient(145deg, #fafbff, #e8edff)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "23px", fontWeight: 700, letterSpacing: "8px" }}><span style={{ width: "34px", height: "34px", display: "flex", border: "4px solid #3039e8", borderRadius: "7px", transform: "rotate(45deg)" }} /> PACTSET</div>
      <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", flexDirection: "column", fontSize: "88px", fontWeight: 500, letterSpacing: "-6px", lineHeight: .94 }}><span>Every detail.</span><span>One shared plan.</span></div><div style={{ marginTop: "28px", color: "#525f86", fontSize: "24px" }}>Global event operations · Stellar Testnet</div></div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#677294", fontSize: "18px" }}><span>Venue · Crew · Milestones</span><span>One shared plan</span></div>
    </div>,
    size,
  );
}

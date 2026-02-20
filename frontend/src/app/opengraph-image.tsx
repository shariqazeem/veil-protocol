import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Veil Protocol - Confidential Bitcoin Accumulation on Starknet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #08080C 0%, #0F0F14 40%, #16161E 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(255,90,0,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-50px",
            right: "100px",
            width: "400px",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(167,139,250,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
          <span style={{ fontSize: "56px", fontWeight: 800, color: "#FAFAFA", letterSpacing: "-0.02em" }}>
            Veil
          </span>
          <span style={{ fontSize: "56px", fontWeight: 800, color: "#FF5A00", letterSpacing: "-0.02em" }}>
            {" "}Protocol
          </span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: "28px", color: "#A1A1AA", fontWeight: 500, marginBottom: "40px" }}>
          Confidential Bitcoin Accumulation on Starknet
        </div>

        {/* ZK Verified badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", borderRadius: "24px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", marginBottom: "32px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34D399" }} />
          <span style={{ fontSize: "14px", color: "#34D399", fontWeight: 600 }}>
            ZK Proofs Verified On-Chain via Garaga
          </span>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["STARK-Verified ZK Proofs", "Batch Execution", "BTC Settlement", "Cairo-Native"].map(
            (text) => (
              <div
                key={text}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#A1A1AA",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {text}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}

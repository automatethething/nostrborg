import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #10161b 0%, #0e1114 100%)",
          color: "#e8e4d9",
          padding: "64px",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#d4a017" }}>
          NostrBorg
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 940 }}>
          <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.04 }}>Lose one provider. Keep the backup.</div>
          <div style={{ fontSize: 34, lineHeight: 1.35, color: "#9aa3ad" }}>
            Encrypted Borg replicas as opaque blobs. Destroy one store, restore from the survivor.
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#9aa3ad" }}>nostrborg.flowstate.market</div>
      </div>
    ),
    size
  );
}

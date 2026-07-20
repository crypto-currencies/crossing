import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: 42,
        background: "#ff8165",
      }}
    >
      <div style={{ position: "absolute", width: 30, height: 162, borderRadius: 18, background: "#18131e", transform: "rotate(43deg)" }} />
      <div style={{ position: "absolute", width: 30, height: 162, borderRadius: 18, background: "#fff5ee", transform: "rotate(-43deg)" }} />
    </div>,
    size,
  );
}

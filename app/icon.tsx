import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
        borderRadius: 16,
        background: "#ff8165",
      }}
    >
      <div style={{ position: "absolute", width: 11, height: 58, borderRadius: 8, background: "#18131e", transform: "rotate(43deg)" }} />
      <div style={{ position: "absolute", width: 11, height: 58, borderRadius: 8, background: "#fff5ee", transform: "rotate(-43deg)" }} />
    </div>,
    size,
  );
}

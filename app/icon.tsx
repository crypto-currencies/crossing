import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#050506",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* "c." as a centred unit — row flex, baseline-aligned */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              fontFamily: "Arial, Helvetica, sans-serif",
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            c
          </span>
          <div
            style={{
              width: 5.5,
              height: 5.5,
              borderRadius: "50%",
              background: "#7c3aed",
              marginLeft: 1.5,
              marginBottom: 1.5,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

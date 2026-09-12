import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FFFFFF",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 40 40"
          width={140}
          height={140}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="p" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FF6A3D" />
              <stop offset="1" stopColor="#FFA37A" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="#0A0A0A" />
          <path d="M 20 2 A 18 18 0 0 1 38 20 L 20 20 Z" fill="#FFFFFF" />
          <circle cx="27.5" cy="12.5" r="3" fill="url(#p)" />
        </svg>
      </div>
    ),
    size
  );
}

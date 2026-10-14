import type { NextConfig } from "next";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (basePath !== "" && !/^(?:\/[a-z0-9][a-z0-9-]*)+$/i.test(basePath)) {
  throw new Error(
    "NEXT_PUBLIC_BASE_PATH must be empty or a path such as /melissa, without a trailing slash.",
  );
}
const distDir = process.env.MELISSA_BUILD_DIR ?? ".next";
if (!/^\.next(?:-[a-z0-9-]+)?$/i.test(distDir)) {
  throw new Error(
    "MELISSA_BUILD_DIR must be .next or a named directory such as .next-preview.",
  );
}
const config: NextConfig = {
  distDir,
  basePath,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;

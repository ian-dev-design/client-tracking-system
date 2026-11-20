import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use Node APIs; keep them out of the bundler.
  serverExternalPackages: ["googleapis", "mammoth", "unpdf"],
  devIndicators: false,
  // Lets a second local preview (demo data, port 3001) run next to the real one without clashing.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

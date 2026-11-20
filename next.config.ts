import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use Node APIs; keep them out of the bundler.
  serverExternalPackages: ["googleapis", "mammoth", "unpdf"],
  devIndicators: false,
};

export default nextConfig;

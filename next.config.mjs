/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" } : {}),
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard is fully dynamic (live DB data on every request)
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

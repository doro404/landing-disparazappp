import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Prevent accidental exposure of sensitive data to the client
    taint: true,
    serverActions: {
      // Only allow Server Actions from the production domain
      allowedOrigins: [
        "doro404-landing-disparazapp.vercel.app",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;

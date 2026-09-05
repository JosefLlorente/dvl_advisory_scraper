import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["leaflet", "react-leaflet"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves this project from https://<owner>.github.io/GEMS/
  output: "export",
  basePath: "/GEMS",
  assetPrefix: "/GEMS/",
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;

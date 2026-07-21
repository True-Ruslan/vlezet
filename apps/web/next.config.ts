import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vlezet/domain", "@vlezet/geometry", "@vlezet/editor-core"],
};

export default nextConfig;

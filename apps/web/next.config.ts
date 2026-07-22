import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vlezet/domain", "@vlezet/geometry", "@vlezet/editor-core", "@vlezet/recognition"],
};

export default nextConfig;

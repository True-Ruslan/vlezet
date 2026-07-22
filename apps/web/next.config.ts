import path from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@vlezet/domain", "@vlezet/geometry", "@vlezet/editor-core", "@vlezet/recognition"],
  turbopack: {
    root: workspaceRoot,
    resolveAlias: {
      fs: { browser: "./browser-node-empty.ts" },
      path: { browser: "./browser-node-empty.ts" },
      crypto: { browser: "./browser-node-empty.ts" },
    },
  },
};

export default nextConfig;

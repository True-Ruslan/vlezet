import path from "node:path";
import type { NextConfig } from "next";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "../..");
const browserNodeEmpty = path.resolve(appRoot, "browser-node-empty.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@vlezet/domain", "@vlezet/geometry", "@vlezet/editor-core", "@vlezet/recognition"],
  turbopack: {
    root: workspaceRoot,
    resolveAlias: {
      fs: browserNodeEmpty,
      path: browserNodeEmpty,
      crypto: browserNodeEmpty,
    },
  },
};

export default nextConfig;

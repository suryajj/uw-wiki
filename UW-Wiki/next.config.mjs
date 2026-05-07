import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin tracing root to this app folder; the parent monorepo has its own lockfile.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

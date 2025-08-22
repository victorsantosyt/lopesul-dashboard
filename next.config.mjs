// next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Alias @ -> src
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },

  // Fixa a raiz do projeto pra evitar lockfile fora interferir
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

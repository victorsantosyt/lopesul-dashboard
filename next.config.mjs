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

  // 🔁 Rewrites para abrir o captive sem .html
  async rewrites() {
    return [
      { source: "/pagamentos", destination: "/pagamento.html" },
      { source: "/pagamento",  destination: "/pagamento.html" },
    ];
  },

  // 🧾 Headers de cache
  async headers() {
    return [
      // Não guardar cache da página de pagamento
      {
        source: "/pagamento.html",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      // Cache longo para assets do captive (CSS/JS/imagens)
      {
        source: "/captive/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache padrão para /assets (se você usa logos, etc.)
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" }, // 7 dias
        ],
      },
    ];
  },
};

export default nextConfig;

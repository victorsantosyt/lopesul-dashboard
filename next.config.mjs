// next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Alias @ -> src
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd(), "src"),
    };
    return config;
  },

  // Evita que o tracing considere diretórios fora do projeto
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
      // Nunca cachear a página do pagamento
      {
        source: "/pagamento.html",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      // Cache longo para assets do captive
      {
        source: "/captive/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache padrão para /assets
      {
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;

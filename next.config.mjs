// next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ✅ Next 15.5 espera um OBJETO aqui (boolean gera warning)
    serverActions: {
      // opcional: você pode ajustar limites se usar Server Actions
      // bodySizeLimit: "2mb",
    },
  },

  webpack: (config, { isServer }) => {
    // Alias @ -> src
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd(), "src"),
    };

    // ✅ mata "Can't resolve 'vertx'"
    config.resolve.fallback = {
      ...config.resolve.fallback,
      vertx: false,
    };

    // ⛔ evita empacotar módulos nativos no lado do server
    if (isServer) {
      const asCommonJs = {
        ssh2: "commonjs ssh2",
        "node-ssh": "commonjs node-ssh",
      };
      if (Array.isArray(config.externals)) {
        config.externals.push(asCommonJs);
      } else {
        config.externals = [config.externals, asCommonJs].filter(Boolean);
      }
    }

    return config;
  },

  outputFileTracingRoot: path.join(__dirname),

  async rewrites() {
    return [
      { source: "/pagamentos", destination: "/pagamento.html" },
      { source: "/pagamento", destination: "/pagamento.html" },
    ];
  },

  async headers() {
    return [
      {
        source: "/pagamento.html",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/captive/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;

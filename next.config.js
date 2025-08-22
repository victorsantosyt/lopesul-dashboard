// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Alias para @ -> src
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');
    return config;
  },

  // Corrige a raiz do projeto (evita lockfile fora atrapalhar)
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;

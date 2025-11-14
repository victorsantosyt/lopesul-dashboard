// scripts/fix-build-id.js
// Gera o arquivo .next/BUILD_ID a partir do routes-manifest do Next.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextDir = path.join(__dirname, "..", ".next");
const routesPath = path.join(nextDir, "routes-manifest.json");
const buildIdPath = path.join(nextDir, "BUILD_ID");

if (!fs.existsSync(routesPath)) {
  console.error("[fix-build-id] routes-manifest.json não encontrado em", routesPath);
  process.exit(1);
}

const raw = fs.readFileSync(routesPath, "utf8");
const manifest = JSON.parse(raw);
let buildId = manifest.buildId || manifest.__nextBuildId || "";

if (!buildId) {
  // Se o Next não escreveu buildId no manifest, geramos um ID simples.
  // Isso é suficiente para o next start validar a existência do build.
  buildId = String(Date.now());
}

fs.writeFileSync(buildIdPath, String(buildId), "utf8");
console.log("[fix-build-id] .next/BUILD_ID gravado =", buildId);

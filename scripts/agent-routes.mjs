#!/usr/bin/env node
// Refresh the "open this feature" route registry from the backend checkout (byte-identical copy).
//   npm run agent:routes                                   # copy ../RAG-BACKEND/agent/routes/registry.json
//   npm run agent:routes -- --from C:/path/RAG-BACKEND
//   AGENT_BACKEND_DIR=C:/Users/me/Downloads/RAG-BACKEND npm run agent:routes
// Writes src/lib/agent/routeRegistry.json. Never edit that file by hand; the backend test
// tests/agent/test_voice_phase3.py fails when the two copies differ.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const i = args.indexOf("--from");
const dir = (i >= 0 ? args[i + 1] : undefined) ?? process.env.AGENT_BACKEND_DIR ?? resolve(root, "../RAG-BACKEND");
const src = join(dir, "agent/routes/registry.json");
if (!existsSync(src)) throw new Error(`No registry at ${src}. Pass --from <RAG-BACKEND checkout> or set AGENT_BACKEND_DIR.`);
const text = readFileSync(src, "utf8");
const reg = JSON.parse(text);
if (!reg.routes || typeof reg.version !== "number") throw new Error("That is not the a4ai route registry");
writeFileSync(join(root, "src/lib/agent/routeRegistry.json"), text);
console.log(`agent routes: ${Object.keys(reg.routes).length} keys copied from a local file`);

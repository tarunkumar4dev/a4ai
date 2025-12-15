// scripts/count-lines.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

let total = 0;

const ignore = ["node_modules", "dist", "build", ".next", ".git"];

function walk(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fp = path.join(dir, file);

    if (ignore.includes(file)) continue;

    const stat = fs.statSync(fp);

    if (stat.isDirectory()) {
      walk(fp);
    } else if (/\.(js|jsx|ts|tsx|css|json)$/.test(file)) {
      const lines = fs.readFileSync(fp, "utf8").split("\n").length;
      total += lines;
      console.log(`${lines.toString().padStart(6)} │ ${fp}`);
    }
  }
}

console.log("=================================");
console.log("📦 Counting lines inside /src ...");
console.log("=================================\n");

walk(path.join(ROOT, "src"));

console.log("\n=================================");
console.log(`✅ TOTAL LINES: ${total}`);
console.log("=================================");

#!/usr/bin/env bun
/**
 * Build the npm-publishable bundle.
 *
 * Output: dist-npm/index.js (single ESM file with #!/usr/bin/env node shebang).
 * Targets Node 18+ so child_process / fs.promises / fetch are all available.
 */
import { chmod } from "node:fs/promises";

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist-npm",
  naming: "index.js",
  target: "node",
  format: "esm",
  minify: false,
  banner: "#!/usr/bin/env node",
});

if (!result.success) {
  console.error("build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// chmod +x so npm install registers it as an executable on Unix
try {
  await chmod("dist-npm/index.js", 0o755);
} catch {
  // Windows ignores chmod; safe to ignore
}

console.log(`✓ npm bundle: dist-npm/index.js`);

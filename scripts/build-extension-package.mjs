import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const reviewKey = process.env.TRUSTED_EXTENSION_REVIEW_KEY;
if (!reviewKey) {
  throw new Error(
    "TRUSTED_EXTENSION_REVIEW_KEY is required to produce an installable package",
  );
}

const root = process.cwd();
const packageRoot = path.join(root, "build");
const outputDirectory = path.join(packageRoot, "cozyvtt-agent");
const entrypoint = "index.mjs";
const outputPath = path.join(outputDirectory, entrypoint);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "plugin.ts")],
  outfile: outputPath,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
});

const imported = await import(`${pathToFileURL(outputPath).href}?built=${Date.now()}`);
const extension = imported.default;
if (!extension?.manifest) throw new Error("Bundled plugin has no manifest");

const contents = await readFile(outputPath);
const checksum = `sha256:${createHash("sha256")
  .update(entrypoint)
  .update("\0")
  .update(contents)
  .update("\0")
  .digest("hex")}`;
const { id, version } = extension.manifest;
const signature = `hmac-sha256:${createHmac("sha256", reviewKey)
  .update(`${id}\n${version}\n${checksum}`)
  .digest("hex")}`;
const packageManifest = {
  packageFormat: "cozyvtt-extension-package/1",
  manifest: extension.manifest,
  entrypoint,
  checksum,
  signature,
  dependencies: {},
  contributions: { themes: [], renderers: [] },
};
await writeFile(
  path.join(outputDirectory, "cozyvtt.extension.json"),
  `${JSON.stringify(packageManifest, null, 2)}\n`,
);

console.log(JSON.stringify({ packageRoot, extensionId: id, version, checksum }));

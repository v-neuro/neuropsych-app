import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";

export function validatePublicDirectory(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Public asset must not be a symlink: ${name}`);
    // Finder creates these in existing workspaces; never copy them to the release.
    if (entry.isFile() && entry.name === ".DS_Store") continue;
    if (entry.isDirectory() && /^(icons|material)\/$/.test(`${name}/`)) {
      files.push(...validatePublicDirectory(resolve(directory, entry.name), `${name}/`));
    } else if (!entry.isFile() || !/^(?:icons\/[A-Za-z0-9_-]+\.(?:png|svg)|material\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)|manifest\.webmanifest|robots\.txt|vite\.svg)$/.test(name)) {
      throw new Error(`Unexpected public file; review before publishing: ${name}`);
    } else files.push(name);
  }
  return files;
}

export function productionSecurity() {
  let config;
  let publicFiles = [];
  return {
    name: "npt-production-security",
    apply: "build",
    config() { return { build: { copyPublicDir: false } }; },
    configResolved(resolved) { config = resolved; },
    buildStart() { if (config.publicDir) publicFiles = validatePublicDirectory(config.publicDir); },
    generateBundle() {
      for (const name of publicFiles) this.emitFile({ type: "asset", fileName: name, source: readFileSync(resolve(config.publicDir, name)) });
    },
    transformIndexHtml: {
      order: "post",
      handler() {
        return [
          { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY }, injectTo: "head-prepend" },
          { tag: "meta", attrs: { name: "referrer", content: "no-referrer" }, injectTo: "head-prepend" },
        ];
      },
    },
  };
}

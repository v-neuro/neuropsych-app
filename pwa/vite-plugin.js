import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function publicFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    if (entry.name.startsWith(".")) return [];
    return entry.isDirectory()
      ? publicFiles(resolve(directory, entry.name), `${name}/`)
      : [name];
  });
}

// Derive the precache from the actual build, without a separate dependency/toolchain.
export function offlineApp() {
  let config;
  return {
    name: "npt-offline-app",
    apply: "build",
    enforce: "post",
    configResolved(resolved) { config = resolved; },
    generateBundle(_options, bundle) {
      if (config.base !== "/") throw new Error("The app currently requires deployment at the domain root (base: '/').");
      const assets = new Map();
      for (const [name, file] of Object.entries(bundle)) {
        if (name.endsWith(".map")) continue;
        assets.set(`/${name}`, file.type === "chunk" ? file.code : file.source);
      }
      for (const name of publicFiles(config.publicDir)) {
        // Only ship app resources, never arbitrary files accidentally placed in public/.
        if (!/^(material\/|icons\/|manifest\.webmanifest$)/.test(name)) continue;
        assets.set(`/${name}`, readFileSync(resolve(config.publicDir, name)));
      }
      if (!assets.has("/index.html")) throw new Error("Offline build is missing index.html.");
      const template = readFileSync(new URL("./service-worker.js", import.meta.url), "utf8");
      const hash = createHash("sha256").update(template);
      const paths = [...assets.keys()].sort();
      for (const path of paths) hash.update(path).update(assets.get(path));
      const version = hash.digest("hex").slice(0, 20);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template.replace("__NPT_VERSION__", version).replace("/* precache */ []", JSON.stringify(paths)),
      });
    },
  };
}

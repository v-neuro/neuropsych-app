import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

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
  let appVersion;
  return {
    name: "npt-offline-app",
    apply: "build",
    enforce: "post",
    config(userConfig) {
      const root = resolve(userConfig.root || cwd());
      const hash = createHash("sha256");
      const inputs = ["index.html", "package-lock.json", "vite.config.js", ...["src", "public", "pwa"].flatMap((dir) => publicFiles(resolve(root, dir), `${dir}/`))].sort();
      for (const name of inputs) hash.update(name).update(readFileSync(resolve(root, name)));
      appVersion = hash.digest("hex").slice(0, 12);
      return { define: { __NPT_APP_VERSION__: JSON.stringify(appVersion) } };
    },
    configResolved(resolved) { config = resolved; },
    writeBundle(options, bundle) {
      if (config.base !== "/") throw new Error("The app currently requires deployment at the domain root (base: '/').");
      const outDir = resolve(config.root, options.dir || config.build.outDir);
      const assets = new Map();
      for (const name of Object.keys(bundle)) {
        if (name.endsWith(".map")) continue;
        // Vite finalizes dynamic-import preload tables after generateBundle hooks.
        assets.set(`/${name}`, readFileSync(resolve(outDir, name)));
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
      writeFileSync(resolve(outDir, "sw.js"), template.replace("__NPT_VERSION__", version)
          .replace("__NPT_APP_VERSION__", appVersion)
          .replace("/* precache */ []", JSON.stringify(paths))
          .replace("/* hashes */ {}", JSON.stringify(Object.fromEntries(paths.map((path) => [path, createHash("sha256").update(assets.get(path)).digest("hex")])))));
    },
  };
}

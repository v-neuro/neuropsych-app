import { pathToFileURL } from 'node:url';

export function isSupportedNode(version) {
  const [major, minor, patch] = version.replace(/^v/, '').split('.').map(Number);
  const minimum = { 22: [23, 4], 24: [22, 1], 26: [12, 1] }[major];
  return !!minimum && Number.isInteger(patch)
    && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && !isSupportedNode(process.versions.node)) {
  console.error('Use a patched Node.js release: 22.23.4+, 24.22.1+ or 26.12.1+ in those release lines (see .nvmrc).');
  process.exitCode = 1;
}

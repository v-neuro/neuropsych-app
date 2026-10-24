import { pathToFileURL } from 'node:url';

export function isSupportedNode(version) {
  const [major, minor, patch] = version.replace(/^v/, '').split('.').map(Number);
  const minimum = { 26: [12, 1] }[major];
  return !!minimum && Number.isInteger(patch)
    && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && !isSupportedNode(process.versions.node)) {
  console.error('Use Node.js 26.12.1 or newer in release line 26 (see .nvmrc). Run nvm install and nvm use.');
  process.exitCode = 1;
}

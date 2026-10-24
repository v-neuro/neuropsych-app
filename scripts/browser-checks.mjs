import { spawn } from 'node:child_process';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const production = process.argv.includes('--production');
const requested = process.argv.slice(2).filter(arg => arg !== '--production');
const available = (await readdir(new URL('tests/', root))).filter(name => name.endsWith('.browser.mjs')).sort();
const suites = requested.length ? requested.map(name => name.endsWith('.browser.mjs') ? name : `${name}.browser.mjs`) : available;
for (const suite of suites) if (!available.includes(suite)) throw new Error(`Unknown browser suite: ${suite}`);

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function start(command, args) {
  const child = spawn(command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.log = '';
  child.stdout.on('data', data => { child.log = (child.log + data).slice(-32000); });
  child.stderr.on('data', data => { child.log = (child.log + data).slice(-32000); });
  child.on('error', error => { child.startError = error; });
  return child;
}
async function ready(url, child) {
  for (let i = 0; i < 200; i++) {
    if (child?.startError || child?.exitCode != null) throw new Error(child?.startError?.message || child.log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Wait for local process. */ }
    await delay(100);
  }
  throw new Error(`Local test service did not start: ${url}\n${child?.log || ''}`);
}
async function stop(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  for (let i = 0; i < 30 && child.exitCode == null && child.signalCode == null; i++) await delay(100);
  if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL');
}

let chrome, vite, profile;
try {
  let debugUrl = process.env.NPT_CDP_URL;
  if (!debugUrl) {
    const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
    let executable;
    for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try next location. */ } }
    if (!executable) throw new Error('Set CHROME_BIN or NPT_CDP_URL to use a local Chrome/Chromium instance.');
    profile = await mkdtemp(join(tmpdir(), 'npt-browser-'));
    const port = await freePort();
    debugUrl = `http://127.0.0.1:${port}`;
    chrome = start(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank']);
  }
  await ready(`${debugUrl}/json/version`, chrome);
  let appUrl = process.env.NPT_APP_URL;
  if (!appUrl) {
    const port = await freePort();
    appUrl = `http://127.0.0.1:${port}`;
    vite = start(process.execPath, [resolve('node_modules/vite/bin/vite.js'), ...(production ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  }
  await ready(appUrl, vite);
  for (const suite of suites) {
    if (production && suite === 'dev.browser.mjs') continue;
    console.log(`RUN ${suite} (${production ? 'production' : 'development'})`);
    const child = spawn(process.execPath, [new URL(`tests/${suite}`, root).pathname], {
      cwd: root, env: { ...process.env, NPT_CDP_URL: debugUrl, NPT_APP_URL: appUrl }, stdio: 'inherit',
    });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    if (code !== 0) throw new Error(`${suite} failed (exit ${code}).`);
  }
} finally {
  await stop(vite);
  await stop(chrome);
  if (profile) await rm(profile, { recursive: true, force: true });
}

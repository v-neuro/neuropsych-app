import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { csvCell, escapeHtml } from '../src/lib/export-safety.js';
import { drawingImageUrl, isRasterDataUrl } from '../src/lib/raster-image.js';
import { validatePublicDirectory } from '../pwa/build-security.js';
import { isSupportedNode } from '../scripts/check-node.mjs';

test('CSV formulas are escaped without changing scores, empty values, quoting or column structure', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\r=1', '\n=1', '＝1', '＋1', '－1', '＠SUM(A1)']) {
    assert.ok(csvCell(value).startsWith('"\''), JSON.stringify(value));
  }
  assert.equal(csvCell('=1;"\n=2'), '"\'=1;""\n=2"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(-1.5), '"-1.5"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(''), '""');
  assert.equal(csvCell('äöü;"Test"'), '"äöü;""Test"""');
});

test('HTML values and attributes stay literal, including session IDs and image sources', () => {
  assert.equal(escapeHtml('</title><img src=x onerror="x()">&\''), '&lt;/title&gt;&lt;img src=x onerror=&quot;x()&quot;&gt;&amp;&#39;');
  assert.equal(escapeHtml(null), '');
});

test('persisted drawings allow only raster data URLs and raster Blobs', () => {
  for (const mime of ['png', 'jpeg', 'webp']) {
    assert.equal(isRasterDataUrl(`data:image/${mime};base64,AP+A`), true);
  }
  for (const unsafe of ['https://example.invalid/x', 'javascript:alert(1)', 'data:image/svg+xml;base64,AP+A',
    'data:image/png;base64,AP+A," onerror="x()', 'data:image/png;base64,AP+A\n', 'data:image/png;base64,AP+A,', 'data:image/png;base64,A']) {
    assert.equal(isRasterDataUrl(unsafe), false);
    assert.equal(drawingImageUrl(unsafe), null);
  }
  assert.equal(drawingImageUrl(new Blob(['<svg/>'], { type: 'image/svg+xml' })), null);
  const url = drawingImageUrl(new Blob([new Uint8Array([1])], { type: 'image/png' }));
  assert.ok(url.startsWith('blob:'));
  URL.revokeObjectURL(url);
});

test('build rejects sensitive files and symlinks in public instead of publishing them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'npt-public-security-'));
  try {
    mkdirSync(join(directory, 'icons'));
    mkdirSync(join(directory, 'material'));
    writeFileSync(join(directory, 'icons', 'icon.svg'), '<svg/>');
    writeFileSync(join(directory, 'material', 'figure.png'), 'test');
    writeFileSync(join(directory, 'robots.txt'), 'User-agent: *\nDisallow: /');
    writeFileSync(join(directory, 'material', '.DS_Store'), 'synthetic');
    assert.doesNotThrow(() => validatePublicDirectory(directory));
    assert.ok(!validatePublicDirectory(directory).some(name => name.includes('.DS_Store')));
    for (const name of ['.env', 'assessment.npt-backup.json', 'icons/key.pem', 'material/config.php', 'material/notes.txt']) {
      writeFileSync(join(directory, name), 'synthetic');
      assert.throws(() => validatePublicDirectory(directory), /Unexpected public file/);
      rmSync(join(directory, name));
    }
    symlinkSync(join(directory, 'robots.txt'), join(directory, 'material', 'link.png'));
    assert.throws(() => validatePublicDirectory(directory), /symlink/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('runtime guard rejects unpatched and unsupported release lines', () => {
  for (const version of ['22.18.0', '22.23.3', '24.22.0', '26.12.0', '20.99.0', '23.99.0', '25.99.0']) assert.equal(isSupportedNode(version), false, version);
  for (const version of ['22.23.4', '22.24.0', '24.22.1', '26.12.1']) assert.equal(isSupportedNode(version), true, version);
});

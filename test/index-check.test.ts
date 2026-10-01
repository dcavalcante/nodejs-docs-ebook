import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkIndex} from '../src/index-check';
import type {BookManifest} from '../src/types';

const manifest: BookManifest = {
  schemaVersion: 1,
  book: {title: 'Learn Node.js', slug: 'learn-nodejs'},
  source: {repository: 'nodejs/learn', ref: 'main', localDirectory: 'nodejs-learn', sidebar: 'site.json', contentDirectory: 'pages', trackOrder: true},
  sections: [{title: 'Getting Started', pages: [{title: 'Introduction', path: '/learn/getting-started/introduction-to-nodejs'}]}],
};

test('index checker accepts a matching nested sidebar and de-duplicates overview links', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'nodejs-docs-index-'));
  try {
    await fsp.writeFile(path.join(root, 'site.json'), JSON.stringify({sidebar: [{groupName: 'Getting Started', items: [{link: '/learn/getting-started/introduction-to-nodejs', label: 'Introduction', items: [{link: '/learn/getting-started/introduction-to-nodejs', label: 'Overview'}]}]}]}));
    const report = checkIndex(manifest, root);
    assert.equal(report.clean, true);
    assert.equal(report.upstreamPages, 1);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

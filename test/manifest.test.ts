import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {bookId, enabledPages} from '../src/generator';
import {loadManifest, parseManifest} from '../src/manifest';

const projectRoot = path.resolve(__dirname, '../..');

test('project manifest tracks unique Node Learn routes', () => {
  const {manifest} = loadManifest(path.join(projectRoot, 'book.json'));
  const pages = manifest.sections.flatMap((section) => section.pages);
  assert.equal(pages.length, 87);
  assert.equal(new Set(pages.map((page) => page.path)).size, 87);
  assert.equal(enabledPages(manifest), 87);
});

test('book IDs are stable and route-oriented', () => {
  assert.equal(bookId('/learn/asynchronous-work/event-loop-timers-and-nexttick'), 'asynchronous-work-event-loop-timers-and-nexttick');
});

test('manifest rejects unsafe source paths', () => {
  const {manifest} = loadManifest(path.join(projectRoot, 'book.json'));
  const unsafe = structuredClone(manifest) as unknown as Record<string, unknown>;
  const source = unsafe.source as Record<string, unknown>;
  source.sidebar = '../site.json';
  assert.throws(() => parseManifest(unsafe), /safe relative path/);
});

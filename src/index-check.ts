import fs from 'node:fs';
import path from 'node:path';
import type {BookManifest, IndexedPage, IndexedSection, IndexDifference, IndexReport} from './types';

interface SidebarItem { link?: unknown; label?: unknown; items?: unknown; }
interface SiteFile { sidebar?: unknown; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function flattenItems(value: unknown, seen = new Set<string>(), pages: IndexedPage[] = []): IndexedPage[] {
  if (!Array.isArray(value)) return pages;
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const item = raw as SidebarItem;
    if (typeof item.link === 'string' && typeof item.label === 'string' && item.link.startsWith('/learn') && !seen.has(item.link)) {
      seen.add(item.link); pages.push({title: item.label, path: item.link});
    }
    flattenItems(item.items, seen, pages);
  }
  return pages;
}
export function readUpstreamIndex(sourceRoot: string, sidebarPath: string): IndexedSection[] {
  const location = path.join(sourceRoot, sidebarPath);
  const parsed = JSON.parse(fs.readFileSync(location, 'utf8')) as SiteFile;
  if (!Array.isArray(parsed.sidebar)) throw new Error(`${sidebarPath} does not contain a sidebar array`);
  return parsed.sidebar.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.groupName !== 'string') throw new Error(`sidebar[${index}] is invalid`);
    return {title: raw.groupName, pages: flattenItems(raw.items)};
  });
}
export function manifestIndex(manifest: BookManifest): IndexedSection[] {
  return manifest.sections.map((section) => ({title: section.title, pages: section.pages.map((page) => ({title: page.sourceTitle ?? page.title, path: page.path}))}));
}
export function checkIndex(manifest: BookManifest, sourceRoot: string): IndexReport {
  const upstream = readUpstreamIndex(sourceRoot, manifest.source.sidebar);
  const current = manifestIndex(manifest);
  const differences: IndexDifference[] = [];
  const upstreamFlat = upstream.flatMap((section) => section.pages.map((page) => ({...page, section: section.title})));
  const currentFlat = current.flatMap((section) => section.pages.map((page) => ({...page, section: section.title})));
  const upstreamByPath = new Map(upstreamFlat.map((page) => [page.path, page]));
  const currentByPath = new Map(currentFlat.map((page) => [page.path, page]));
  for (const page of upstreamFlat) {
    const known = currentByPath.get(page.path);
    if (!known) differences.push({kind: 'added', path: page.path, detail: `${page.section}: ${page.title}`});
    else {
      if (known.title !== page.title) differences.push({kind: 'renamed', path: page.path, detail: `${known.title} -> ${page.title}`});
      if (known.section !== page.section) differences.push({kind: 'moved', path: page.path, detail: `${known.section} -> ${page.section}`});
    }
  }
  for (const page of currentFlat) if (!upstreamByPath.has(page.path)) differences.push({kind: 'removed', path: page.path, detail: `${page.section}: ${page.title}`});
  if (manifest.source.trackOrder !== false) {
    const upstreamOrder = upstreamFlat.map((page) => page.path);
    const currentOrder = currentFlat.map((page) => page.path);
    const sharedUpstream = upstreamOrder.filter((route) => currentByPath.has(route));
    const sharedCurrent = currentOrder.filter((route) => upstreamByPath.has(route));
    if (sharedUpstream.join('\n') !== sharedCurrent.join('\n')) differences.push({kind: 'moved', path: '(order)', detail: 'Sidebar page order differs from book.json'});
  }
  return {clean: differences.length === 0, differences, upstreamPages: upstreamFlat.length, manifestPages: currentFlat.length};
}
export function formatIndexReport(report: IndexReport): string {
  if (report.clean) return `book.json matches upstream (${report.upstreamPages} pages).`;
  const lines = [`book.json differs from upstream (${report.manifestPages} manifest / ${report.upstreamPages} upstream):`];
  for (const difference of report.differences) lines.push(`- ${difference.kind}: ${difference.path} — ${difference.detail}`);
  return lines.join('\n');
}

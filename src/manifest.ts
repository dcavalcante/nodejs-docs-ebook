import fs from 'node:fs';
import path from 'node:path';
import type {BookManifest, BookPage, BookSection} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: readonly string[], context: string): void {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${context} contains unknown properties: ${unknown.join(', ')}`);
}

function requiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context}.${key} must be a non-empty string`);
  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string, context: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${context}.${key} must be a boolean`);
  return value;
}

function safeRelativePath(candidate: string, context: string): string {
  if (path.isAbsolute(candidate) || candidate.includes('\\') || candidate.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error(`${context} must be a safe relative path`);
  }
  return candidate;
}

function parsePage(value: unknown, context: string): BookPage {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  rejectUnknownKeys(value, ['title', 'sourceTitle', 'path', 'enabled'], context);
  const enabled = optionalBoolean(value, 'enabled', context);
  const sourceTitle = value.sourceTitle;
  if (sourceTitle !== undefined && (typeof sourceTitle !== 'string' || sourceTitle.length === 0)) {
    throw new Error(`${context}.sourceTitle must be a non-empty string`);
  }
  const route = requiredString(value, 'path', context);
  if (!/^\/learn(?:\/[a-z0-9][a-z0-9-]*)*$/.test(route)) throw new Error(`${context}.path must be a safe /learn route`);
  return {title: requiredString(value, 'title', context), ...(sourceTitle === undefined ? {} : {sourceTitle}), path: route, ...(enabled === undefined ? {} : {enabled})};
}

function parseSection(value: unknown, context: string): BookSection {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  rejectUnknownKeys(value, ['title', 'enabled', 'pages'], context);
  if (!Array.isArray(value.pages)) throw new Error(`${context}.pages must be an array`);
  const enabled = optionalBoolean(value, 'enabled', context);
  return {title: requiredString(value, 'title', context), ...(enabled === undefined ? {} : {enabled}), pages: value.pages.map((page, index) => parsePage(page, `${context}.pages[${index}]`))};
}

export function parseManifest(value: unknown): BookManifest {
  if (!isRecord(value)) throw new Error('Manifest must be an object');
  rejectUnknownKeys(value, ['$schema', 'schemaVersion', 'book', 'source', 'sections'], 'Manifest');
  if (value.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!isRecord(value.book)) throw new Error('book must be an object');
  if (!isRecord(value.source)) throw new Error('source must be an object');
  if (!Array.isArray(value.sections)) throw new Error('sections must be an array');
  rejectUnknownKeys(value.book, ['title', 'subtitle', 'language', 'slug'], 'book');
  rejectUnknownKeys(value.source, ['repository', 'ref', 'localDirectory', 'sidebar', 'contentDirectory', 'trackOrder'], 'source');
  const subtitle = value.book.subtitle;
  const language = value.book.language;
  if (subtitle !== undefined && typeof subtitle !== 'string') throw new Error('book.subtitle must be a string');
  if (language !== undefined && (typeof language !== 'string' || language.trim().length === 0)) throw new Error('book.language must be a non-empty string');
  const slug = requiredString(value.book, 'slug', 'book');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('book.slug must contain only lowercase letters, numbers, and hyphens');
  const repository = requiredString(value.source, 'repository', 'source');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('source.repository must be owner/repository');
  const trackOrder = optionalBoolean(value.source, 'trackOrder', 'source');
  const manifest: BookManifest = {
    schemaVersion: 1,
    book: {title: requiredString(value.book, 'title', 'book'), slug, ...(subtitle === undefined ? {} : {subtitle}), ...(language === undefined ? {} : {language})},
    source: {
      repository,
      ref: requiredString(value.source, 'ref', 'source'),
      localDirectory: safeRelativePath(requiredString(value.source, 'localDirectory', 'source'), 'source.localDirectory'),
      sidebar: safeRelativePath(requiredString(value.source, 'sidebar', 'source'), 'source.sidebar'),
      contentDirectory: safeRelativePath(requiredString(value.source, 'contentDirectory', 'source'), 'source.contentDirectory'),
      ...(trackOrder === undefined ? {} : {trackOrder}),
    },
    sections: value.sections.map((section, index) => parseSection(section, `sections[${index}]`)),
  };
  const routes = manifest.sections.flatMap((section) => section.pages.map((page) => page.path));
  const duplicate = routes.find((route, index) => routes.indexOf(route) !== index);
  if (duplicate) throw new Error(`Manifest contains duplicate route: ${duplicate}`);
  return manifest;
}

export function loadManifest(location: string): {manifestPath: string; manifest: BookManifest} {
  const manifestPath = path.resolve(location);
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown; }
  catch (error) { throw new Error(`Could not read manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`); }
  return {manifestPath, manifest: parseManifest(parsed)};
}

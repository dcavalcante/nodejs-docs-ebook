import fs from 'node:fs';
import path from 'node:path';
import type {BookManifest, GeneratedBook} from './types';

function sourceForRoute(sourceRoot: string, contentDirectory: string, routePath: string): string | undefined {
  const relative = routePath.replace(/^\/learn\/?/, '');
  const base = path.join(sourceRoot, contentDirectory);
  return [
    path.join(base, `${relative}.md`),
    path.join(base, relative, 'index.md'),
  ].find(fs.existsSync);
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

export function bookId(value: string): string {
  return value
    .replace(/^\/learn\/?/, '')
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'learn';
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function pageWrapper(routePath: string, sourceFile: string, sourceRoot: string, source: string): string {
  const sourceDir = path.relative(sourceRoot, path.dirname(sourceFile)).split(path.sep).join('/');
  const prefix = bookId(routePath);
  return [
    `::: {.book-page route=${yamlString(routePath)} page-prefix=${yamlString(prefix)} source-dir=${yamlString(sourceDir)}}`,
    stripFrontmatter(source).trim(),
    ':::',
  ].join('\n');
}

function editionNotice(manifest: BookManifest, revision: string): string {
  return [
    '# About this unofficial edition {#about-this-edition}',
    '',
    `**${manifest.book.title}** is an unofficial EPUB adaptation generated from the Node.js Learn source repository.`,
    '',
    'It is not produced or endorsed by the Node.js project or the OpenJS Foundation.',
    '',
    `Source repository: [${manifest.source.repository}](https://github.com/${manifest.source.repository}).`,
    '',
    `Source revision: \`${revision || manifest.source.ref}\`.`,
    '',
    'This generator preserves the upstream prose and code as closely as practical while rewriting book-internal links, restructuring headings for an EPUB table of contents, embedding a monospace font, and applying ebook-specific typography.',
    '',
    'The generator code and the upstream documentation are separate works. Check the upstream repository and project terms before redistributing generated editions.',
  ].join('\n');
}

export function enabledPages(manifest: BookManifest): number {
  return manifest.sections
    .filter((section) => section.enabled !== false)
    .reduce((count, section) => count + section.pages.filter((page) => page.enabled !== false).length, 0);
}

export function generateBook(manifest: BookManifest, sourceRoot: string, revision: string, editionDate: string): GeneratedBook {
  const output: string[] = [
    '---',
    `title: ${yamlString(manifest.book.title)}`,
    `subtitle: ${yamlString(manifest.book.subtitle ?? '')}`,
    `lang: ${yamlString(manifest.book.language ?? 'en')}`,
    `date: ${yamlString(editionDate)}`,
    '---',
    '',
    editionNotice(manifest, revision),
  ];
  const sourceDirectories = new Set<string>();
  let pageCount = 0;

  for (const section of manifest.sections) {
    if (section.enabled === false) continue;
    output.push('', `# ${section.title} {#part-${bookId(section.title)}}`);
    for (const page of section.pages) {
      if (page.enabled === false) continue;
      const sourceFile = sourceForRoute(sourceRoot, manifest.source.contentDirectory, page.path);
      if (!sourceFile) throw new Error(`Missing Markdown source for ${page.path}`);
      sourceDirectories.add(path.dirname(sourceFile));
      output.push(
        '',
        `## ${page.title} {#page-${bookId(page.path)}}`,
        '',
        pageWrapper(page.path, sourceFile, sourceRoot, fs.readFileSync(sourceFile, 'utf8')),
      );
      pageCount += 1;
    }
  }

  return {
    markdown: `${output.join('\n').replace(/\n{4,}/g, '\n\n\n')}\n`,
    pageCount,
    sourceDirectories: [...sourceDirectories].sort(),
  };
}

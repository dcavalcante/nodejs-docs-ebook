import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dependencyError} from './dependencies';
import {preparePlexFonts} from './fonts';
import {generateBook} from './generator';
import {PROJECT_ROOT, resolveSource, sourceRevision} from './source';
import type {BookManifest, BuildMetadata, BuildOptions, BuildResult} from './types';

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}
function generatorVersion(): string {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  return typeof parsed === 'object' && parsed !== null && 'version' in parsed && typeof parsed.version === 'string' ? parsed.version : 'unknown';
}
async function publishOutputs(staged: ReadonlyMap<string, string>): Promise<void> {
  const backups = new Map<string, string>(); const published: string[] = [];
  try {
    for (const destination of staged.values()) {
      if (!fs.existsSync(destination)) continue;
      const backup = `${destination}.previous-${process.pid}-${randomUUID()}`;
      await fsp.rename(destination, backup); backups.set(destination, backup);
    }
    for (const [temporary, destination] of staged) { await fsp.rename(temporary, destination); published.push(destination); }
  } catch (error) {
    await Promise.all(published.map((destination) => fsp.rm(destination, {force: true})));
    for (const [destination, backup] of backups) if (fs.existsSync(backup)) await fsp.rename(backup, destination);
    throw error;
  }
  await Promise.allSettled([...backups.values()].map((backup) => fsp.rm(backup, {force: true})));
}

export async function build(manifest: BookManifest, options: BuildOptions = {}): Promise<BuildResult> {
  const deps = dependencyError();
  if (!deps.result.hasPandoc) throw new Error(`Missing build dependencies.\n\n${deps.message}`);
  const sourceRoot = await resolveSource(manifest, options);
  const source = sourceRevision(sourceRoot, options.ref ?? manifest.source.ref);
  const generatedAt = new Date();
  const editionDate = generatedAt.toISOString().slice(0, 10);
  const diagramMode = options.diagramMode ?? 'text';
  const modeSuffix = diagramMode === 'text' ? '' : `-${diagramMode}`;
  const outputStem = `${manifest.book.slug}-${editionDate}${modeSuffix}`;
  const invocationRoot = process.cwd();
  const outputDir = path.resolve(invocationRoot, options.outputDir ?? 'dist');
  const workDir = path.resolve(invocationRoot, options.workDir ?? path.join('.nodejs-docs-ebook', 'work'));
  await Promise.all([fsp.mkdir(outputDir, {recursive: true}), fsp.mkdir(workDir, {recursive: true})]);
  const generated = generateBook(manifest, sourceRoot, source.revision, editionDate);
  const markdownFile = path.join(workDir, `${outputStem}.md`);
  const temporaryMarkdown = `${markdownFile}.${process.pid}.tmp`;
  await fsp.writeFile(temporaryMarkdown, generated.markdown); await fsp.rename(temporaryMarkdown, markdownFile);
  const {regular, bold} = await preparePlexFonts(workDir);
  const resourcePaths = [sourceRoot, ...generated.sourceDirectories];
  const common = [markdownFile, '--from=markdown+fenced_divs', '--toc', '--toc-depth=2', '--split-level=2', '--no-highlight', `--resource-path=${resourcePaths.join(path.delimiter)}`, `--metadata=diagram-mode:${diagramMode}`, `--lua-filter=${path.join(PROJECT_ROOT, 'filters', 'ebook.lua')}`, `--css=${path.join(PROJECT_ROOT, 'styles', 'epub.css')}`, `--epub-embed-font=${regular}`, `--epub-embed-font=${bold}`];
  const outputs: string[] = []; const stagedOutputs = new Map<string, string>();
  try {
    const output = path.join(outputDir, `${outputStem}.epub`);
    const temporary = path.join(outputDir, `.${outputStem}.${process.pid}-${randomUUID()}.tmp.epub`);
    stagedOutputs.set(temporary, output); run('pandoc', [...common, `--output=${temporary}`]); outputs.push(output);
    const metadata: BuildMetadata = {generatedAt: generatedAt.toISOString(), editionDate, generatorVersion: generatorVersion(), sourceRepository: manifest.source.repository, sourceRevision: source.revision, sourceDirty: source.dirty, sourceRef: options.ref ?? manifest.source.ref, pages: generated.pageCount, outputs: outputs.map((item) => path.basename(item))};
    const metadataFile = path.join(outputDir, 'build-metadata.json');
    const temporaryMetadata = path.join(outputDir, `.build-metadata.${process.pid}.json.tmp`);
    await fsp.writeFile(temporaryMetadata, `${JSON.stringify(metadata, null, 2)}\n`); stagedOutputs.set(temporaryMetadata, metadataFile);
    await publishOutputs(stagedOutputs); return {outputs, metadata, markdownFile};
  } finally { await Promise.all([...stagedOutputs.keys()].map((temporary) => fsp.rm(temporary, {force: true}))); }
}

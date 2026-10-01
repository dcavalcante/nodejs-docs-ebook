import path from 'node:path';
import {build} from './build';
import {dependencyError} from './dependencies';
import {checkIndex, formatIndexReport} from './index-check';
import {loadManifest} from './manifest';
import {PROJECT_ROOT, resolveSource} from './source';
import type {CliOptions} from './types';

export function usage(): string {
  return `nodejs-docs-book\n\nCommands:\n  build           Build the EPUB\n  check-updates   Compare book.json with nodejs/learn site.json\n  doctor          Check Pandoc availability\n\nCommon options:\n  --manifest PATH       Manifest path (default: book.json)\n  --source PATH|github  Local nodejs/learn checkout or GitHub archive\n  --ref REF             Git branch, tag, or commit (default from manifest)\n  --refresh             Redownload a GitHub source archive\n  --download            Download source even when a local checkout exists\n\nBuild options:\n  --output-dir PATH     Output directory (default: dist)\n  --work-dir PATH       Intermediate directory (default: .nodejs-docs-ebook/work)`;
}

const booleanOptions = new Set(['refresh', 'download', 'help']);
const valueOptions = new Set(['manifest', 'source', 'ref', 'outputDir', 'workDir']);
function setBooleanOption(options: CliOptions, key: string): void { if (key === 'refresh') options.refresh = true; else if (key === 'download') options.download = true; else if (key === 'help') options.help = true; }
function setStringOption(options: CliOptions, key: string, value: string): void { if (key === 'manifest') options.manifest = value; else if (key === 'source') options.source = value; else if (key === 'ref') options.ref = value; else if (key === 'outputDir') options.outputDir = value; else if (key === 'workDir') options.workDir = value; }
function camelCase(value: string): string { return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()); }

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {_positionals: []};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (!arg.startsWith('--')) { options._positionals.push(arg); continue; }
    const [rawKey = '', inline] = arg.slice(2).split('=', 2);
    const key = camelCase(rawKey);
    if (booleanOptions.has(key)) { if (inline !== undefined) throw new Error(`--${rawKey} is a flag and does not take a value`); setBooleanOption(options, key); continue; }
    if (!valueOptions.has(key)) throw new Error(`Unknown option: --${rawKey}`);
    const value = inline ?? argv[++index];
    if (!value || (inline === undefined && value.startsWith('--'))) throw new Error(`Missing value for --${rawKey}`);
    setStringOption(options, key, value);
  }
  if (options._positionals.length > 1) throw new Error(`Unexpected argument: ${options._positionals[1]}`);
  return options;
}

export async function main(argv: readonly string[]): Promise<void> {
  const options = parseArgs(argv);
  const command = options._positionals[0] ?? 'build';
  if (options.help || command === 'help') { console.log(usage()); return; }
  if (!['build', 'check-updates', 'doctor'].includes(command)) throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  if (command === 'doctor') { const report = dependencyError(); console.log(report.message); if (!report.result.hasPandoc) process.exitCode = 1; return; }
  const {manifest} = loadManifest(options.manifest ?? path.join(PROJECT_ROOT, 'book.json'));
  if (command === 'check-updates') {
    const sourceRoot = await resolveSource(manifest, options);
    const report = checkIndex(manifest, sourceRoot);
    console.log(formatIndexReport(report));
    if (!report.clean) process.exitCode = 2;
    return;
  }
  const result = await build(manifest, options);
  console.log(`Built ${result.metadata.pages} pages from ${result.metadata.sourceRevision}:`);
  for (const output of result.outputs) console.log(`  ${output}`);
}

import fsp from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {dependencyError} from './dependencies';
import {preparePlexFonts} from './fonts';
import {PROJECT_ROOT} from './source';

const DIAGRAM = `   ┌───────────────────────────┐
   │           timers          │
   └─────────────┬─────────────┘
                 │
                 v
   ┌───────────────────────────┐
┌─>│     pending callbacks     │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘      ┌───────────────┐
│  ┌─────────────┴─────────────┐      │   incoming:   │
│  │           poll            │<─────┤  connections, │
│  └─────────────┬─────────────┘      │   data, etc.  │
│  ┌─────────────┴─────────────┐      └───────────────┘
│  │           check           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      close callbacks      │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤           timers          │
   └───────────────────────────┘`;

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export async function buildDiagramLab(): Promise<string> {
  const deps = dependencyError();
  if (!deps.result.hasPandoc) throw new Error(`Missing build dependencies.\n\n${deps.message}`);

  const buildStamp = stamp();
  const outputDir = path.resolve(process.cwd(), 'dist');
  const workDir = path.resolve(process.cwd(), '.nodejs-docs-ebook', 'diagram-lab');
  await Promise.all([
    fsp.mkdir(outputDir, {recursive: true}),
    fsp.mkdir(workDir, {recursive: true}),
  ]);
  const {regular, bold} = await preparePlexFonts(workDir);

  const variants = [
    ['A — baseline', 'lab-baseline'],
    ['B — one extra ASCII space on first line', 'lab-extra-ascii'],
    ['C — zero-width-space sentinel before first line', 'lab-zwsp'],
    ['D — U+FEFF zero-width sentinel before first line', 'lab-feff'],
    ['E — U+2007 figure spaces for first-line indentation', 'lab-figure-space'],
    ['F — U+2002 en spaces for first-line indentation', 'lab-en-space'],
    ['G — baseline with inline <code> instead of block <code>', 'lab-inline-code'],
  ] as const;

  const markdown = [
    '---',
    `title: "Node.js Diagram Lab ${buildStamp}"`,
    'lang: "en-US"',
    '---',
    '',
    '# Kindle Unicode diagram lab',
    '',
    `Build ID: **${buildStamp}**`,
    '',
    'This file intentionally contains several renderings of the same original Unicode diagram. Do not judge the labels; only check whether the **top-left corner of the first box lines up with the left vertical edge immediately below it**.',
    '',
    ...variants.flatMap(([title, className]) => [
      `## ${title}`,
      '',
      `\`\`\`{.text-diagram .${className}}`,
      DIAGRAM,
      '\`\`\`',
      '',
    ]),
  ].join('\n');

  const markdownFile = path.join(workDir, `diagram-lab-${buildStamp}.md`);
  await fsp.writeFile(markdownFile, markdown);
  const output = path.join(outputDir, `diagram-lab-${buildStamp}.epub`);

  run('pandoc', [
    markdownFile,
    '--from=markdown+fenced_code_attributes',
    '--no-highlight',
    `--lua-filter=${path.join(PROJECT_ROOT, 'filters', 'diagram-lab.lua')}`,
    `--css=${path.join(PROJECT_ROOT, 'styles', 'epub.css')}`,
    `--css=${path.join(PROJECT_ROOT, 'styles', 'diagram-lab.css')}`,
    `--epub-embed-font=${regular}`,
    `--epub-embed-font=${bold}`,
    `--output=${output}`,
  ]);

  console.log(`Built diagram lab:\n  ${output}`);
  console.log(`Build ID: ${buildStamp}`);
  return output;
}

if (require.main === module) {
  buildDiagramLab().catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

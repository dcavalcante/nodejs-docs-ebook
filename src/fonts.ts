import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {sourceCacheRoot} from './source';

const IBM_PLEX_REVISION = '03dea6f4809b5b8b8e3cc3afbedf825379d97900';
const FONT_BASE =
  `https://raw.githubusercontent.com/IBM/plex/${IBM_PLEX_REVISION}/packages/plex-mono/fonts/complete/ttf`;

const FONTS = ['IBMPlexMono-Regular.ttf', 'IBMPlexMono-Bold.ttf'] as const;

async function downloadFont(name: (typeof FONTS)[number], destination: string): Promise<void> {
  const response = await fetch(`${FONT_BASE}/${name}`, {
    headers: {'user-agent': 'nodejs-docs-ebook'},
  });
  if (!response.ok) {
    throw new Error(
      `Could not download ${name} from IBM Plex (${response.status} ${response.statusText})`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100_000) {
    throw new Error(`Downloaded IBM Plex font looks invalid: ${name} (${bytes.length} bytes)`);
  }
  const temporary = `${destination}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, bytes, {flag: 'wx'});
  await fsp.rename(temporary, destination);
}

export async function preparePlexFonts(workDir: string): Promise<{regular: string; bold: string}> {
  const cacheDir = path.join(sourceCacheRoot(), 'fonts', 'ibm-plex-mono', IBM_PLEX_REVISION);
  await fsp.mkdir(cacheDir, {recursive: true});

  for (const name of FONTS) {
    const cached = path.join(cacheDir, name);
    if (!fs.existsSync(cached)) {
      console.log(`Downloading IBM Plex Mono ${name}...`);
      await downloadFont(name, cached);
    }
  }

  const fontDir = path.join(workDir, 'fonts');
  await fsp.mkdir(fontDir, {recursive: true});
  const regular = path.join(fontDir, FONTS[0]);
  const bold = path.join(fontDir, FONTS[1]);
  await Promise.all([
    fsp.copyFile(path.join(cacheDir, FONTS[0]), regular),
    fsp.copyFile(path.join(cacheDir, FONTS[1]), bold),
  ]);
  return {regular, bold};
}

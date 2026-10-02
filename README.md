# Node.js Docs Ebook

Build an unofficial EPUB edition of the current Node.js Learn documentation without modifying the upstream `nodejs/learn` repository.

**[Download the latest published edition](https://github.com/dcavalcante/nodejs-docs-ebook/releases/latest)**

The generator is intentionally similar to `react-docs-ebook`: it can use a local sibling checkout for development or download and cache a pinned GitHub revision for standalone builds. The book structure is declared in `book.json`, which can be checked against upstream `site.json` for additions, removals, renames, moves, and ordering changes.

## Local layout

The easiest development layout is:

```text
~/Projects/
├── nodejs-learn/
└── nodejs-docs-ebook/
```

The source checkout does **not** have to be exactly `../nodejs-learn`. Source discovery walks upward from the invocation directory and checks each ancestor plus `<ancestor>/nodejs-learn`. You can always override it with `--source PATH`, `NODEJS_LEARN_SOURCE`, or `--source github`.

Clone upstream beside this project with:

```bash
cd ~/Projects
gh repo clone nodejs/learn nodejs-learn
```

## Requirements

- Node.js 18 or newer
- Pandoc
- `tar` only when downloading the upstream source from GitHub

Install dependencies:

```bash
npm install
```

Check the machine:

```bash
npm run doctor
```

## Build

With a sibling `nodejs-learn` checkout:

```bash
npm run build
```

With an explicit checkout:

```bash
npm run build -- --source ../nodejs-learn
```

Without a checkout, download and cache current upstream `main`:

```bash
npm run build -- --source github --ref main
```

Outputs are written to `dist/`:

```text
dist/
├── learn-nodejs-YYYY-MM-DD.epub
└── build-metadata.json
```

Intermediate generated Markdown is kept under `.nodejs-docs-ebook/work/` so it can be inspected when a conversion problem appears.

## Check the upstream Learn index

`book.json` is the book-facing table of contents. It currently tracks every unique article exposed by the Node.js Learn sidebar while de-duplicating nested `Overview` entries that point to the same route.

Check it against the local upstream checkout:

```bash
npm run check-updates
```

Or current GitHub `main`:

```bash
npm run check-updates -- --source github --ref main --refresh
```

The command exits with status `2` when the manifest needs review.

## Unicode box-drawing diagrams

The Node.js event-loop illustration stays as its original Unicode box-drawing text in the source and in the generated EPUB. A Pandoc Lua filter detects code blocks containing Unicode Box Drawing characters (`U+2500–U+257F`) and applies diagram-specific markup and styling only to those blocks.

The EPUB:

- embeds the **complete** IBM Plex Mono regular and bold TrueType fonts;
- keeps ordinary code at `white-space: pre-wrap` so long source lines can wrap on narrow readers;
- renders box-drawing blocks as a fixed monospace grid with wrapping, hyphenation, kerning, and ligatures disabled;
- uses a wrapper for visual padding while keeping the inner `pre/code` geometry at zero;
- inserts a zero-width, non-whitespace `U+2060 WORD JOINER` sentinel before the first diagram text node. This prevents Kindle/Send to Kindle from shifting only the first row of the grid during conversion;
- renders diagrams at `0.70em` so the widest Node diagrams fit typical portrait e-reader viewports.

The Unicode renderer is the default. An SVG renderer remains available as a fallback via `--diagram-mode svg`.

### Validation

After building, open **Asynchronous Work → The Node.js Event Loop** and check that:

1. corners and junctions line up;
2. `incoming: connections, data, etc.` stays inside its box instead of wrapping;
3. the left return arrow remains continuous;
4. changing the reader's body font does not change the diagram's monospace font;
5. normal code blocks elsewhere still wrap instead of overflowing.

The Unicode path, including the `U+2060` first-node workaround, has been validated on a Kindle Paperwhite through Send to Kindle.

## Conversion model

The generator does not copy Node documentation into this repository. At build time it reads the selected upstream checkout and generates a single intermediate Markdown book.

Each article is wrapped in a temporary Pandoc fenced `Div` carrying its original route and source directory. `filters/ebook.lua` then performs output-specific transformations in Pandoc's AST:

- removes each source article's duplicate top-level heading;
- shifts article headings beneath the book's section/page hierarchy;
- prefixes heading IDs so anchors are unique across the whole book;
- rewrites `/learn/...`, relative article links, and fragment links to EPUB-local anchors;
- resolves relative images against the original article directory;
- identifies Unicode box-drawing code blocks for Kindle-safe styling.

This keeps the upstream Markdown as close to untouched as possible and avoids a Node-specific MDX conversion layer.

## Tests

```bash
npm test
```

The initial suite checks the manifest shape, route uniqueness/count, stable route IDs, unsafe source-path rejection, and nested-sidebar de-duplication.

## Automation and releases

GitHub Actions runs the test suite and builds both the default Unicode EPUB and the SVG fallback on pull requests and pushes. It also runs weekly and can be started manually against a selected `nodejs/learn` ref.

Pushing a `v*` tag publishes a GitHub Release containing the default EPUB and `build-metadata.json`. The SVG build remains a CI artifact and fallback rather than a second public edition.

## Licensing

The generator code is MIT-licensed. Generated books incorporate upstream Node.js documentation and remain subject to upstream terms; see `NOTICE.md`. The tagged-release workflow is configured, but public release tags should wait until the current `nodejs/learn` documentation licensing/attribution path is confirmed.

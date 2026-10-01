export interface BookPage {
  title: string;
  sourceTitle?: string;
  path: string;
  enabled?: boolean;
}

export interface BookSection {
  title: string;
  enabled?: boolean;
  pages: BookPage[];
}

export interface BookManifest {
  schemaVersion: 1;
  book: {
    title: string;
    subtitle?: string;
    language?: string;
    slug: string;
  };
  source: {
    repository: string;
    ref: string;
    localDirectory: string;
    sidebar: string;
    contentDirectory: string;
    trackOrder?: boolean;
  };
  sections: BookSection[];
}

export interface SourceOptions {
  source?: string;
  ref?: string;
  refresh?: boolean;
  download?: boolean;
}

export interface BuildOptions extends SourceOptions {
  outputDir?: string;
  workDir?: string;
}

export interface CliOptions extends BuildOptions {
  manifest?: string;
  help?: boolean;
  _positionals: string[];
}

export interface SourceRevision {
  revision: string;
  dirty: boolean;
}

export interface IndexedPage {
  title: string;
  path: string;
}

export interface IndexedSection {
  title: string;
  pages: IndexedPage[];
}

export interface IndexDifference {
  kind: 'added' | 'removed' | 'renamed' | 'moved';
  path: string;
  detail: string;
}

export interface IndexReport {
  clean: boolean;
  differences: IndexDifference[];
  upstreamPages: number;
  manifestPages: number;
}

export interface GeneratedBook {
  markdown: string;
  pageCount: number;
  sourceDirectories: string[];
}

export interface BuildMetadata {
  generatedAt: string;
  editionDate: string;
  generatorVersion: string;
  sourceRepository: string;
  sourceRevision: string;
  sourceDirty: boolean;
  sourceRef: string;
  pages: number;
  outputs: string[];
}

export interface BuildResult {
  outputs: string[];
  metadata: BuildMetadata;
  markdownFile: string;
}

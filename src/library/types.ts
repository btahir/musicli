export interface LibraryCategory {
  slug: string;
  label: string;
  description: string;
  trackCount: number;
}

export interface TrackCatalogEntry {
  title: string;
  slug: string;
  category: string;
  categoryLabel: string;
  file: string;
  sizeBytes?: number;
  sha256?: string;
}

export interface TrackCatalog {
  schemaVersion: 1;
  generatedAt: string;
  sourceDirectory: string;
  trackCount: number;
  fileCount: number;
  categories: LibraryCategory[];
  tracks: TrackCatalogEntry[];
}

export interface LibraryPackManifest {
  schemaVersion: 1;
  pack: string;
  title: string;
  version: string;
  generatedAt: string;
  description?: string;
  trackCount: number;
  categories: LibraryCategory[];
  tracks: TrackCatalogEntry[];
}

export interface LibraryPackRef {
  title: string;
  description?: string;
  manifest: string;
  trackCount?: number;
}

export interface LibraryRepositoryManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  version: string;
  generatedAt: string;
  contentBase: string;
  catalog: string;
  packs: Record<string, LibraryPackRef>;
}

export interface InstalledLibraryState {
  schemaVersion: 1;
  installedAt: string;
  repositoryId: string;
  repositoryTitle: string;
  repositoryVersion: string;
  lastInstalledPack: string;
  trackCount: number;
}

export interface RuntimeTrack extends TrackCatalogEntry {
  filePath: string;
}

export interface RuntimeLibraryCatalog extends TrackCatalog {
  source: 'bundled' | 'installed' | 'local';
  rootDir: string;
  tracks: RuntimeTrack[];
}

export interface InstallPackOptions {
  pack: string;
  source?: string;
  force?: boolean;
  targetRoot?: string;
}

export interface InstallPackResult {
  libraryRoot: string;
  repositoryId: string;
  repositoryTitle: string;
  repositoryVersion: string;
  pack: string;
  copied: number;
  skipped: number;
  total: number;
  trackCount: number;
}

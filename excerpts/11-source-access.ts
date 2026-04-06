/**
 * Extracted from:
 *   workers/api/src/ssot/sourceAccess.ts
 *
 * Why this excerpt matters:
 * - source access is intent-shaped, not just path-shaped
 * - the SSOT owns visibility, entry selection, and stable source identity
 * - legacy callers still flow through a compatibility layer instead of inventing their own rules
 */

export type SourceAccessIntent =
  | "viewer"
  | "studio"
  | "clone"
  | "export"
  | "compile"
  | "deploy"
  | "operator";

export interface SourceAccessRef {
  capsuleId: string;
  ownerId?: string;
  contentHash?: string;
}

export type SourceAccessRequest = SourceAccessRef & { env: Env };

/**
 * Low-context request shape for source-access entrypoints.
 *
 * WHY: internal callers that already loaded the capsule row should pass owner/hash through
 * SourceIdentity so the path owner does not get rediscovered from ambient context.
 */
export interface SourceIdentity {
  env: Env;
  capsuleId: string;
  ownerId: string;
  contentHash?: string;
}

export function buildSourceIdentity(
  env: Env,
  capsule: {
    id: string;
    owner_id: string;
    hash?: string | null;
  }
): SourceIdentity {
  return {
    env,
    capsuleId: capsule.id,
    ownerId: capsule.owner_id,
    ...(typeof capsule.hash === "string" && capsule.hash.trim()
      ? { contentHash: capsule.hash }
      : {}),
  };
}

export type SourceFileKind =
  | "user_source"
  | "source_metadata"
  | "internal_user_module"
  | "system_metadata"
  | "entry_shim"
  | "compiled_output"
  | "sensitive";

export interface SourceFileEntry {
  path: string;
  displayPath: string;
  kind: SourceFileKind;
  sizeBytes: number | null;
  contentType: string | null;
  isText: boolean;
}

export type SourceEntrySelectionReason =
  | "manifest_exact"
  | "manifest_alias"
  | "package_json"
  | "convention"
  | "html_singleton"
  | "single_file"
  | "none";

export interface SourceEntryPoint {
  path: string | null;
  displayPath: string | null;
  selectedBy: SourceEntrySelectionReason;
  candidates: string[];
}

export interface SourceMetadata {
  hasSrcStructure: boolean;
  fileCount: number;
  totalSizeBytes: number;
  hasPackageJson: boolean;
  packageJsonPath: string | null;
  lockfilePaths: string[];
  hasServerCode: boolean;
}

export interface SourceFileBody extends SourceFileEntry {
  bytes: Uint8Array;
  text: string | null;
}

export interface SourceSnapshot {
  files: SourceFileEntry[];
  entry: Promise<SourceEntryPoint>;
  metadata: Promise<SourceMetadata>;
  read(path: string): Promise<SourceFileBody>;
}

export type SourceAccessSubject = SourceAccessRequest | SourceSnapshot;

export type SourceAccessErrorCode =
  | "capsule_not_found"
  | "invalid_path"
  | "file_not_found"
  | "file_blocked_by_policy"
  | "entry_not_found"
  | "snapshot_incomplete";

export class SourceAccessError extends Error {
  code: SourceAccessErrorCode;

  constructor(code: SourceAccessErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "SourceAccessError";
  }
}

type CapsuleRow = {
  id: string;
  owner_id?: string | null;
  hash?: string | null;
  manifest_json: string | null;
};

type NormalizedSourceEntry = SourceFileEntry & {
  storedPath: string;
  r2Key: string;
  hash: string | null;
  source: GatewayFileListEntry["source"];
};

type ResolvedSourceContext = {
  env: Env;
  capsuleId: string;
  ownerId: string;
  contentHash: string;
  manifest: Manifest | null;
};

type InternalSourceSnapshot = SourceSnapshot & {
  __context: ResolvedSourceContext;
  __rawIndex: Map<string, NormalizedSourceEntry>;
  __visibleIndex: Map<string, NormalizedSourceEntry>;
};

type InternalSourceState = {
  context: ResolvedSourceContext;
  rawIndex: Map<string, NormalizedSourceEntry>;
  visibleIndex: Map<string, NormalizedSourceEntry>;
  files: SourceFileEntry[];
  read(path: string): Promise<SourceFileBody>;
  getEntry(): Promise<SourceEntryPoint>;
  getMetadata(): SourceMetadata;
};

export type SourceFileObject = {
  entry: SourceFileEntry;
  object: GatewayReadResult["object"];
  storedPath: string;
  r2Key: string;
  hash: string | null;
  source: GatewayReadResult["source"];
};

export type SourceFileReference = {
  entry: SourceFileEntry;
  storedPath: string;
  r2Key: string;
  hash: string | null;
  source: GatewayReadResult["source"];
};

const SOURCE_METADATA_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "deno.json",
  "deno.jsonc",
  "deno.lock",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.cts",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "astro.config.mjs",
  "astro.config.ts",
  "svelte.config.js",
  "svelte.config.cjs",
  "svelte.config.mjs",
  "svelte.config.ts",
  "tailwind.config.js",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.cjs",
  "postcss.config.mjs",
  "postcss.config.ts",
  "eslint.config.js",
  "eslint.config.cjs",
  "eslint.config.mjs",
  "eslint.config.ts",
]);

const LOCKFILE_FILENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "deno.lock",
]);

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

// WHY: each intent gets a different visibility envelope so the same capsule can serve
// viewer, studio, clone/export, compile/deploy, and operator flows without conflating them.
const INTENT_INCLUDE_KINDS: Record<SourceAccessIntent, Set<SourceFileKind>> = {
  viewer: new Set(["user_source", "source_metadata", "internal_user_module"]),
  studio: new Set([
    "user_source",
    "source_metadata",
    "internal_user_module",
    "sensitive",
  ]),
  clone: new Set([
    "user_source",
    "source_metadata",
    "internal_user_module",
    "system_metadata",
    "entry_shim",
    "compiled_output",
  ]),
  export: new Set(["user_source", "source_metadata", "internal_user_module"]),
  compile: new Set(["user_source", "source_metadata", "internal_user_module"]),
  deploy: new Set(["user_source", "source_metadata", "internal_user_module"]),
  operator: new Set([
    "user_source",
    "source_metadata",
    "internal_user_module",
    "system_metadata",
    "entry_shim",
    "compiled_output",
    "sensitive",
  ]),
};

type LegacyProjection = {
  files: Array<{ path: string; displayPath: string }>;
  entryPath: string | null;
  entryDisplayPath: string | null;
};

function resolveLegacyPathToCanonicalPath(
  rawIndex: Map<string, NormalizedSourceEntry>,
  legacyPath: string
): string | null {
  const normalized = normalizeStudioPathStrict(legacyPath);
  if (!normalized.ok) {
    return null;
  }

  if (rawIndex.has(normalized.path)) {
    return normalized.path;
  }

  const srcCandidate = normalized.path.startsWith("src/") ? normalized.path : `src/${normalized.path}`;
  if (rawIndex.has(srcCandidate)) {
    return srcCandidate;
  }

  let matched: string | null = null;
  for (const [canonicalPath, entry] of rawIndex.entries()) {
    if (entry.displayPath !== normalized.path) continue;
    if (matched && matched !== canonicalPath) {
      return null;
    }
    matched = canonicalPath;
  }

  return matched;
}

export function sourceAccessEnabled(env: Env): boolean {
  return env.SOURCE_ACCESS_V1 !== "false";
}

export function sourceAccessCompareEnabled(env: Env): boolean {
  return env.SOURCE_ACCESS_COMPARE === "true";
}

function stripSingleSrcPrefix(path: string): string {
  return path.startsWith("src/") ? path.slice("src/".length) : path;
}

function filenameFromPath(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function isSourceMetadataPath(path: string): boolean {
  return SOURCE_METADATA_FILENAMES.has(filenameFromPath(path).toLowerCase());
}

function isLockfilePath(path: string): boolean {
  return LOCKFILE_FILENAMES.has(filenameFromPath(path).toLowerCase());
}

function parseManifestJson(raw: string | null): Manifest | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

async function openSourceState(
  ref: SourceAccessRequest,
  intent: SourceAccessIntent
): Promise<InternalSourceState> {
  // live module body omitted in this excerpt
  throw new Error("excerpt");
}

export async function openSourceSnapshot(
  ref: SourceAccessRequest,
  intent: SourceAccessIntent
): Promise<SourceSnapshot> {
  const state = await openSourceState(ref, intent);
  return createSnapshot(state);
}

function isSourceSnapshot(subject: SourceAccessSubject): subject is SourceSnapshot {
  const candidate = subject as Partial<SourceSnapshot>;
  return Array.isArray(candidate.files) && typeof candidate.read === "function";
}

function isInternalSourceSnapshot(subject: SourceSnapshot): subject is InternalSourceSnapshot {
  const candidate = subject as Partial<InternalSourceSnapshot>;
  return (
    typeof candidate.__context === "object" &&
    candidate.__context !== null &&
    candidate.__rawIndex instanceof Map &&
    candidate.__visibleIndex instanceof Map
  );
}

function requireInternalSourceSnapshot(subject: SourceSnapshot): InternalSourceSnapshot {
  if (!isInternalSourceSnapshot(subject)) {
    throw new TypeError("source snapshot must originate from openSourceSnapshot()");
  }
  return subject;
}

export async function listSourceFiles(
  snapshot: SourceSnapshot
): Promise<SourceFileEntry[]>;
export async function listSourceFiles(
  ref: SourceAccessRequest,
  intent: SourceAccessIntent
): Promise<SourceFileEntry[]>;
export async function listSourceFiles(
  subject: SourceAccessSubject,
  intent?: SourceAccessIntent
): Promise<SourceFileEntry[]> {
  if (isSourceSnapshot(subject)) {
    return subject.files;
  }
  if (!intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const state = await openSourceState(subject, intent);
  return state.files;
}

export async function readSourceFile(
  snapshot: SourceSnapshot,
  path: string
): Promise<SourceFileBody>;
export async function readSourceFile(
  ref: SourceAccessRequest,
  path: string,
  intent: SourceAccessIntent
): Promise<SourceFileBody>;
export async function readSourceFile(
  subject: SourceAccessSubject,
  path: string,
  intent?: SourceAccessIntent
): Promise<SourceFileBody> {
  if (isSourceSnapshot(subject)) {
    return subject.read(path);
  }
  if (!intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const state = await openSourceState(subject, intent);
  return state.read(path);
}

export async function getEntryPoint(
  snapshot: SourceSnapshot
): Promise<SourceEntryPoint>;
export async function getEntryPoint(
  ref: SourceAccessRequest,
  intent: SourceAccessIntent
): Promise<SourceEntryPoint>;
export async function getEntryPoint(
  subject: SourceAccessSubject,
  intent?: SourceAccessIntent
): Promise<SourceEntryPoint> {
  if (isSourceSnapshot(subject)) {
    return await subject.entry;
  }
  if (!intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const state = await openSourceState(subject, intent);
  return state.getEntry();
}

export async function getSourceMetadata(
  snapshot: SourceSnapshot
): Promise<SourceMetadata>;
export async function getSourceMetadata(
  ref: SourceAccessRequest,
  intent: SourceAccessIntent
): Promise<SourceMetadata>;
export async function getSourceMetadata(
  subject: SourceAccessSubject,
  intent?: SourceAccessIntent
): Promise<SourceMetadata> {
  if (isSourceSnapshot(subject)) {
    return await subject.metadata;
  }
  if (!intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const state = await openSourceState(subject, intent);
  return state.getMetadata();
}

function toSourceFileEntry(entry: NormalizedSourceEntry): SourceFileEntry {
  return {
    path: entry.path,
    displayPath: entry.displayPath,
    kind: entry.kind,
    sizeBytes: entry.sizeBytes,
    contentType: entry.contentType,
    isText: entry.isText,
  };
}

export function resolveSourceFileEntry(
  snapshot: Pick<SourceSnapshot, "files">,
  path: string
): SourceFileEntry | null {
  const normalized = normalizeStudioPathStrict(path);
  if (!normalized.ok) {
    throw new SourceAccessError("invalid_path", `Invalid source path: ${path}`);
  }

  const exact = snapshot.files.find((entry) => entry.path === normalized.path);
  if (exact) {
    return exact;
  }

  let matched: SourceFileEntry | null = null;
  for (const entry of snapshot.files) {
    if (entry.displayPath !== normalized.path) continue;
    if (matched && matched.path !== entry.path) {
      return null;
    }
    matched = entry;
  }

  return matched;
}

function resolveVisibleSourceEntry(
  snapshot: InternalSourceSnapshot,
  path: string
): NormalizedSourceEntry {
  return resolveVisibleEntry(snapshot.__rawIndex, snapshot.__visibleIndex, path);
}

export async function resolveSourceFileReference(
  snapshot: SourceSnapshot,
  path: string
): Promise<SourceFileReference>;
export async function resolveSourceFileReference(
  ref: SourceAccessRequest,
  path: string,
  intent: SourceAccessIntent
): Promise<SourceFileReference>;
export async function resolveSourceFileReference(
  subject: SourceAccessSubject,
  path: string,
  intent?: SourceAccessIntent
): Promise<SourceFileReference> {
  if (!isSourceSnapshot(subject) && !intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const resolvedIntent = intent;
  const snapshot = isSourceSnapshot(subject)
    ? requireInternalSourceSnapshot(subject)
    : ((await openSourceSnapshot(subject, resolvedIntent!)) as InternalSourceSnapshot);
  const entry = resolveVisibleSourceEntry(snapshot, path);

  return {
    entry: toSourceFileEntry(entry),
    storedPath: entry.storedPath,
    r2Key: entry.r2Key,
    hash: entry.hash,
    source: entry.source,
  };
}

export async function openSourceFileObject(
  snapshot: SourceSnapshot,
  path: string
): Promise<SourceFileObject>;
export async function openSourceFileObject(
  ref: SourceAccessRequest,
  path: string,
  intent: SourceAccessIntent
): Promise<SourceFileObject>;
export async function openSourceFileObject(
  subject: SourceAccessSubject,
  path: string,
  intent?: SourceAccessIntent
): Promise<SourceFileObject> {
  if (!isSourceSnapshot(subject) && !intent) {
    throw new TypeError("intent is required when opening source access from a request");
  }
  const resolvedIntent = intent;
  const snapshot = isSourceSnapshot(subject)
    ? requireInternalSourceSnapshot(subject)
    : ((await openSourceSnapshot(subject, resolvedIntent!)) as InternalSourceSnapshot);
  const entry = resolveVisibleSourceEntry(snapshot, path);

  const read = await readCapsuleFileForCapsule({
    env: snapshot.__context.env,
    capsuleId: snapshot.__context.capsuleId,
    ownerId: snapshot.__context.ownerId,
    contentHash: snapshot.__context.contentHash,
    path: entry.storedPath,
  });

  if (!read?.object) {
    throw new SourceAccessError(
      "snapshot_incomplete",
      `Canonical source entry ${entry.path} could not be read`
    );
  }

  return {
    entry: toSourceFileEntry(entry),
    object: read.object,
    storedPath: entry.storedPath,
    r2Key: entry.r2Key,
    hash: entry.hash,
    source: read.source,
  };
}

/**
 * Extracted from:
 *   workers/api/src/storage/capsuleFiles.ts
 *   workers/api/src/domain/studio/authoredLayout.ts
 *
 * Why this excerpt matters:
 * - Lane 0A.2 requires explicit backend-owned authored path identity
 * - legacy capsules stay editable without accidental whole-bundle upgrades
 * - standardized authored writes must classify authored and non-authored paths before they are accepted
 */

export type CapsuleAuthoredLayoutMode = "legacy_preserve_v1" | "standardized_authored_v1";

export interface CapsuleAuthoredWriteIntent {
  mode: CapsuleAuthoredLayoutMode;
  authoredFilePaths: string[];
  manifestEntry?: string | null;
  allowSinkCanonicalization?: boolean;
  nonAuthoredFilePaths?: string[];
}

export interface AuthoredWritePathResolution {
  inputPath: string;
  normalizedPath: string;
  canonicalPath: string;
  owner: "root_only" | "authored_source";
  canonicalized: boolean;
}

export interface PreparedAuthoredWriteBundle {
  files: CapsuleFile[];
  manifestEntry: string | null;
  canonicalized: boolean;
  filesCanonicalized: number;
}

function normalizePathStrictOrThrow(path: string): string {
  const normalized = normalizeStudioPathStrict(path);
  if (!normalized.ok) {
    throw new Error(`invalid_path:${path}:${normalized.reason}`);
  }
  return normalized.path;
}

function stripSrcPrefix(path: string): string {
  return isInSrcDirectory(path) ? path.slice(4) : path;
}

function pathLabel(path: string): string {
  return path || "(empty)";
}

function canonicalizeAuthoredPath(path: string): AuthoredWritePathResolution {
  const normalizedPath = normalizePathStrictOrThrow(path);
  const displayCandidate = stripSrcPrefix(normalizedPath);

  if (shouldStayAtRoot(displayCandidate)) {
    return {
      inputPath: path,
      normalizedPath,
      canonicalPath: displayCandidate,
      owner: "root_only",
      canonicalized: normalizedPath !== displayCandidate,
    };
  }

  const canonicalPath = toSourcePath(normalizedPath);
  return {
    inputPath: path,
    normalizedPath,
    canonicalPath,
    owner: "authored_source",
    canonicalized: normalizedPath !== canonicalPath,
  };
}

function normalizeCapsuleFilePathsStrict(files: CapsuleFile[]): CapsuleFile[] {
  return files.map((file) => ({
    ...file,
    path: normalizePathStrictOrThrow(file.path),
  }));
}

function updateManifestFile(files: CapsuleFile[], manifestEntry: string): CapsuleFile[] {
  const manifestJson = files.find((file) => file.path === "manifest.json");
  if (!manifestJson) {
    return files;
  }

  const text =
    typeof manifestJson.content === "string"
      ? manifestJson.content
      : new TextDecoder().decode(manifestJson.content as ArrayBuffer);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("manifest_json_invalid");
  }

  parsed["entry"] = manifestEntry;
  const nextText = JSON.stringify(parsed);
  const nextBytes = new TextEncoder().encode(nextText);
  const nextBuffer = nextBytes.buffer.slice(
    nextBytes.byteOffset,
    nextBytes.byteOffset + nextBytes.byteLength
  ) as ArrayBuffer;

  return files.map((file) =>
    file.path === "manifest.json"
      ? {
          ...file,
          content: nextBuffer,
          size: nextBytes.byteLength,
        }
      : file
  );
}

/**
 * Check if a file path is a system file (should NOT be in src/)
 */
export function isSystemFile(path: string): boolean {
  return isHiddenSystemFile(path);
}

/**
 * Check if a file is already in the src/ directory
 */
export function isInSrcDirectory(path: string): boolean {
  return path.startsWith("src/");
}

/**
 * Check if the files array has a src/ structure
 * (i.e., at least one file is in src/)
 */
export function hasSrcStructure(files: CapsuleFile[]): boolean {
  return files.some((f) => isInSrcDirectory(f.path));
}

/**
 * Get the source path for a file (with src/ prefix if not a system file)
 */
export function toSourcePath(path: string): string {
  // Already in src/
  if (isInSrcDirectory(path)) return path;

  // System files and internal modules stay at root
  if (shouldStayAtRoot(path)) return path;

  // Add src/ prefix
  return `src/${path}`;
}

/**
 * Get the display path for a file (without src/ prefix for UI display)
 */
export function toDisplayPath(path: string): string {
  return stripSrcPrefix(path);
}

export function resolveAuthoredWritePath(path: string): AuthoredWritePathResolution {
  return canonicalizeAuthoredPath(path);
}

export function normalizeAuthoredPathForWrite(path: string): string {
  return canonicalizeAuthoredPath(path).canonicalPath;
}

export function normalizeManifestEntryForAuthoredWrite(entry: string): string {
  return normalizeAuthoredPathForWrite(entry);
}

export function prepareAuthoredWriteBundle(args: {
  files: CapsuleFile[];
  manifestEntry?: string | null;
  writeIntent: CapsuleAuthoredWriteIntent;
}): PreparedAuthoredWriteBundle {
  const { writeIntent } = args;
  const allowSinkCanonicalization = writeIntent.allowSinkCanonicalization === true;
  const strictFiles = normalizeCapsuleFilePathsStrict(args.files);

  if (writeIntent.mode === "legacy_preserve_v1") {
    const manifestEntry =
      typeof args.manifestEntry === "string" && args.manifestEntry.trim().length > 0
        ? normalizePathStrictOrThrow(args.manifestEntry)
        : null;
    return {
      files: strictFiles,
      manifestEntry,
      canonicalized: false,
      filesCanonicalized: 0,
    };
  }

  const declaredAuthoredPaths = new Map<string, string>();
  for (const authoredPath of writeIntent.authoredFilePaths) {
    const resolution = canonicalizeAuthoredPath(authoredPath);
    if (!allowSinkCanonicalization && resolution.normalizedPath !== resolution.canonicalPath) {
      throw new Error(
        `authored_path_not_canonical:${pathLabel(resolution.normalizedPath)}:${pathLabel(
          resolution.canonicalPath
        )}`
      );
    }
    const existing = declaredAuthoredPaths.get(resolution.canonicalPath);
    if (existing && existing !== resolution.normalizedPath) {
      throw new Error(
        `authored_path_collision:${pathLabel(existing)}:${pathLabel(resolution.normalizedPath)}:${pathLabel(
          resolution.canonicalPath
        )}`
      );
    }
    declaredAuthoredPaths.set(
      resolution.canonicalPath,
      allowSinkCanonicalization ? resolution.canonicalPath : resolution.normalizedPath
    );
  }

  const declaredNonAuthoredPaths = new Map<string, string>();
  for (const nonAuthoredPath of writeIntent.nonAuthoredFilePaths ?? []) {
    const normalizedPath = normalizePathStrictOrThrow(nonAuthoredPath);
    if (isInSrcDirectory(normalizedPath)) {
      throw new Error(`non_authored_path_in_authored_namespace:${pathLabel(normalizedPath)}`);
    }
    const existing = declaredNonAuthoredPaths.get(normalizedPath);
    if (existing) {
      throw new Error(`non_authored_path_collision:${pathLabel(existing)}:${pathLabel(normalizedPath)}`);
    }
    declaredNonAuthoredPaths.set(normalizedPath, normalizedPath);
  }

  let filesCanonicalized = 0;
  const seenAuthoredFiles = new Set<string>();
  const seenNonAuthoredFiles = new Set<string>();
  const rewrittenFiles = strictFiles.map((file) => {
    if (declaredNonAuthoredPaths.has(file.path)) {
      if (seenNonAuthoredFiles.has(file.path)) {
        throw new Error(`non_authored_file_collision:${pathLabel(file.path)}`);
      }
      seenNonAuthoredFiles.add(file.path);
      return file;
    }

    const resolution = canonicalizeAuthoredPath(file.path);
    if (resolution.owner === "root_only") {
      return file;
    }
    if (!declaredAuthoredPaths.has(resolution.canonicalPath)) {
      throw new Error(`authored_file_unclassified:${pathLabel(file.path)}`);
    }
    if (seenAuthoredFiles.has(resolution.canonicalPath)) {
      const existing = declaredAuthoredPaths.get(resolution.canonicalPath) ?? resolution.canonicalPath;
      throw new Error(
        `authored_file_collision:${pathLabel(existing)}:${pathLabel(file.path)}:${pathLabel(
          resolution.canonicalPath
        )}`
      );
    }
    seenAuthoredFiles.add(resolution.canonicalPath);

    if (!allowSinkCanonicalization && resolution.normalizedPath !== resolution.canonicalPath) {
      throw new Error(
        `authored_file_not_canonical:${pathLabel(resolution.normalizedPath)}:${pathLabel(
          resolution.canonicalPath
        )}`
      );
    }
    if (resolution.normalizedPath === resolution.canonicalPath) {
      return file;
    }
    filesCanonicalized += 1;
    return {
      ...file,
      path: resolution.canonicalPath,
    };
  });

  for (const canonicalPath of declaredAuthoredPaths.keys()) {
    if (!seenAuthoredFiles.has(canonicalPath)) {
      throw new Error(`authored_file_missing:${pathLabel(canonicalPath)}`);
    }
  }
  for (const nonAuthoredPath of declaredNonAuthoredPaths.keys()) {
    if (!seenNonAuthoredFiles.has(nonAuthoredPath)) {
      throw new Error(`non_authored_file_missing:${pathLabel(nonAuthoredPath)}`);
    }
  }

  const manifestEntryInput =
    typeof (writeIntent.manifestEntry ?? args.manifestEntry) === "string" &&
    (writeIntent.manifestEntry ?? args.manifestEntry)?.trim().length
      ? (writeIntent.manifestEntry ?? args.manifestEntry)!
      : null;
  if (!manifestEntryInput) {
    throw new Error("authored_manifest_entry_missing");
  }
  const manifestResolution = canonicalizeAuthoredPath(manifestEntryInput);
  if (!allowSinkCanonicalization && manifestResolution.normalizedPath !== manifestResolution.canonicalPath) {
    throw new Error(
      `authored_manifest_entry_not_canonical:${pathLabel(
        manifestResolution.normalizedPath
      )}:${pathLabel(manifestResolution.canonicalPath)}`
    );
  }
  if (!declaredAuthoredPaths.has(manifestResolution.canonicalPath)) {
    throw new Error(
      `authored_manifest_entry_missing_from_declared_set:${pathLabel(
        manifestResolution.canonicalPath
      )}`
    );
  }

  const finalManifestEntry = manifestResolution.canonicalPath;
  const canonicalized = filesCanonicalized > 0 || manifestResolution.canonicalized;
  const files =
    allowSinkCanonicalization && manifestResolution.canonicalized
      ? updateManifestFile(rewrittenFiles, finalManifestEntry)
      : rewrittenFiles;

  return {
    files,
    manifestEntry: finalManifestEntry,
    canonicalized,
    filesCanonicalized,
  };
}

/**
 * Options for normalizing source files
 */
export interface NormalizeOptions {
  /**
   * Compatibility helper option:
   * If true, forces non-system files into src/ even when they currently live at root.
   *
   * If false, preserves existing structure for callers that intentionally keep
   * legacy layout semantics.
   */
  forceNormalize?: boolean;

  /**
   * If provided, these paths will be treated as compiled output and
   * kept at root level (not moved to src/).
   *
   * Example: ["index.html", "bundle.js"] when these are compiled from
   * src/index.tsx
   */
  compiledOutputPaths?: string[];
}

/**
 * Normalize source files to a consistent structure
 *
 * @param files - Raw files from any source (form upload, ZIP extract, clone)
 * @param options - Normalization options
 * @returns Normalized files with consistent structure
 */
export function normalizeSourceFiles(
  files: CapsuleFile[],
  options: NormalizeOptions = {}
): CapsuleFile[] {
  const { forceNormalize = true, compiledOutputPaths = [] } = options;

  // If files already have src/ structure and we're not forcing, preserve them
  if (!forceNormalize && hasSrcStructure(files)) {
    return files;
  }

  const compiledSet = new Set(compiledOutputPaths.map((p) => p.toLowerCase()));

  return files.map((file) => {
    const path = file.path;

    // Already in src/ - preserve
    if (isInSrcDirectory(path)) {
      return file;
    }

    // System file - keep at root
    if (shouldStayAtRoot(path)) {
      return file;
    }

    // Compiled output - keep at root
    if (compiledSet.has(path.toLowerCase())) {
      return file;
    }

    // Move to src/
    return {
      ...file,
      path: `src/${path}`,
    };
  });
}

/**
 * Compatibility helper to normalize files and manifest entry together.
 *
 * WHY: Transitional callers that still normalize in-place need manifest.entry
 * to track source path rewrites in the same operation.
 */
export function normalizeFilesAndEntry(
  files: CapsuleFile[],
  manifestEntry: string,
  options: NormalizeOptions = {}
): { files: CapsuleFile[]; entry: string } {
  const normalizedFiles = normalizeSourceFiles(files, options);

  // If the entry was normalized, update it too
  let normalizedEntry = manifestEntry;

  // Check if the entry file was moved to src/
  const wasEntryMoved = normalizedFiles.some(
    (f) => f.path === `src/${manifestEntry}` || f.path === toSourcePath(manifestEntry)
  );

  if (wasEntryMoved && !isInSrcDirectory(manifestEntry) && !shouldStayAtRoot(manifestEntry)) {
    normalizedEntry = toSourcePath(manifestEntry);
  }

  return { files: normalizedFiles, entry: normalizedEntry };
}

/**
 * Compatibility helper that separates editable-looking files from hidden/system files.
 *
 * USAGE:
 * Prefer SourceAccess intent projections for new listing surfaces.
 * Use this only where legacy display shaping is still required.
 */
export function separateSourceAndSystemFiles(files: CapsuleFile[]): {
  sourceFiles: CapsuleFile[];
  systemFiles: CapsuleFile[];
} {
  const sourceFiles: CapsuleFile[] = [];
  const systemFiles: CapsuleFile[] = [];

  // Check if we have src/ structure
  const hasSrc = hasSrcStructure(files);

  for (const file of files) {
    // System files are always hidden
    if (isHiddenSystemFile(file.path)) {
      systemFiles.push(file);
      continue;
    }

    // If we have src/ structure, only src/ files are source files
    if (hasSrc) {
      if (isInSrcDirectory(file.path)) {
        sourceFiles.push(file);
      } else {
        // Root-level non-system files are treated as compiled output
        systemFiles.push(file);
      }
    } else {
      // No src/ structure - all non-system files are source files
      sourceFiles.push(file);
    }
  }

  return { sourceFiles, systemFiles };
}

/**
 * Compatibility helper for editor-facing path filtering.
 *
 * For new surfaces, prefer SourceAccess intent projections and canonical paths.
 * Keep this helper for legacy callers that still consume raw file lists.
 */
export function getEditableFilePaths<T extends { path: string }>(
  files: T[]
): T[] {
  // Check if we have src/ structure
  const hasSrc = files.some((f) => isInSrcDirectory(f.path));

  return files.filter((file) => {
    // System files are never editable
    if (isHiddenSystemFile(file.path)) return false;

    // If we have src/ structure, only src/ files are editable
    if (hasSrc) {
      return isInSrcDirectory(file.path);
    }

    // No src/ structure - all non-system files are editable
    return true;
  });
}

export async function getEffectiveCapsuleAuthoredLayoutMode(
  env: Env,
  capsuleId: string
): Promise<CapsuleAuthoredLayoutMode> {
  if (!authoredLayoutEnabled(env)) {
    return "legacy_preserve_v1";
  }
  return getCapsuleAuthoredLayoutMode(env, capsuleId);
}

export function isStandardizedAuthoredLayoutMode(
  mode: CapsuleAuthoredLayoutMode
): boolean {
  return mode === "standardized_authored_v1";
}

export function normalizeStudioMutationPath(
  path: string,
  mode: CapsuleAuthoredLayoutMode
): string {
  return isStandardizedAuthoredLayoutMode(mode)
    ? normalizeAuthoredPathForWrite(path)
    : path;
}

export function resolveStandardizedManifestEntryPath(
  entry: string,
  availablePaths: Iterable<string>
):
  | { ok: true; entry: string; attempted: string[] }
  | { ok: false; reason: "invalid_path" | "missing"; attempted?: string[] } {
  const normalizedEntry = normalizeStudioPathStrict(entry);
  if (!normalizedEntry.ok) {
    return { ok: false, reason: "invalid_path" };
  }

  const canonicalEntry = normalizeAuthoredPathForWrite(normalizedEntry.path);
  const attempted = [canonicalEntry];
  const availableExact = new Set<string>();
  const availableLower = new Map<string, string | null>();

  for (const path of availablePaths) {
    const normalizedPath = normalizeStudioPathStrict(path);
    if (!normalizedPath.ok) continue;

    const exact = normalizedPath.path;
    availableExact.add(exact);

    const lower = exact.toLowerCase();
    if (!availableLower.has(lower)) {
      availableLower.set(lower, exact);
      continue;
    }

    const existing = availableLower.get(lower);
    if (existing === null || existing === exact) continue;
    availableLower.set(lower, null);
  }

  if (availableExact.has(canonicalEntry)) {
    return { ok: true, entry: canonicalEntry, attempted };
  }

  const caseInsensitiveMatch = availableLower.get(canonicalEntry.toLowerCase());
  if (caseInsensitiveMatch && caseInsensitiveMatch !== null) {
    return { ok: true, entry: caseInsensitiveMatch, attempted };
  }

  return { ok: false, reason: "missing", attempted };
}

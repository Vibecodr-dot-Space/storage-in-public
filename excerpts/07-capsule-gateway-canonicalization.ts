/**
 * Extracted from:
 *   workers/api/src/services/storage/capsuleGateway/index.ts
 *
 * Why this excerpt matters:
 * - shows that canonical blob storage is a migration, not an overnight switch
 * - shows that backward compatibility is actively maintained in read paths
 */

export async function listCapsuleFilesViaGateway(
  context: CapsuleStorageContext
): Promise<GatewayFileListEntry[]> {
  const mode = await getCapsuleStorageMode(context.env, context.capsuleId);
  if (mode === "canonical_blob") {
    const canonicalFiles = await listCanonicalFiles(context);
    const mappingCount = await getCanonicalMappingCount(context);
    if (mappingCount > canonicalFiles.length) {
      const legacyFiles = await listLegacyCompatibleFiles(context);
      if (legacyFiles.length > 0) {
        return legacyFiles;
      }
      throw new VibeError("storage.fileNotFound", {
        capsuleId: context.capsuleId,
        reason: "canonical_list_incomplete",
        canonicalCount: canonicalFiles.length,
        expectedCount: mappingCount,
      });
    }

    if (canonicalFiles.length > 0) {
      return canonicalFiles;
    }

    return listLegacyCompatibleFiles(context);
  }

  return listLegacyCompatibleFiles(context);
}

export async function ensureCanonicalCapsuleStorageForMutation(
  context: CapsuleStorageContext
): Promise<CanonicalizeResult> {
  const existingMode = await getCapsuleStorageMode(context.env, context.capsuleId);
  if (existingMode === "canonical_blob") {
    return {
      canonicalized: false,
      filesCanonicalized: 0,
      mode: "canonical_blob",
      reason: "already_canonical",
    };
  }

  const files = await listLegacyCompatibleFiles(context);
  if (files.length === 0) {
    await setCanonicalModeWithRetry(context);
    return {
      canonicalized: true,
      filesCanonicalized: 0,
      mode: "canonical_blob",
      reason: "no_files",
    };
  }

  // Resolve via fallback adapter while it is still enabled, then write canonical blob mappings.
  const expectedPaths = [...new Set(files.map((file) => file.path))];
  for (const path of expectedPaths) {
    await canonicalizePath(context, path);
  }

  await assertCanonicalCoverage(context, expectedPaths, "migration_complete_pre_flip");
  await setCanonicalModeWithRetry(context);

  return {
    canonicalized: true,
    filesCanonicalized: expectedPaths.length,
    mode: "canonical_blob",
    reason: "migrated",
  };
}

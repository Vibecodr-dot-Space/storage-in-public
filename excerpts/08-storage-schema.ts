/**
 * Extracted from:
 *   workers/api/src/db/schema.ts
 *
 * Why this excerpt matters:
 * - it makes the control plane visible
 * - it shows that storage, deduplication, dependency ownership, and public mirroring are all modeled explicitly
 */

export const r2Objects = sqliteTable(
  "r2_objects",
  {
    bucketName: text("bucket_name").notNull(),
    r2Key: text("r2_key").notNull(),
    objectId: text("object_id").notNull(),
    ownerId: text("owner_id").notNull(),
    category: text("category").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentType: text("content_type"),
    visibility: text("visibility").notNull(),
    shareTokenHash: text("share_token_hash"),
    shareTokenCiphertext: text("share_token_ciphertext"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bucketName, table.r2Key] }),
    ownerCategoryIdx: index("idx_r2_objects_owner_category").on(table.ownerId, table.category),
    ownerR2KeyUniqueIdx: uniqueIndex("idx_r2_objects_owner_r2key_unique").on(
      table.ownerId,
      table.r2Key
    ),
    objectIdUniqueIdx: uniqueIndex("idx_r2_objects_object_id_unique").on(table.objectId),
  })
);

export const blobs = sqliteTable(
  "blobs",
  {
    sha256: text("sha256").primaryKey().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    bucketName: text("bucket_name").notNull(),
    r2Key: text("r2_key").notNull(),
    refCount: integer("ref_count").notNull().default(1),
    refVersion: integer("ref_version").notNull().default(0),
  }
);

export const capsuleBlobs = sqliteTable(
  "capsule_blobs",
  {
    capsuleId: text("capsule_id").notNull(),
    filePath: text("file_path").notNull(),
    blobSha256: text("blob_sha256").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.capsuleId, table.filePath] }),
  })
);

export const dependencyObjects = sqliteTable(
  "dependency_objects",
  {
    sha256: text("sha256").primaryKey().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    canonicalR2Key: text("canonical_r2_key").notNull(),
    refCount: integer("ref_count").notNull().default(0),
    refVersion: integer("ref_version").notNull().default(0),
  }
);

export const dependencyObjectAliases = sqliteTable(
  "dependency_object_aliases",
  {
    r2Key: text("r2_key").primaryKey().notNull(),
    dependencySha256: text("dependency_sha256").notNull(),
  }
);

export const artifactDependencyRefs = sqliteTable(
  "artifact_dependency_refs",
  {
    artifactId: text("artifact_id").notNull(),
    dependencySha256: text("dependency_sha256").notNull(),
    sourceRef: text("source_ref").notNull(),
    relationKind: text("relation_kind", {
      enum: ["entry_wrapper", "transitive"],
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.artifactId, table.dependencySha256] }),
  })
);

export const publicArtifactMirrorLeases = sqliteTable(
  "public_artifact_mirror_leases",
  {
    artifactId: text("artifact_id").primaryKey(),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  }
);

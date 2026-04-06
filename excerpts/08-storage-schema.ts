/**
 * Extracted from:
 *   workers/api/src/db/schema.ts
 *
 * Why this excerpt matters:
 * - D1 is the storage control plane
 * - storage, deduplication, authored layout, public mirroring, and legacy promotion are all explicit
 * - the current contract can be read without guessing which subsystem owns which bit of state
 */

// R2 objects index - tracks per-user storage usage and cleanup targets
export const r2Objects = sqliteTable(
  "r2_objects",
  {
    bucketName: text("bucket_name").notNull(),
    r2Key: text("r2_key").notNull(),
    objectId: text("object_id").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentType: text("content_type"),
    visibility: text("visibility").notNull(),
    shareTokenHash: text("share_token_hash"),
    shareTokenCiphertext: text("share_token_ciphertext"),
    shareTokenCreatedAt: integer("share_token_created_at", { mode: "timestamp" }),
    shareTokenRotatedAt: integer("share_token_rotated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bucketName, table.r2Key] }),
    // WHY: ownerIdx was removed; ownerCategoryIdx covers owner-only queries via its leftmost prefix.
    categoryIdx: index("idx_r2_objects_category").on(table.category),
    ownerCategoryIdx: index("idx_r2_objects_owner_category").on(table.ownerId, table.category),
    ownerR2KeyUniqueIdx: uniqueIndex("idx_r2_objects_owner_r2key_unique").on(
      table.ownerId,
      table.r2Key
    ),
    objectIdUniqueIdx: uniqueIndex("idx_r2_objects_object_id_unique").on(table.objectId),
    createdAtIdx: index("idx_r2_objects_created_at").on(table.createdAt),
    shareTokenHashIdx: index("idx_r2_objects_share_token_hash").on(table.shareTokenHash),
  })
);

// Blob Store - content-addressable storage for capsule files
export const blobs = sqliteTable(
  "blobs",
  {
    sha256: text("sha256").primaryKey().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentType: text("content_type"),
    bucketName: text("bucket_name").notNull(),
    r2Key: text("r2_key").notNull(),
    refCount: integer("ref_count").notNull().default(1),
    refVersion: integer("ref_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
    lastReferencedAt: integer("last_referenced_at"),
  },
  (table) => ({
    bucketIdx: index("idx_blobs_bucket").on(table.bucketName),
    createdAtIdx: index("idx_blobs_created_at").on(table.createdAt),
    refCountIdx: index("idx_blobs_ref_count").on(table.refCount),
  })
);

// Capsule -> Blob mapping (per-file pointers into the blob store)
export const capsuleBlobs = sqliteTable(
  "capsule_blobs",
  {
    capsuleId: text("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    blobSha256: text("blob_sha256")
      .notNull()
      .references(() => blobs.sha256),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.capsuleId, table.filePath] }),
    capsuleIdx: index("idx_capsule_blobs_capsule").on(table.capsuleId),
    sha256Idx: index("idx_capsule_blobs_sha256").on(table.blobSha256),
  })
);

// Dependency Store - logical accounting for deterministic import graphs
export const dependencyObjects = sqliteTable(
  "dependency_objects",
  {
    sha256: text("sha256").primaryKey().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentType: text("content_type"),
    canonicalR2Key: text("canonical_r2_key").notNull(),
    refCount: integer("ref_count").notNull().default(0),
    refVersion: integer("ref_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
    lastReferencedAt: integer("last_referenced_at"),
  },
  (table) => ({
    createdAtIdx: index("idx_dependency_objects_created_at").on(table.createdAt),
    refCountIdx: index("idx_dependency_objects_ref_count").on(table.refCount),
  })
);

export const dependencyObjectAliases = sqliteTable(
  "dependency_object_aliases",
  {
    r2Key: text("r2_key").primaryKey().notNull(),
    dependencySha256: text("dependency_sha256")
      .notNull()
      .references(() => dependencyObjects.sha256, { onDelete: "cascade" }),
    contentType: text("content_type"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    dependencyIdx: index("idx_dependency_object_aliases_dependency").on(table.dependencySha256),
  })
);

export const capsuleStorageModes = sqliteTable(
  "capsule_storage_modes",
  {
    capsuleId: text("capsule_id")
      .primaryKey()
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["legacy_compat", "canonical_blob"] }).notNull(),
    canonicalizedAt: integer("canonicalized_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    modeIdx: index("idx_capsule_storage_modes_mode").on(table.mode),
  })
);

export const capsuleAuthoredLayoutModes = sqliteTable(
  "capsule_authored_layout_modes",
  {
    capsuleId: text("capsule_id")
      .primaryKey()
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["legacy_preserve_v1", "standardized_authored_v1"] }).notNull(),
    standardizedAt: integer("standardized_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    modeIdx: index("idx_capsule_authored_layout_modes_mode").on(table.mode),
  })
);

export const artifactDependencyRefs = sqliteTable(
  "artifact_dependency_refs",
  {
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    dependencySha256: text("dependency_sha256")
      .notNull()
      .references(() => dependencyObjects.sha256),
    sourceRef: text("source_ref").notNull(),
    relationKind: text("relation_kind", {
      enum: ["entry_wrapper", "transitive"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.artifactId, table.dependencySha256] }),
    artifactIdx: index("idx_artifact_dependency_refs_artifact").on(table.artifactId),
    dependencyIdx: index("idx_artifact_dependency_refs_dependency").on(table.dependencySha256),
  })
);

export const publicArtifactMirrorLeases = sqliteTable(
  "public_artifact_mirror_leases",
  {
    artifactId: text("artifact_id").primaryKey(),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    leaseIdx: index("idx_public_artifact_mirror_leases_expires").on(table.leaseExpiresAt),
  })
);

export const legacyArtifactPromotions = sqliteTable(
  "legacy_artifact_promotions",
  {
    legacyArtifactId: text("legacy_artifact_id").primaryKey(),
    capsuleId: text("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "cooldown"],
    })
      .notNull()
      .default("queued"),
    newArtifactId: text("new_artifact_id").references(() => artifacts.id, {
      onDelete: "set null",
    }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastRequestedAt: integer("last_requested_at", { mode: "timestamp" }).default(
      sql`(strftime('%s','now'))`
    ),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    lastSurface: text("last_surface"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s','now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    statusUpdatedIdx: index("idx_legacy_artifact_promotions_status_updated").on(
      table.status,
      table.updatedAt
    ),
    capsuleIdx: index("idx_legacy_artifact_promotions_capsule").on(table.capsuleId),
    newArtifactIdx: index("idx_legacy_artifact_promotions_new_artifact").on(table.newArtifactId),
  })
);

// Capsule backends - one backend pulse per capsule for combo projects.
// WHY: Studio projects can include server/ files that deploy as a single backend Worker.
export const capsuleBackends = sqliteTable(
  "capsule_backends",
  {
    capsuleId: text("capsule_id")
      .primaryKey()
      .references(() => capsules.id, { onDelete: "cascade" }),
    pulseId: text("pulse_id")
      .notNull()
      .references(() => serverActions.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s','now'))`),
  },
  (table) => ({
    pulseIdUnique: uniqueIndex("idx_capsule_backends_pulse_id").on(table.pulseId),
  })
);

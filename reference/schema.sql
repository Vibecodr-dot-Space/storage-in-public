-- Simplified reference schema for the public storage architecture.
-- This is not a copy of the entire production schema.

CREATE TABLE r2_objects (
  bucket_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  object_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_type TEXT,
  visibility TEXT NOT NULL,
  share_token_hash TEXT,
  share_token_ciphertext TEXT,
  share_token_created_at INTEGER,
  share_token_rotated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (bucket_name, r2_key),
  UNIQUE (object_id),
  UNIQUE (owner_id, r2_key)
);

CREATE INDEX idx_r2_objects_category ON r2_objects (category);
CREATE INDEX idx_r2_objects_owner_category ON r2_objects (owner_id, category);
CREATE INDEX idx_r2_objects_created_at ON r2_objects (created_at);
CREATE INDEX idx_r2_objects_share_token_hash ON r2_objects (share_token_hash);

CREATE TABLE blobs (
  sha256 TEXT PRIMARY KEY,
  size_bytes INTEGER NOT NULL,
  content_type TEXT,
  bucket_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 1,
  ref_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_referenced_at INTEGER
);

CREATE INDEX idx_blobs_bucket ON blobs (bucket_name);
CREATE INDEX idx_blobs_created_at ON blobs (created_at);
CREATE INDEX idx_blobs_ref_count ON blobs (ref_count);

CREATE TABLE capsule_blobs (
  capsule_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  blob_sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (capsule_id, file_path)
);

CREATE INDEX idx_capsule_blobs_capsule ON capsule_blobs (capsule_id);
CREATE INDEX idx_capsule_blobs_sha256 ON capsule_blobs (blob_sha256);

CREATE TABLE dependency_objects (
  sha256 TEXT PRIMARY KEY,
  size_bytes INTEGER NOT NULL,
  content_type TEXT,
  canonical_r2_key TEXT NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 0,
  ref_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_referenced_at INTEGER
);

CREATE INDEX idx_dependency_objects_created_at ON dependency_objects (created_at);
CREATE INDEX idx_dependency_objects_ref_count ON dependency_objects (ref_count);

CREATE TABLE dependency_object_aliases (
  r2_key TEXT PRIMARY KEY,
  dependency_sha256 TEXT NOT NULL,
  content_type TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_dependency_object_aliases_dependency
  ON dependency_object_aliases (dependency_sha256);

CREATE TABLE artifact_dependency_refs (
  artifact_id TEXT NOT NULL,
  dependency_sha256 TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  relation_kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, dependency_sha256)
);

CREATE INDEX idx_artifact_dependency_refs_artifact
  ON artifact_dependency_refs (artifact_id);
CREATE INDEX idx_artifact_dependency_refs_dependency
  ON artifact_dependency_refs (dependency_sha256);

CREATE TABLE public_artifact_mirror_leases (
  artifact_id TEXT PRIMARY KEY,
  lease_expires_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_public_artifact_mirror_leases_expires
  ON public_artifact_mirror_leases (lease_expires_at);

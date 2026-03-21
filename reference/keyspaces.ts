export const BUCKET_LANES = {
  shared: "shared",
  dedicated: "dedicated-user-bucket",
  publicAssets: "public-assets",
  publicArtifactsMirror: "public-artifacts-mirror",
} as const;

export const KEYSPACES = {
  capsules: "capsules/{capsuleId}/...",
  drafts: "drafts/{userId}/{draftId}/...",
  avatars: "avatars/{userId}/...",
  thumbnails: "thumbnails/{ownerOrPost}/...",
  userAssets: "user-assets/{userId}/...",
  artifacts: "artifacts/{artifactId}/...",
  blobs: "blobs/{sha256}/{uuid}",
  mirroredDependencies: "deps/...",
} as const;

export const CATEGORY_VISIBILITY = {
  avatar: "public",
  cover: "private",
  thumbnail: "public_cdn",
  user_asset: "private_or_public_cdn",
  draft: "private",
  artifact_bundle: "private_until_publicly_mirrored",
  artifact_source: "private",
  artifact_manifest: "private_control_plane",
} as const;

export const QUOTA_COUNTED_CATEGORIES = new Set([
  "avatar",
  "cover",
  "thumbnail",
  "user_asset",
  "draft",
  "artifact_bundle",
  "artifact_source",
]);

export const DESIGN_NOTES = [
  "Use D1 as the storage control plane. Do not try to derive ownership and quota from bucket listing alone.",
  "Keep deduplicated blobs in the shared lane so cross-user reuse survives account and bucket lifecycle changes.",
  "Separate public media from public runtime-artifact mirroring.",
  "Keep private reads policy-mediated in a Worker when access rules are richer than 'has a URL'.",
] as const;

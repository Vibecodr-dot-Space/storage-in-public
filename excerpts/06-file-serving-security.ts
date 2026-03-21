/**
 * Extracted from:
 *   workers/api/src/security/fileServing.ts
 *
 * Why this excerpt matters:
 * - private storage is not just bucket access, it is response-policy enforcement
 * - the system has a single serving SSOT for dangerous user-controlled file types
 */

/**
 * Centralized file-serving security module.
 *
 * SSOT (Single Source of Truth) for serving user-uploaded files with proper security headers.
 *
 * WHY THIS EXISTS:
 * User-uploaded files can contain malicious content.
 * SVG files can embed <script> tags, event handlers, and other XSS vectors.
 * XML files can contain scripts via namespaced elements or processing instructions.
 * HTML files are obvious XSS vectors.
 *
 * This module provides:
 * 1. Centralized CSP policy for user-uploaded files
 * 2. Content type detection for scriptable/dangerous types
 * 3. A single function to serve files securely
 */

const USER_FILE_CSP =
  "default-src 'none'; " +
  "script-src 'none'; " +
  "object-src 'none'; " +
  "style-src 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self'; " +
  "connect-src 'none'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'none'; " +
  "form-action 'none';";

export function isScriptableContentType(contentType: string): boolean {
  const normalized = (contentType.toLowerCase().split(";")[0] ?? "").trim();

  if (
    normalized === "text/html" ||
    normalized === "image/svg+xml" ||
    normalized === "application/xml" ||
    normalized === "text/xml" ||
    normalized === "application/xhtml+xml"
  ) {
    return true;
  }

  if (normalized.endsWith("+xml")) {
    return true;
  }

  return false;
}

export function serveUserFile(
  body: ReadableStream | ArrayBuffer | string | null,
  options: ServeFileOptions
): Response {
  const headers: Record<string, string> = {
    "Content-Type": options.contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": options.cacheControl ?? "no-store",
  };

  if (isScriptableContentType(options.contentType)) {
    headers["Content-Security-Policy"] = USER_FILE_CSP;
  }

  if (options.crossOriginResourcePolicy) {
    headers["Cross-Origin-Resource-Policy"] = options.crossOriginResourcePolicy;
  }

  return new Response(body, {
    status: options.status ?? 200,
    headers,
  });
}

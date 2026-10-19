/**
 * Construction de la Content-Security-Policy, à nonce par réponse.
 *
 * Même politique que l'application Flask (default-src 'self', frame-ancestors
 * 'none', base-uri, form-action), à ceci près que les scripts inline portent un
 * nonce au lieu de `'unsafe-inline'`. `img-src data:` reste nécessaire au QR
 * code 2FA et aux aperçus ; `style-src 'unsafe-inline'` aux styles par attribut.
 */

const NONCE_BYTES = 16;

/** Nonce à usage unique. `crypto` global : disponible en runtime Edge comme en Node. */
export function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

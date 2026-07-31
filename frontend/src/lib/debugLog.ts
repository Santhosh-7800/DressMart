/**
 * Dev-only, no-op in production builds (tree-shaken via import.meta.env.DEV). Used to trace the
 * product-query -> ProductCard -> ProductImage -> route-transition pipeline while diagnosing
 * "content area goes blank after Back navigation" style bugs, without leaving console noise in
 * the shipped app.
 */
export function debugLog(scope: string, ...args: unknown[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[${scope}]`, ...args);
  }
}

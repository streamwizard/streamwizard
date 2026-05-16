/**
 * Ambient types for @emmetio/expand-abbreviation (the package ships no .d.ts).
 * API shape from dist/expand.es.js JSDoc and exports.
 */
declare module "@emmetio/expand-abbreviation" {
  export interface ExpandConfig {
    syntax?: string;
    type?: "markup" | "stylesheet";
    snippets?: unknown;
    variables?: Record<string, unknown>;
    options?: Record<string, unknown> | null;
    format?: Record<string, unknown> | null;
    profile?: unknown;
    field?: unknown;
    text?: unknown;
    [key: string]: unknown;
  }

  export function expand(
    abbr: string | unknown,
    config?: string | ExpandConfig
  ): string;

  export function parse(abbr: string, options?: string | ExpandConfig): unknown;

  export function createSnippetsRegistry(
    type: string,
    syntax: string,
    snippets?: unknown
  ): unknown;

  export function createOptions(
    options?: string | ExpandConfig
  ): ExpandConfig;

  export function isStylesheet(syntax: string): boolean;

  export function createProfile(options: unknown): unknown;
}

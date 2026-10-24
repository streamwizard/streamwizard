/**
 * pixelmatch 6 ships no types and has no @types package. Only the options this
 * harness passes are declared.
 */
declare module "pixelmatch" {
  function pixelmatch(
    img1: Uint8Array | Buffer,
    img2: Uint8Array | Buffer,
    output: Uint8Array | Buffer | null,
    width: number,
    height: number,
    options?: { threshold?: number; includeAA?: boolean },
  ): number;
  export default pixelmatch;
}

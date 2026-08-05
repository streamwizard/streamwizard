/** Renders a MB quantity as whole GB once it's large enough to be unwieldy in
 * raw MB (e.g. node RAM/VRAM/storage), falling back to a placeholder for
 * still-pending nodes that haven't self-reported a value yet. */
export function formatMb(mb: number | null | undefined, placeholder = "—"): string {
  if (mb == null) return placeholder;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

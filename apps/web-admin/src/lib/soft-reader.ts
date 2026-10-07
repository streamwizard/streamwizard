/**
 * Runs a page's reads side by side and remembers which ones failed: a read
 * that fails gives its fallback and is named on the page, the rest still
 * shows. `page` is the tag in the log line.
 */
export function softReader(page: string) {
  const failed: string[] = [];
  let total = 0;
  const soft = async <T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    total++;
    try {
      return await run();
    } catch (error) {
      console.error(`[${page} ${label}]`, error);
      failed.push(label);
      return fallback;
    }
  };
  return { soft, failed, allFailed: () => total > 0 && failed.length === total };
}

// Helpers for getting files into the media library: walking a dropped folder,
// and keeping out what the library would refuse anyway. Kept out of the
// component so they can be tested without a browser.

import { kindFromMime } from "./asset-mime";

/**
 * Files worth sending: not hidden (.DS_Store and friends ride along in every
 * folder) and of a type the upload action accepts. The rest would each fail
 * with its own error toast, which is noise when someone drops a folder.
 */
export function partitionUploadable(files: File[]): { uploadable: File[]; skipped: File[] } {
  const uploadable: File[] = [];
  const skipped: File[] = [];
  for (const file of files) {
    if (!file.name.startsWith(".") && kindFromMime(file.type)) uploadable.push(file);
    else skipped.push(file);
  }
  return { uploadable, skipped };
}

// The bits of the File and Directory Entries API a drop hands us. Declared
// here so the walk can be tested with plain objects.
interface FileEntryLike {
  isFile: true;
  isDirectory: false;
  file(success: (file: File) => void, error?: (err: unknown) => void): void;
}
interface DirectoryEntryLike {
  isFile: false;
  isDirectory: true;
  createReader(): {
    readEntries(success: (entries: EntryLike[]) => void, error?: (err: unknown) => void): void;
  };
}
export type EntryLike = FileEntryLike | DirectoryEntryLike;

/** Every file under the given entries, folders walked all the way down. */
export async function filesFromEntries(entries: EntryLike[]): Promise<File[]> {
  const out: File[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      out.push(await new Promise<File>((resolve, reject) => entry.file(resolve, reject)));
    } else {
      const reader = entry.createReader();
      // readEntries hands a folder over in batches (100 at a time in Chrome)
      // and signals the end with an empty one.
      for (;;) {
        const batch = await new Promise<EntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        out.push(...(await filesFromEntries(batch)));
      }
    }
  }
  return out;
}

/**
 * The files in a drop, with any folders in it expanded. The entries have to
 * be taken synchronously, inside the drop handler: the browser empties the
 * DataTransfer once the event returns.
 */
export function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries: EntryLike[] = [];
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.() as EntryLike | null | undefined;
    if (entry) entries.push(entry);
  }
  // Browsers without the entries API still fill dataTransfer.files.
  if (entries.length === 0) return Promise.resolve(Array.from(dataTransfer.files));
  return filesFromEntries(entries);
}

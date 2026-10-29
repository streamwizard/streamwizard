"use client";

import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { Check, ChevronsUpDown, Upload } from "lucide-react";
import {
  isUploadedFontRef,
  uploadedFontName,
  uploadedFontRef,
} from "@repo/ui/overlay";
import { listAssets } from "@/actions/assets";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import { Button } from "@repo/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui";
import { Label } from "@repo/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import {
  FEATURED_GOOGLE_FONT_FAMILIES,
  FALLBACK_GOOGLE_FONT_FAMILIES,
  type GoogleFontFamily,
} from "@/constants/google-fonts";
import { useGoogleFont, useGoogleFontsBatch } from "@/hooks/use-google-font";
import { getGoogleFontsCatalog } from "@/lib/google-fonts-catalog";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_SEARCH_RESULTS = 60;
const DEFAULT_PICKER_COUNT = 30;

export interface GoogleFontSelectProps {
  value: GoogleFontFamily;
  onValueChange: (value: GoogleFontFamily) => void;
  /**
   * If set, skips API fetch. Search runs over this list only.
   * Default visible: first `DEFAULT_PICKER_COUNT` entries.
   */
  families?: readonly GoogleFontFamily[];
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  searchPlaceholder?: string;
  /**
   * Offer fonts from the media library above the Google ones. Off for custom
   * widget fields: a widget's own code loads its font from Google by name.
   */
  allowUploaded?: boolean;
}

interface UploadedFont {
  ref: string;
  name: string;
}

/** Display name for any value the picker can hold. */
function fontLabel(family: string): string {
  return isUploadedFontRef(family) ? uploadedFontName(family) : family;
}

export function GoogleFontSelect({
  value,
  onValueChange,
  families: familiesProp,
  label,
  id,
  disabled,
  className,
  labelClassName,
  triggerClassName,
  searchPlaceholder = "Search all Google Fonts…",
  allowUploaded = true,
}: GoogleFontSelectProps) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Fonts in the media library; null until the list first opens.
  const [uploaded, setUploaded] = useState<UploadedFont[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const [fullCatalog, setFullCatalog] = useState<readonly string[]>(() =>
    familiesProp?.length ? familiesProp : []
  );
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready">(
    () => (familiesProp?.length ? "ready" : "loading")
  );

  useGoogleFont(value);

  // Loaded when the list opens, so a font uploaded on the Media page since
  // shows up without a reload.
  useEffect(() => {
    if (!open || !allowUploaded) return;
    let cancelled = false;
    void listAssets().then(({ data }) => {
      if (cancelled || !data) return;
      setUploaded(
        data.files.flatMap((file) => {
          const ref = file.kind === "font" ? uploadedFontRef(file.url) : null;
          return ref ? [{ ref, name: uploadedFontName(ref) }] : [];
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, allowUploaded]);

  useEffect(() => {
    if (familiesProp?.length) {
      setFullCatalog(familiesProp);
      setCatalogStatus("ready");
      return;
    }

    let cancelled = false;
    setCatalogStatus("loading");
    getGoogleFontsCatalog()
      .then((list) => {
        if (!cancelled) {
          setFullCatalog(list);
          setCatalogStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullCatalog([...FALLBACK_GOOGLE_FONT_FAMILIES]);
          setCatalogStatus("ready");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [familiesProp]);

  const defaultVisible = useMemo(() => {
    if (familiesProp?.length) {
      return familiesProp.slice(
        0,
        Math.min(DEFAULT_PICKER_COUNT, familiesProp.length)
      );
    }
    return [...FEATURED_GOOGLE_FONT_FAMILIES];
  }, [familiesProp]);

  const searchPool = useMemo(
    () =>
      fullCatalog.length > 0 ? fullCatalog : [...FEATURED_GOOGLE_FONT_FAMILIES],
    [fullCatalog]
  );

  const { displayedFamilies, totalMatchCount, isTruncated } = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    if (!q) {
      const list = [...defaultVisible];
      if (value && searchPool.includes(value) && !list.includes(value)) {
        list.unshift(value);
      }
      return {
        displayedFamilies: list,
        totalMatchCount: 0,
        isTruncated: false,
      };
    }

    const matches = searchPool.filter((f) => f.toLowerCase().includes(q));
    const total = matches.length;
    let list = matches.slice(0, MAX_SEARCH_RESULTS);
    if (
      value &&
      searchPool.includes(value) &&
      value.toLowerCase().includes(q) &&
      !list.includes(value)
    ) {
      list = [value, ...list.filter((x) => x !== value)].slice(
        0,
        MAX_SEARCH_RESULTS
      );
    }

    return {
      displayedFamilies: list,
      totalMatchCount: total,
      isTruncated: total > MAX_SEARCH_RESULTS,
    };
  }, [debouncedSearch, defaultVisible, searchPool, value]);

  const shownUploads = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (uploaded ?? []).filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [uploaded, debouncedSearch]);
  // A font picked from the library and deleted there since.
  const valueRemoved =
    isUploadedFontRef(value) && uploaded !== null && !uploaded.some((f) => f.ref === value);

  const batchForPreview = useMemo(
    () => [...shownUploads.map((f) => f.ref), ...displayedFamilies.slice(0, MAX_SEARCH_RESULTS)],
    [shownUploads, displayedFamilies]
  );
  useGoogleFontsBatch(batchForPreview.length ? batchForPreview : undefined);

  const labelText = label === undefined ? "Font" : label;
  const showLabel = labelText.length > 0;

  const isSearching = debouncedSearch.trim().length > 0;
  const catalogReadyForFullSearch = !familiesProp && catalogStatus === "ready";

  const trigger = (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full min-w-0 justify-between px-3 text-xs font-normal",
            triggerClassName
          )}
          style={{ fontFamily: `"${value}", sans-serif` }}
        >
          <span className="truncate">{fontLabel(value)}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[min(100vw-1.5rem,22rem)]"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <div className="border-b border-border px-2 py-1.5 space-y-0.5">
            {!isSearching ? (
              <>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Showing popular fonts only. Type above to search{" "}
                  {!familiesProp
                    ? "the full library once the catalog finishes loading."
                    : "this list."}
                </p>
                {!familiesProp && catalogStatus === "loading" ? (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Loading full catalog…
                  </p>
                ) : null}
              </>
            ) : !catalogReadyForFullSearch && !familiesProp ? (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 leading-snug">
                Full catalog still loading — search may be limited to popular
                fonts for a moment.
              </p>
            ) : null}
            {isSearching && totalMatchCount > 0 ? (
              <p className="text-[10px] text-muted-foreground leading-snug">
                {isTruncated
                  ? `Showing ${displayedFamilies.length} of ${totalMatchCount} matches. Type a more specific name to narrow results.`
                  : `${totalMatchCount} match${totalMatchCount === 1 ? "" : "es"}.`}
              </p>
            ) : null}
          </div>
          <CommandList>
            <CommandEmpty>
              {isSearching
                ? "No fonts match your search."
                : "No fonts to show."}
            </CommandEmpty>
            {allowUploaded ? (
              <CommandGroup heading="Your fonts">
                {shownUploads.map((font) => (
                  <CommandItem
                    key={font.ref}
                    value={font.ref}
                    onSelect={() => {
                      onValueChange(font.ref);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === font.ref ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate" style={{ fontFamily: `"${font.ref}", sans-serif` }}>
                      {font.name}
                    </span>
                  </CommandItem>
                ))}
                {valueRemoved ? (
                  <CommandItem value={value} disabled>
                    <Check className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {fontLabel(value)} (deleted from your media, showing a fallback)
                    </span>
                  </CommandItem>
                ) : null}
                <CommandItem
                  value="upload-a-font"
                  onSelect={() => {
                    setOpen(false);
                    setUploadOpen(true);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4 shrink-0" />
                  Upload a font
                </CommandItem>
              </CommandGroup>
            ) : null}
            {displayedFamilies.length > 0 ? (
              <CommandGroup heading={allowUploaded ? "Google Fonts" : undefined}>
                {displayedFamilies.map((family) => (
                  <CommandItem
                    key={family}
                    value={family}
                    onSelect={() => {
                      onValueChange(family);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      className="truncate"
                      style={{ fontFamily: `"${family}", sans-serif` }}
                    >
                      {family}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const upload = allowUploaded ? (
    <AssetPickerDialog
      open={uploadOpen}
      onOpenChange={setUploadOpen}
      kindFilter={["font"]}
      title="Pick a font"
      onSelect={(asset) => {
        const ref = uploadedFontRef(asset.url);
        if (ref) onValueChange(ref);
        setUploaded(null);
      }}
    />
  ) : null;

  if (!showLabel) {
    return (
      <div className={className}>
        {trigger}
        {upload}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn("text-xs", labelClassName)}>
        {labelText}
      </Label>
      {trigger}
      {upload}
    </div>
  );
}

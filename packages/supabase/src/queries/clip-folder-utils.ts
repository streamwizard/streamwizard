export function buildFolderHref(folderName: string, parentHref?: string | null): string {
  const segment = encodeURIComponent(folderName);
  return parentHref ? `${parentHref}/${segment}` : segment;
}

export function folderHrefToUrlPath(href: string): string {
  return href.split("/").map((segment) => decodeURIComponent(segment)).join("/");
}

export function urlPathToFolderHref(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

# @repo/cms

Shared rules for blog posts and guides, used by web-admin (editing, publishing)
and web-streamwizard (rendering). No I/O: everything here is pure and tested.

- `sanitizeDoc`: the only way a Tiptap JSON body reaches the database. Keeps the
  nodes, marks and attributes the public renderer draws; drops the rest and
  reports what it dropped. Links are limited to http(s), mailto and site links.
- `parseEmbedUrl`: YouTube and Twitch URLs to `{ provider, id }`. Embeds never
  store a URL or iframe markup.
- `extractText`, `readingStats`: plain text for search, word count, reading
  time (225 wpm, code at half weight, 12 s per image, at least 1 min).
- `extractToc`, `AnchorRegistry`: headings with page-unique anchors. The
  renderer uses the same function, so TOC links and heading ids always match.
- `checkAccessibility`: alt text, heading outline, link text, table headers.
  Errors block publishing, warnings only show in the editor.
- `slugify`, `isValidSlug`.
- `transition`, `allowedActions`: the publishing state machine.
- `cmsTags`, `isCmsTag`, `tagsForChange`: cache tags for the public site and
  which ones a change refreshes.

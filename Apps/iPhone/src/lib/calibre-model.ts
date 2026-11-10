import { md5 } from "js-md5";
import { Book, webURL, progress } from "./model";
export function calibreBase(opds: string) {
  const u = new URL(webURL(opds));
  u.pathname =
    u.pathname.replace(/\/opds(?:\/.*)?$/, "").replace(/\/$/, "") + "/";
  u.search = "";
  u.hash = "";
  return u.href;
}
const custom = (b: any, key: string) => {
  const field = b.user_metadata?.[key];
  return field?.["#value#"] ?? field?.["#value"];
};
export function calibreBook(id: string, b: any, base: string): Book {
  const formats: Record<string, string> = {};
  for (const [kind, url] of Object.entries({
    ...b.main_format,
    ...b.other_formats,
  }))
    try {
      formats[kind.toLowerCase()] = webURL(String(url), base);
    } catch {}
  const preferred = formats.epub
    ? "epub"
    : formats.pdf
      ? "pdf"
      : Object.keys(formats).some((x) =>
            ["m4b", "m4a", "mp3", "aac", "wav", "flac"].includes(x),
          )
        ? "audio"
        : "epub";
  const pct = Number(custom(b, "#ko_progfloat") ?? 0);
  const progressUpdated =
    Date.parse(custom(b, "#ko_lastmod") || "") || undefined;
  const timestamp =
    Date.parse(custom(b, "#ko_lastmod") || b.last_modified || "") || Date.now();
  const hash = String(custom(b, "#ko_md5") || "");
  return {
    id: "calibre-" + (b.uuid || md5(base + id)),
    title: String(b.title || "Untitled"),
    author: Array.isArray(b.authors) ? b.authors.join(", ") : "",
    kind: preferred,
    cover: b.thumbnail
      ? webURL(b.thumbnail, base)
      : b.cover
        ? webURL(b.cover, base)
        : undefined,
    document: /^[a-f0-9]{32}$/i.test(hash) ? hash : undefined,
    chapters: [],
    progress: progress(Number.isFinite(pct) ? pct : 0),
    finished: pct >= 0.97,
    added: Date.parse(b.timestamp || "") || Date.now(),
    updated: timestamp,
    progressUpdated,
    progressKnown: !!progressUpdated,
    identifiers: b.identifiers || {},
    calibre: { id, base, formats },
  };
}
export function mergeCalibre(incoming: Book, existing: Book | undefined): Book {
  if (!existing) return incoming;
  // A catalog edit/import timestamp is not a reading-position timestamp.
  const readingTime =
    existing.progressUpdated ??
    (existing.progressKnown || (existing.hasContent && existing.progress > 0)
      ? existing.updated
      : undefined);
  const newer =
    !!incoming.progressUpdated &&
    (!readingTime || incoming.progressUpdated > readingTime);
  return {
    ...incoming,
    ...existing,
    calibre: incoming.calibre
      ? {
          ...incoming.calibre,
          formats: {
            ...(existing.calibre?.base === incoming.calibre.base
              ? existing.calibre.formats
              : {}),
            ...incoming.calibre.formats,
          },
        }
      : existing.calibre,
    title: incoming.title,
    author: incoming.author,
    cover: existing.cover?.startsWith("file:")
      ? existing.cover
      : incoming.cover || existing.cover,
    document: existing.document || incoming.document,
    identifiers: { ...existing.identifiers, ...incoming.identifiers },
    progress: newer ? incoming.progress : existing.progress,
    finished: newer ? incoming.finished : existing.finished,
    progressUpdated: newer
      ? incoming.progressUpdated
      : existing.progressUpdated,
    progressKnown: newer ? true : existing.progressKnown,
    updated: Math.max(incoming.updated, existing.updated),
  };
}
export function readableFormat(b: Book) {
  const f = b.calibre?.formats || {};
  const kind = ["epub", "pdf", "m4b", "m4a", "mp3", "aac", "wav", "flac"].find(
    (x) => f[x],
  );
  return kind
    ? {
        kind,
        url: f[kind],
        mime:
          kind === "epub"
            ? "application/epub+zip"
            : kind === "pdf"
              ? "application/pdf"
              : "audio/" + kind,
      }
    : undefined;
}

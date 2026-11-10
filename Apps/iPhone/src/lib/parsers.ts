import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { md5 } from "js-md5";
import { Book, webURL, escapeHTML } from "./model";
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  processEntities: false,
});
const arr = (x: any): any[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x: any): string =>
  typeof x === "object" ? String(x?.["#text"] ?? "") : String(x ?? "");
export function partialMD5(bytes: Uint8Array) {
  const h = md5.create();
  for (const n of [0, ...Array.from({ length: 11 }, (_, i) => 1024 * 4 ** i)]) {
    if (n >= bytes.length) break;
    h.update(bytes.subarray(n, n + 1024));
  }
  return h.hex();
}
export function normalizePath(base: string, href: string) {
  href = decodeURIComponent(href);
  const parts = (
      base.slice(0, base.lastIndexOf("/") + 1) + href.split("#")[0]
    ).split("/"),
    out: string[] = [];
  for (const p of parts) {
    if (p === "..") {
      if (!out.length) throw new Error("Invalid EPUB resource path");
      out.pop();
    } else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}
export async function parseEPUB(bytes: Uint8Array): Promise<Partial<Book>> {
  if (bytes.length > 32 * 1024 * 1024) throw new Error("EPUB limit is 32 MB.");
  const zip = await JSZip.loadAsync(bytes);
  if (Object.keys(zip.files).length > 4000)
    throw new Error("This EPUB contains too many files.");
  const total = Object.values(zip.files).reduce(
    (n, x) => n + Number((x as any)._data?.uncompressedSize || 0),
    0,
  );
  if (total > 64 * 1024 * 1024)
    throw new Error("Expanded EPUB limit is 64 MB.");
  const read = async (path: string) => {
    const f = zip.file(path);
    if (!f) throw new Error("EPUB resource missing: " + path);
    return f.async("string");
  };
  const container = xml.parse(await read("META-INF/container.xml"));
  const root = arr(container.container?.rootfiles?.rootfile)[0]?.["@full-path"];
  if (!root) throw new Error("EPUB has no package.");
  const pkg = xml.parse(await read(root)).package;
  const manifest = arr(pkg.manifest?.item),
    spine = arr(pkg.spine?.itemref),
    metadata = pkg.metadata || {};
  const items = spine
    .map((entry: any, i: number) => ({
      entry,
      i,
      item: manifest.find((m: any) => m["@id"] === entry["@idref"]),
    }))
    .filter((x) => x.item && x.entry["@linear"] !== "no");
  const pathIndex = new Map(
    items.map((x) => [normalizePath(root, x.item["@href"]), x.i]),
  );
  const target = (base: string, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//"))
      return undefined;
    const [file, fragment] = href.split("#");
    const index = pathIndex.get(file ? normalizePath(base, file) : base);
    return index === undefined
      ? undefined
      : "chapter-" +
          index +
          (fragment ? "-" + decodeURIComponent(fragment) : "");
  };
  const chapters: { id: string; title: string }[] = [],
    fallback: { id: string; title: string }[] = [];
  let html = "";
  for (const { i, item } of items) {
    const path = normalizePath(root, item["@href"]);
    let body = await read(path);
    body = body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    body = body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || body;
    const title =
      body
        .match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
        .replace(/<[^>]*>/g, "")
        .trim() || "Section " + (i + 1);
    fallback.push({ id: "chapter-" + i, title });
    // Namespace original fragment IDs by spine item; repeated IDs in different files are valid.
    body = body.replace(
      /\bid=["']([^"']+)["']/gi,
      (_, id) => 'id="' + escapeHTML("chapter-" + i + "-" + id) + '"',
    );
    const matches = [
      ...body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ].slice(0, 12);
    for (const match of matches)
      try {
        const image = zip.file(normalizePath(path, match[1]));
        if (
          image &&
          Number((image as any)._data?.uncompressedSize) < 2 * 1024 * 1024
        ) {
          const ext = match[1].split(".").pop()?.toLowerCase();
          const mime = (
            {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
            } as Record<string, string>
          )[ext || ""];
          if (mime)
            body = body.replace(
              match[1],
              "data:" + mime + ";base64," + (await image.async("base64")),
            );
        }
      } catch {}
    body = body.replace(/href=["']([^"']+)["']/gi, (whole, href) => {
      const id = target(path, href);
      return id ? 'href="#' + escapeHTML(id) + '"' : whole;
    });
    html += '<section id="chapter-' + i + '">' + body + "</section>";
    if (html.length > 10 * 1024 * 1024)
      throw new Error(
        "This illustrated EPUB is too large for the mobile reader.",
      );
  }
  // Prefer publisher navigation labels, preserving their order and nested chapter links.
  const nav = manifest.find((x: any) =>
    String(x["@properties"] || "")
      .split(" ")
      .includes("nav"),
  );
  const ncx =
    manifest.find((x: any) => x["@id"] === pkg.spine?.["@toc"]) ||
    manifest.find((x: any) => x["@media-type"] === "application/x-dtbncx+xml");
  const add = (base: string, href: string, label: string) => {
    const id = target(base, href);
    if (id && !chapters.some((x) => x.id === id))
      chapters.push({ id, title: label || "Section " + (chapters.length + 1) });
  };
  if (nav) {
    const path = normalizePath(root, nav["@href"]);
    const data = xml.parse(await read(path));
    const navs = arr(data.html?.body?.nav);
    const toc =
      navs.find((x) => String(x["@type"] || "").includes("toc")) || navs[0];
    const walk = (list: any) => {
      for (const li of arr(list?.li)) {
        for (const a of arr(li.a))
          if (a["@href"]) add(path, a["@href"], text(a));
        for (const ol of arr(li.ol)) walk(ol);
      }
    };
    for (const ol of arr(toc?.ol)) walk(ol);
  } else if (ncx) {
    const path = normalizePath(root, ncx["@href"]);
    const data = xml.parse(await read(path));
    const walk = (points: any) => {
      for (const n of arr(points)) {
        if (n.content?.["@src"])
          add(path, n.content["@src"], text(n.navLabel?.text));
        walk(n.navPoint);
      }
    };
    walk(data.ncx?.navMap?.navPoint);
  }
  if (!html) throw new Error("No readable chapters found.");
  let cover: string | undefined;
  const coverItem =
    manifest.find((x: any) =>
      String(x["@properties"] || "").includes("cover-image"),
    ) ||
    manifest.find(
      (x: any) =>
        x["@id"] ===
        arr(metadata.meta).find((m: any) => m["@name"] === "cover")?.[
          "@content"
        ],
    );
  if (
    coverItem &&
    /^image\/(png|jpeg|gif|webp)$/.test(coverItem["@media-type"])
  ) {
    const image = zip.file(normalizePath(root, coverItem["@href"]));
    if (
      image &&
      Number((image as any)._data?.uncompressedSize) < 2 * 1024 * 1024
    )
      cover =
        "data:" +
        coverItem["@media-type"] +
        ";base64," +
        (await image.async("base64"));
  }
  return {
    title: text(arr(metadata.title)[0]) || "Untitled",
    author: arr(metadata.creator).map(text).join(", "),
    html,
    chapters: chapters.length ? chapters : fallback,
    document: partialMD5(bytes),
    cover,
    kind: "epub",
  };
}
export type CatalogEntry = {
  id: string;
  title: string;
  author: string;
  cover?: string;
  download?: string;
  type?: string;
  navigation?: string;
};
export function parseOPDS(source: string, base: string): CatalogEntry[] {
  const root = xml.parse(source);
  if (!root.feed) throw new Error("This address did not return an OPDS feed.");
  return arr(root.feed?.entry).map((e: any) => {
    const links = arr(e.link);
    const acquisition = links.find(
      (l: any) =>
        String(l["@rel"] || "").includes("acquisition") &&
        /epub|pdf|audio/.test(l["@type"] || ""),
    );
    const image = links.find((l: any) =>
      String(l["@rel"] || "").includes("image"),
    );
    const nav = links.find((l: any) => /atom\+xml/.test(l["@type"] || ""));
    return {
      id: text(e.id) || text(e.title),
      title: text(e.title),
      author: arr(e.author)
        .map((a) => text(a.name))
        .join(", "),
      cover: image ? webURL(image["@href"], base) : undefined,
      download: acquisition ? webURL(acquisition["@href"], base) : undefined,
      type: acquisition?.["@type"],
      navigation: nav ? webURL(nav["@href"], base) : undefined,
    };
  });
}
export function parseFeed(source: string, base: string) {
  const root = xml.parse(source);
  const channel = root.rss?.channel || root.feed;
  if (!channel) throw new Error("Use an RSS or Atom feed address.");
  return {
    title: text(channel.title),
    entries: arr(channel.item || channel.entry)
      .slice(0, 20)
      .map((e: any) => {
        const link =
          typeof e.link === "string"
            ? e.link
            : arr(e.link).find(
                (l: any) => !l["@rel"] || l["@rel"] === "alternate",
              )?.["@href"];
        return {
          title: text(e.title),
          url: webURL(link, base),
          author: text(e.creator || e.author?.name),
          summary: text(e.description || e.summary || e.content),
          cover: (() => {
            try {
              const url =
                e.thumbnail?.["@url"] ||
                e.enclosure?.["@url"] ||
                text(e.description || e.summary || e.content).match(
                  /<img[^>]+src=["']([^"']+)/i,
                )?.[1];
              return url ? webURL(url, base) : undefined;
            } catch {
              return undefined;
            }
          })(),
        };
      }),
  };
}

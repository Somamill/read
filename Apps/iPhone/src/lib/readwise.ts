import { sameBook } from "./matching";
import { md5 } from "js-md5";
import { Book, Settings, progress, webURL } from "./model";
import { list, put, remove, secret } from "./storage";
import { request, queueProgress } from "./network";

export type ReaderPosition = {
  id: string;
  percentage: number;
  timestamp: number;
  account: string;
};
type Cursor = {
  id: string;
  cursor?: string;
  after?: string;
  started?: string;
  checked: number;
};
export async function queueReader(book: Book, s: Settings) {
  if (!s.readerSync || !book.readerID || book.kind === "pdf") return;
  const token = await secret("readwise");
  if (!token) return;
  const item: ReaderPosition = {
    id: book.readerID,
    percentage: book.progress,
    timestamp: book.updated,
    account: md5(token),
  };
  await put("readerPending", item.id, item);
}
let running = false;
export async function syncReader(s: Settings, force = false) {
  if (!s.readerSync || running) return;
  const token = await secret("readwise");
  if (!token) return;
  running = true;
  try {
    const account = md5(token),
      headers = { Authorization: "Token " + token };
    let books = await list<Book>("book");
    for (const item of (await list<ReaderPosition>("readerPending"))
      .filter((x) => x.account === account)
      .slice(0, 12)) {
      // Fetch before pushing: a later edit on another device wins, including intentional rewinds.
      const result = await (
        await request(
          "https://readwise.io/api/v3/list/?id=" + encodeURIComponent(item.id),
          { headers },
        )
      ).json();
      const doc = result.results?.[0];
      if (!doc)
        throw new Error("Readwise no longer contains a queued document.");
      const stamp = Date.parse(doc.last_opened_at || doc.updated_at || "");
      if (!Number.isFinite(stamp))
        throw new Error("Readwise returned an invalid progress timestamp.");
      if (stamp <= item.timestamp)
        await request(
          "https://readwise.io/api/v3/update/" +
            encodeURIComponent(item.id) +
            "/",
          {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ reading_progress: item.percentage }),
          },
        );
      else
        for (const b of books.filter((x) => x.readerID === item.id)) {
          const p = progress(Number(doc.reading_progress));
          await put("book", b.id, {
            ...b,
            progress: p,
            finished: p >= 0.97,
            updated: stamp,
          });
        }
      if (
        (await list<ReaderPosition>("readerPending")).find(
          (x) => x.id === item.id,
        )?.timestamp === item.timestamp
      )
        await remove("readerPending", item.id);
    }
    const state = (await list<Cursor>("readerCursor")).find(
      (x) => x.id === account,
    ) || { id: account, checked: 0 };
    if (!force && Date.now() - state.checked < (state.cursor ? 20000 : 300000))
      return;
    const started = state.started || new Date().toISOString();
    const url = new URL("https://readwise.io/api/v3/list/");
    url.searchParams.set("withHtmlContent", "false");
    url.searchParams.set("limit", "20");
    if (state.cursor) url.searchParams.set("pageCursor", state.cursor);
    if (state.after) url.searchParams.set("updatedAfter", state.after);
    const data = await (await request(url.href, { headers })).json();
    if (!Array.isArray(data.results))
      throw new Error("Readwise returned an invalid document list.");
    books = await list<Book>("book");
    const queued = await list<ReaderPosition>("readerPending");
    for (const doc of data.results) {
      if (!["epub", "article", "email", "rss", "tweet"].includes(doc.category))
        continue;
      const isBook = doc.category === "epub";
      const metadata = {
        title: String(doc.title || "Untitled"),
        author: String(doc.author || ""),
      };
      const candidates = books.filter(
        (b) =>
          b.kind === (isBook ? "epub" : "article") && sameBook(b, metadata),
      );
      const existing =
        books.find((b) => b.readerID === doc.id) ||
        (!isBook
          ? books.find((b) => b.sourceURL === doc.source_url)
          : undefined) ||
        (candidates.length === 1 ? candidates[0] : undefined);
      const id = existing?.id || "readwise-" + doc.id;
      const stamp = Date.parse(doc.last_opened_at || doc.updated_at || "");
      const localPending = queued.find(
        (q) => q.id === doc.id && q.account === account,
      );
      const remoteValue = progress(Number(doc.reading_progress || 0));
      const newer =
        Number.isFinite(stamp) &&
        stamp > (existing?.updated || 0) &&
        (!localPending || stamp > localPending.timestamp);
      const p = existing && !newer ? existing.progress : remoteValue;
      let sourceURL: string | undefined;
      try {
        sourceURL = webURL(doc.source_url || doc.url);
      } catch {}
      const html =
        typeof doc.html_content === "string" &&
        doc.html_content.length < 2 * 1024 * 1024
          ? doc.html_content
          : undefined;
      const b: Book = {
        ...existing,
        id,
        ...metadata,
        kind: isBook ? "epub" : "article",
        html: existing?.html || html,
        sourceURL: existing?.sourceURL || sourceURL,
        cover: existing?.cover || doc.image_url || undefined,
        chapters: existing?.chapters || [],
        readerID: String(doc.id),
        progress: p,
        finished: p >= 0.97,
        updated:
          existing && !newer
            ? existing.updated
            : Number.isFinite(stamp)
              ? stamp
              : Date.now(),
        added: existing?.added || Date.now(),
      };
      await put("book", id, b);
      if (newer && b.document) await queueProgress(b, s);
      books = books.filter((x) => x.id !== id).concat(b);
    }
    await put("readerCursor", account, {
      id: account,
      cursor: data.nextPageCursor || undefined,
      after: data.nextPageCursor ? state.after : started,
      started: data.nextPageCursor ? started : undefined,
      checked: Date.now(),
    });
  } finally {
    running = false;
  }
}

export async function loadReaderContent(book: Book): Promise<Book> {
  if (!book.readerID) return book;
  const token = await secret("readwise");
  if (!token)
    throw new Error(
      "Connect Readwise in Connections, or import your own file.",
    );
  const response = await request(
    "https://readwise.io/api/v3/list/?id=" +
      encodeURIComponent(book.readerID) +
      "&withHtmlContent=true",
    { headers: { Authorization: "Token " + token } },
  );
  const doc = (await response.json()).results?.[0];
  if (typeof doc?.html_content !== "string" || !doc.html_content.trim())
    throw new Error(
      "Reader did not provide this document’s text. Import your original EPUB or PDF from Files.",
    );
  if (doc.html_content.length > 2 * 1024 * 1024)
    throw new Error(
      "This Reader document is too large. Import its original EPUB from Files instead.",
    );
  return { ...book, html: doc.html_content };
}

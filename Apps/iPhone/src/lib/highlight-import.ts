import { Book, Highlight } from "./model";
const normalized = (value: string) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
function index<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    result.set(k, [...(result.get(k) || []), item]);
  }
  return result;
}
const workKey = (title: string, author: string) =>
  normalized(title) + "\0" + normalized(author);
const unique = <T>(items?: T[]) => (items?.length === 1 ? items[0] : undefined);
export function macHighlightImporter(books: Book[], existing: Highlight[]) {
  const byCalibre = index(
    books.filter((b) => b.calibre),
    (b) => b.calibre!.id,
  );
  const byWork = index(books, (b) => workKey(b.title, b.author));
  const byId = new Map(existing.map((h) => [h.id, h]));
  const local = existing.filter((h) => !h.id.startsWith("mac-"));
  const byBookQuote = index(local, (h) => h.bookId + "\0" + normalized(h.text));
  const byWorkQuote = index(
    local,
    (h) => workKey(h.title, h.author || "") + "\0" + normalized(h.text),
  );
  return (raw: any): Highlight => {
    if (
      !raw ||
      !/^[a-f0-9-]{36}$/i.test(raw.id) ||
      typeof raw.text !== "string" ||
      !raw.text.trim() ||
      raw.text.length > 20000
    )
      throw new Error("Invalid highlight in the Mac setup profile.");
    const title = String(raw.title || "Untitled").slice(0, 500),
      author = String(raw.author || "").slice(0, 500);
    const book =
      unique(byCalibre.get(String(raw.bookId))) ||
      (author ? unique(byWork.get(workKey(title, author))) : undefined);
    const id = "mac-" + raw.id;
    const quote = normalized(raw.text);
    const prior =
      byId.get(id) ||
      (book
        ? unique(byBookQuote.get(book.id + "\0" + quote))
        : author
          ? unique(byWorkQuote.get(workKey(title, author) + "\0" + quote))
          : undefined);
    const stamp = (n: unknown) =>
      Number.isFinite(n) && Number(n) >= 0 ? Number(n) * 1000 : 0;
    const remoteReview = {
      count: Math.max(0, Number(raw.reviewCount) || 0),
      lastReviewed: stamp(raw.lastReviewedAt),
      nextReview: stamp(raw.nextReview),
    };
    const imported: Highlight = {
      id,
      bookId: book?.id || "",
      title,
      author,
      text: raw.text,
      note: String(raw.note || "").slice(0, 20000),
      created: stamp(raw.createdAt) || Date.now(),
      source: String(raw.source || "Mac library").slice(0, 100),
      category:
        raw.sourceCategory === "articles" || raw.source === "read. articles"
          ? "articles"
          : "books",
      archived: raw.archived === true,
      frequency: Number.isFinite(raw.frequency) ? raw.frequency : 1,
      review: remoteReview,
      ...prior,
      // Re-pairing must preserve personal notes and the newer review schedule.
      ...(book ? { bookId: book.id } : {}),
      ...((prior?.review?.lastReviewed || 0) < remoteReview.lastReviewed
        ? { review: remoteReview }
        : {}),
      // The originating Mac/provider owns these uploads. A setup snapshot is not
      // a batch of new iPhone highlights to send back to Readwise.
      exported: true,
      mirrored: true,
    };
    byId.set(id, imported);
    return imported;
  };
}
export function macHighlight(
  raw: any,
  books: Book[],
  existing: Highlight[],
): Highlight {
  return macHighlightImporter(books, existing)(raw);
}

export const pendingHighlightExports = (items: Highlight[]) =>
  items.filter((h) => !h.exported && !h.mirrored);

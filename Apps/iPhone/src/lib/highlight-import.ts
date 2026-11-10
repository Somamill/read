import { Book, Highlight } from "./model";
const normalized = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
export function macHighlight(
  raw: any,
  books: Book[],
  existing: Highlight[],
): Highlight {
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
  const candidates = books.filter((b) =>
    raw.bookId > 0
      ? b.calibre?.id === String(raw.bookId)
      : normalized(b.title) === normalized(title) &&
        !!author &&
        normalized(b.author) === normalized(author),
  );
  const book = candidates.length === 1 ? candidates[0] : undefined;
  const id = "mac-" + raw.id;
  const matches = existing.filter(
    (h) =>
      normalized(h.text) === normalized(raw.text) &&
      (book
        ? h.bookId === book.id
        : normalized(h.title) === normalized(title) &&
          !!author &&
          normalized(h.author || "") === normalized(author)),
  );
  const prior =
    existing.find((h) => h.id === id) ||
    (matches.length === 1 && !matches[0].id.startsWith("mac-")
      ? matches[0]
      : undefined);
  const stamp = (n: unknown) =>
    Number.isFinite(n) && Number(n) >= 0 ? Number(n) * 1000 : 0;
  const remoteReview = {
    count: Math.max(0, Number(raw.reviewCount) || 0),
    lastReviewed: stamp(raw.lastReviewedAt),
    nextReview: stamp(raw.nextReview),
  };
  return {
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
  };
}

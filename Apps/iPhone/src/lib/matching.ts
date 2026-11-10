import { Book } from "./model";
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const normalizedAuthor = (s: string) => {
  const n = normalized(s);
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(n)
    ? n.replace(/\s/g, "")
    : n.split(" ").sort().join(" ");
};
/** Never infer identity from a title alone or choose between ambiguous editions. */
export function sameBook(
  a: Pick<Book, "title" | "author" | "identifiers" | "document">,
  b: Pick<Book, "title" | "author" | "identifiers" | "document">,
) {
  if (a.document && b.document && a.document === b.document) return true;
  const isbn = (x: typeof a) =>
    String(x.identifiers?.isbn || "")
      .replace(/[^0-9X]/gi, "")
      .toUpperCase();
  const aISBN = isbn(a),
    bISBN = isbn(b);
  if ([10, 13].includes(aISBN.length) && aISBN === bISBN) return true;
  return (
    !!normalized(a.author) &&
    !["unknown", "unknown author"].includes(normalized(a.author)) &&
    normalized(a.title) === normalized(b.title) &&
    normalizedAuthor(a.author) === normalizedAuthor(b.author)
  );
}
export function linkedBook(incoming: Book, existing: Book[]) {
  const exact = existing.find((b) => b.id === incoming.id);
  const matches = existing.filter(
    (b) => b.kind === incoming.kind && sameBook(b, incoming),
  );
  const prior = exact || (matches.length === 1 ? matches[0] : undefined);
  return prior
    ? {
        ...incoming,
        id: prior.id,
        readerID: prior.readerID,
        calibre: incoming.calibre || prior.calibre,
        hardcoverID: incoming.hardcoverID || prior.hardcoverID,
        document:
          prior.calibre && prior.document ? prior.document : incoming.document,
        hasContent: incoming.hasContent || prior.hasContent,
        cover: incoming.cover || prior.cover,
        progress: prior.progress,
        finished: prior.finished,
        added: prior.added,
      }
    : incoming;
}

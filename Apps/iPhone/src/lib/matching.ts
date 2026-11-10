import { Book } from "./model";
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** Never infer identity from a title alone or choose between ambiguous editions. */
export function sameBook(
  a: Pick<Book, "title" | "author">,
  b: Pick<Book, "title" | "author">,
) {
  return (
    !!normalized(a.author) &&
    normalized(a.title) === normalized(b.title) &&
    normalized(a.author) === normalized(b.author)
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
        hasContent: incoming.hasContent || prior.hasContent,
        cover: incoming.cover || prior.cover,
        progress: prior.progress,
        finished: prior.finished,
        added: prior.added,
      }
    : incoming;
}

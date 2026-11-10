import { md5 } from "js-md5";
import { Book, Settings } from "./model";
import { calibreBase, calibreBook, mergeCalibre } from "./calibre-model";
import { catalogRequest } from "./network";
import { list, put } from "./storage";
import { sameBook } from "./matching";
let running = false;
export async function syncCalibre(s: Settings, force = false) {
  if (!s.opds || running) return;
  const base = calibreBase(s.opds),
    key = md5(base);
  const state = (
    await list<{ id: string; checked: number }>("calibreCursor")
  ).find((x) => x.id === key);
  if (!force && state && Date.now() - state.checked < 300000) return;
  running = true;
  try {
    await put("calibreCursor", key, { id: key, checked: Date.now() });
    const search = await (
      await catalogRequest(
        base + "ajax/search?num=20000&sort=last_modified&sort_order=desc",
        s,
      )
    ).json();
    if (!Array.isArray(search.book_ids))
      throw new Error("Calibre did not return a valid book list.");
    let books = await list<Book>("book");
    const known = new Set(
      books
        .filter((b) => b.calibre?.base === base)
        .map((b) => String(b.calibre!.id)),
    );
    const ids = search.book_ids
      .map(String)
      .filter(
        (id: string, i: number) => force || !state || i < 40 || !known.has(id),
      );
    for (let offset = 0; offset < ids.length; offset += 100) {
      const data = await (
        await catalogRequest(
          base +
            "ajax/books?ids=" +
            encodeURIComponent(ids.slice(offset, offset + 100).join(",")),
          s,
        )
      ).json();
      for (const [id, value] of Object.entries(data)) {
        if (!value || typeof value !== "object") continue;
        const incoming = calibreBook(id, value, base);
        const matches = books.filter(
          (b) => b.kind !== "article" && sameBook(b, incoming),
        );
        const prior =
          books.find(
            (b) =>
              b.id === incoming.id ||
              (b.calibre?.base === base && b.calibre.id === id),
          ) || (matches.length === 1 ? matches[0] : undefined);
        const b = mergeCalibre(incoming, prior);
        await put("book", b.id, b);
        books = books.filter((x) => x.id !== b.id).concat(b);
      }
    }
  } finally {
    running = false;
  }
}

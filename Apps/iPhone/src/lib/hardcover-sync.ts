import { md5 } from "js-md5";
import { Book } from "./model";
import { hardcover } from "./network";
import { list, put, secret } from "./storage";
import { sameBook } from "./matching";
let running = false;
export async function syncHardcover() {
  const token = await secret("hardcover");
  if (!token || running) return;
  const id = md5(token),
    prior = (
      await list<{ id: string; checked: number }>("hardcoverCursor")
    ).find((x) => x.id === id);
  if (prior && Date.now() - prior.checked < 600000) return;
  running = true;
  try {
    await put("hardcoverCursor", id, { id, checked: Date.now() });
    const response = await hardcover();
    let books = await list<Book>("book");
    for (const user of response)
      for (const row of user.user_books || []) {
        const data = row.book;
        if (!data?.id || !data.title) continue;
        const metadata = {
          title: data.title,
          author: (data.contributions || [])
            .map((c: any) => c.author?.name)
            .filter(Boolean)
            .join(", "),
        };
        const exact = books.find((b) => b.hardcoverID === String(data.id));
        const matches = books.filter(
          (b) => b.kind !== "article" && sameBook(b, metadata),
        );
        const existing =
          exact || (matches.length === 1 ? matches[0] : undefined);
        const b: Book = existing
          ? {
              ...existing,
              hardcoverID: String(data.id),
              trackingStatus: existing.finished ? "finished" : "reading",
            }
          : {
              id: "hardcover-" + data.id,
              ...metadata,
              hardcoverID: String(data.id),
              trackingStatus: "reading",
              progressKnown: false,
              kind: "epub",
              cover: data.image?.url,
              chapters: [],
              progress: 0,
              finished: false,
              added: Date.now(),
              updated: Date.now(),
            };
        await put("book", b.id, b);
        books = books.filter((x) => x.id !== b.id).concat(b);
      }
  } finally {
    running = false;
  }
}

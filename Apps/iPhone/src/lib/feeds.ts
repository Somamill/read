import { md5 } from "js-md5";
import { parseFeed } from "./parsers";
import { list, put } from "./storage";
import { Book, Feed } from "./model";
import { request } from "./network";
export const suggestions = [
  ["Weekly Wisereads", "https://wise.readwise.io/feed/"],
  ["Experimental History", "https://www.experimental-history.com/feed"],
  ["Aeon", "https://aeon.co/feed.rss"],
  ["The Marginalian", "https://www.themarginalian.org/feed/"],
  ["Longreads", "https://longreads.com/feed/"],
  ["Quanta Magazine", "https://www.quantamagazine.org/feed/"],
];
export async function subscribe(url: string, force = false) {
  const feeds = await list<Feed>("feed"),
    prior = feeds.find((f) => f.url === url);
  if (prior && !force && Date.now() - prior.checked < 900000) return;
  const response = await request(url);
  const source = await response.text();
  if (source.length > 4 * 1024 * 1024) throw new Error("Feed exceeds 4 MB.");
  const parsed = parseFeed(source, response.url || url),
    books = await list<Book>("book");
  const canonical = response.url || url;
  for (const e of parsed.entries) {
    if (books.some((b) => b.sourceURL === e.url)) continue;
    const now = Date.now();
    await put("book", md5(e.url), {
      id: md5(e.url),
      title: e.title,
      author: e.author || parsed.title,
      cover: e.cover,
      kind: "article",
      sourceURL: e.url,
      feed: canonical,
      chapters: [],
      progress: 0,
      finished: false,
      added: now,
      updated: now,
    });
  }
  await put("feed", canonical, {
    url: canonical,
    title: parsed.title,
    checked: Date.now(),
  });
}

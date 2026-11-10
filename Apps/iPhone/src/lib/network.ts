import { digestAuthorization } from "./auth";
import {
  Book,
  Highlight,
  Pending,
  Settings,
  webURL,
  progress,
  serverPosition,
} from "./model";
import { secret, list, put, remove } from "./storage";
import { md5 } from "js-md5";
import { fromByteArray } from "base64-js";
export async function request(
  url: string,
  init: RequestInit = {},
  limit = 25_000,
  allowUnauthorized = false,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limit);
  try {
    const response = await fetch(webURL(url), {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok && !(allowUnauthorized && response.status === 401))
      throw new Error(`Server returned HTTP ${response.status}.`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}
export async function opdsHeaders(): Promise<Record<string, string>> {
  const username = await secret("opdsUser"),
    password = await secret("opdsPassword");
  return username
    ? {
        Authorization:
          "Basic " +
          fromByteArray(
            new TextEncoder().encode(username + ":" + (password || "")),
          ),
      }
    : {};
}
export function sameOrigin(a: string, b: string) {
  return new URL(a).origin === new URL(b).origin;
}
export async function catalogRequest(url: string, settings: Settings) {
  const authorized = sameOrigin(url, settings.opds);
  const headers = authorized ? await opdsHeaders() : {};
  const response = await request(url, { headers }, 25000, true);
  if (response.status !== 401) return response;
  const challenge = response.headers.get("www-authenticate") || "";
  if (!authorized || !/^Digest /i.test(challenge))
    throw new Error("OPDS login was not accepted. Check Connections.");
  const username = await secret("opdsUser"),
    password = await secret("opdsPassword");
  if (!username)
    throw new Error("Enter your OPDS username and password in Connections.");
  return request(url, {
    headers: {
      Authorization: digestAuthorization(
        challenge,
        url,
        username,
        password || "",
        md5(String(Date.now()) + Math.random()),
      ),
    },
  });
}
export async function syncHeaders(s: Settings) {
  const password = await secret("syncPassword"),
    key = await secret("syncKey");
  if (!s.sync || !s.username || (!password && !key))
    throw new Error("Connect your sync server, username and password first.");
  return {
    Accept: "application/vnd.koreader.v1+json",
    "Content-Type": "application/json",
    "x-auth-user": s.username,
    "x-auth-key": key || md5(password!),
  };
}
export async function remoteProgress(book: Book, s: Settings, timeout = 25000) {
  if (!book.document || book.kind === "article" || !s.sync) return;
  const r = await request(
    s.sync.replace(/\/$/, "") + "/syncs/progress/" + book.document,
    { headers: await syncHeaders(s) },
    timeout,
  );
  return serverPosition(await r.json());
}
export async function queueProgress(book: Book, s: Settings) {
  if (book.kind === "article" || !book.document) return;
  const item: Pending = {
    document: book.document,
    percentage: book.progress,
    timestamp: book.updated / 1000,
    title: book.title,
    author: book.author,
  };
  await put("pending", item.document, item);
}
let flushing = false;
export async function flush(s: Settings) {
  if (flushing || !s.sync) return;
  flushing = true;
  try {
    for (const item of (await list<Pending>("pending")).slice(0, 12)) {
      const headers = await syncHeaders(s);
      let newer = false;
      try {
        const remote = serverPosition(
          await (
            await request(
              s.sync.replace(/\/$/, "") + "/syncs/progress/" + item.document,
              { headers },
            )
          ).json(),
        );
        newer = Number(remote.timestamp) > item.timestamp;
      } catch (error) {
        if (!String(error).includes("404")) throw error;
      }
      if (newer) {
        const remote = serverPosition(
          await (
            await request(
              s.sync.replace(/\/$/, "") + "/syncs/progress/" + item.document,
              { headers },
            )
          ).json(),
        );
        for (const b of await list<Book>("book"))
          if (b.document === item.document) {
            const value = progress(Number(remote.percentage));
            await put("book", b.id, {
              ...b,
              progress: value,
              finished: value >= 0.97,
              updated: Number(remote.timestamp) * 1000,
            });
          }
      }
      if (!newer)
        await request(s.sync.replace(/\/$/, "") + "/syncs/progress", {
          method: "PUT",
          headers,
          body: JSON.stringify({
            ...item,
            progress: String(item.percentage),
            device: "read. iPhone",
            device_id: "read-mobile",
            metadata: { title: item.title, authors: item.author },
          }),
        });
      const current = (await list<Pending>("pending")).find(
        (x) => x.document === item.document,
      );
      if (current?.timestamp === item.timestamp)
        await remove("pending", item.document);
    }
  } finally {
    flushing = false;
  }
}
export async function sendReadwise(highlights: Highlight[]) {
  const token = await secret("readwise");
  if (!token) throw new Error("Connect Readwise first.");
  const pending = highlights.filter((h) => !h.exported).slice(0, 100);
  if (!pending.length) return 0;
  await request("https://readwise.io/api/v2/highlights/", {
    method: "POST",
    headers: {
      Authorization: "Token " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      highlights: pending.map((h) => ({
        text: h.text,
        title: h.title,
        note: h.note,
        source_type: "read-mobile",
        category: h.category || "books",
        highlighted_at: new Date(h.created).toISOString(),
      })),
    }),
  });
  for (const h of pending)
    await put("highlight", h.id, { ...h, exported: true });
  return pending.length;
}
export async function hardcover() {
  const token = await secret("hardcover");
  if (!token) throw new Error("Connect Hardcover first.");
  const r = await request("https://api.hardcover.app/v1/graphql", {
    method: "POST",
    headers: {
      Authorization: token.startsWith("Bearer ") ? token : "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "{ me { username user_books(where: {status_id: {_eq: 2}}) { id book { id title contributions { author { name } } image { url } } } } }",
    }),
  });
  const body = await r.json();
  if (body.errors)
    throw new Error("Hardcover rejected the request. Check your token.");
  return body.data?.me || [];
}

// Poll only imported EPUB fingerprints. Foreground-only, bounded work per cycle.
let cursor = 0;
export async function pullProgress(s: Settings) {
  if (!s.sync) return [];
  const changed: Book[] = [];
  const books = (await list<Book>("book")).filter(
    (b) =>
      b.document &&
      b.kind === "epub" &&
      (b.hasContent || (b.progress > 0 && !b.finished)),
  );
  const pending = await list<Pending>("pending");
  for (const b of books.slice(cursor, cursor + 12)) {
    try {
      const remote = await remoteProgress(b, s);
      if (!remote) continue;
      const local = pending.find((x) => x.document === b.document);
      if (local && local.timestamp >= remote.timestamp) continue;
      const value = progress(Number(remote.percentage));
      if (value !== b.progress) {
        const updated = {
          ...b,
          progress: value,
          finished: value >= 0.97,
          updated: Number(remote.timestamp) * 1000,
        };
        await put("book", b.id, updated);
        changed.push(updated);
      }
    } catch (e) {
      if (!String(e).includes("404")) throw e;
    }
  }
  cursor = books.length ? (cursor + 12) % books.length : 0;
  return changed;
}

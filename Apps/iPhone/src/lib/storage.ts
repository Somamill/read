import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { StoredRecord, writeRecords } from "./record-batch";
import { Book, Highlight, Feed, Pending, Settings, defaults } from "./model";
let connection: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!connection)
    connection = (async () => {
      const d = await SQLite.openDatabaseAsync("read-mobile.sqlite");
      await d.execAsync(
        "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT,value TEXT,PRIMARY KEY(kind,id));",
      );
      return d;
    })();
  return connection;
}
export async function list<T>(kind: string): Promise<T[]> {
  const rows = await (
    await db()
  ).getAllAsync<{ value: string }>(
    "SELECT value FROM records WHERE kind=?",
    kind,
  );
  return rows.map((row) => {
    const value = JSON.parse(row.value);
    // Lists carry metadata only. Book HTML is fetched when its reader opens.
    if (kind === "book" && value.html) {
      const { html, ...metadata } = value;
      return { ...metadata, hasContent: true } as T;
    }
    return value as T;
  });
}
export async function put(kind: string, id: string, value: unknown) {
  const d = await db();
  if (kind === "book") {
    const b = value as Book;
    if (b.html !== undefined) {
      await d.runAsync(
        "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
        "content",
        id,
        JSON.stringify(b.html),
      );
      const { html, ...metadata } = b;
      value = { ...metadata, hasContent: !!html };
    }
  }
  await d.runAsync(
    "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
    kind,
    id,
    JSON.stringify(value),
  );
}
export async function putSetupRecords(rows: StoredRecord[]) {
  await writeRecords(await db(), rows);
}
export async function content(id: string): Promise<string | undefined> {
  const d = await db();
  const row = await d.getFirstAsync<{ value: string }>(
    "SELECT value FROM records WHERE kind=? AND id=?",
    "content",
    id,
  );
  if (row) return JSON.parse(row.value);
  // Read older preview records without rewriting the entire library on startup.
  const legacy = await d.getFirstAsync<{ value: string }>(
    "SELECT value FROM records WHERE kind=? AND id=?",
    "book",
    id,
  );
  return legacy ? JSON.parse(legacy.value).html : undefined;
}
export async function exportSnapshot() {
  const data = await snapshot();
  return {
    ...data,
    views: await list("reading-view"),
    books: await Promise.all(
      data.books.map(async (b) => ({ ...b, html: await content(b.id) })),
    ),
  };
}
export async function remove(kind: string, id: string) {
  await (
    await db()
  ).runAsync("DELETE FROM records WHERE kind=? AND id=?", kind, id);
}
export const secret = (key: string) =>
  SecureStore.getItemAsync("read.mobile." + key);
export const setSecret = (key: string, value: string) =>
  value
    ? SecureStore.setItemAsync("read.mobile." + key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
    : SecureStore.deleteItemAsync("read.mobile." + key);
export async function snapshot() {
  return {
    books: await list<Book>("book"),
    highlights: await list<Highlight>("highlight"),
    feeds: await list<Feed>("feed"),
    pending: await list<Pending>("pending"),
    settings: { ...defaults, ...(await list<Settings>("settings"))[0] },
  };
}

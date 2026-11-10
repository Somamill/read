import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { writeRecords } from "../src/lib/record-batch";
import { macHighlightImporter } from "../src/lib/highlight-import";
import { Book } from "../src/lib/model";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE records(kind TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(kind,id))",
  );
  let calls = 0;
  const tx = {
    runAsync: async (sql: string, ...params: string[]) => {
      calls++;
      db.prepare(sql).run(...params);
    },
  };
  const adapter = {
    withExclusiveTransactionAsync: async (
      task: (writer: typeof tx) => Promise<void>,
    ) => {
      db.exec("BEGIN");
      try {
        await task(tx);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, adapter, calls: () => calls };
}
test("large setup saves in bounded parameterized batches and remains idempotent", async () => {
  const { db, adapter, calls } = database();
  try {
    const rows = Array.from({ length: 5100 }, (_, i) => ({
      kind: "highlight",
      id: String(i),
      value: {
        text: "日本語 '); DROP TABLE records; --",
        note: "Notes stay intact",
        index: i,
      },
    }));
    await writeRecords(adapter, rows);
    assert.equal(calls(), 51);
    await writeRecords(adapter, rows);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM records").get()!.count,
      5100,
    );
    assert.equal(
      JSON.parse(
        String(
          db.prepare("SELECT value FROM records WHERE id='0'").get()!.value,
        ),
      ).note,
      "Notes stay intact",
    );
  } finally {
    db.close();
  }
});
test("a failed later batch rolls back the entire setup instead of leaving a partial library", async () => {
  const { db, adapter } = database();
  try {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      kind: "highlight",
      id: String(i),
      value: { text: "Passage" },
    }));
    rows[100].id = null as unknown as string;
    await assert.rejects(writeRecords(adapter, rows));
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM records").get()!.count,
      0,
    );
  } finally {
    db.close();
  }
});
test("indexed highlight import handles thousands of distinct passages and repeated setup safely", () => {
  const books = [
    { id: "book", title: "本", author: "著者", calibre: { id: "7" } },
  ] as Book[];
  const merge = macHighlightImporter(books, []);
  const rows = Array.from({ length: 4000 }, (_, i) => ({
    id: `12345678-1234-1234-1234-${String(i).padStart(12, "0")}`,
    bookId: 7,
    title: "本",
    author: "著者",
    text: "A longer passage ".repeat(30) + i,
  }));
  const imported = rows.map(merge);
  assert.equal(new Set(imported.map((h) => h.id)).size, 4000);
  const note = { ...imported[25], note: "My edited note" };
  const again = macHighlightImporter(
    books,
    imported.map((h) => (h.id === note.id ? note : h)),
  );
  assert.equal(again(rows[25]).note, "My edited note");
  assert.ok(imported.every((h) => h.bookId === "book" && h.mirrored));
});

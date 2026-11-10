import { test } from "node:test";
import assert from "node:assert/strict";
import { Highlight, Book } from "../src/lib/model";
import { reviewQueue, reviewedHighlight } from "../src/lib/review";
import {
  macHighlight,
  pendingHighlightExports,
} from "../src/lib/highlight-import";
const passage = (id: string, changes: Partial<Highlight> = {}): Highlight => ({
  id,
  bookId: "book",
  title: "本",
  text: "月",
  note: "My note",
  created: 1,
  ...changes,
});
test("daily review includes books and articles, short Unicode passages, and excludes archived, disabled and future items", () => {
  const time = new Date(2026, 10, 10, 12).getTime();
  const items = [
    passage("book"),
    passage("article", { category: "articles" }),
    passage("archived", { archived: true }),
    passage("disabled", { frequency: 0 }),
    passage("future", {
      review: {
        count: 1,
        lastReviewed: time - 86400000,
        nextReview: time + 86400000,
      },
    }),
  ];
  assert.deepEqual(
    new Set(reviewQueue(items, 2, time).cards.map((h) => h.id)),
    new Set(["book", "article"]),
  );
  assert.deepEqual(reviewQueue(items, 2, time), reviewQueue(items, 2, time));
});
test("daily completion persists, duplicate reviews are idempotent, and reviewing preserves notes and export state", () => {
  const time = new Date(2026, 10, 10, 12).getTime();
  let items = Array.from({ length: 8 }, (_, i) =>
    passage(String(i), { exported: true }),
  );
  for (let i = 0; i < 3; i++) {
    const h = reviewQueue(items, 3, time).cards[0];
    const done = reviewedHighlight(h, 7, time);
    assert.equal(done.note, h.note);
    assert.equal(done.exported, true);
    assert.deepEqual(reviewedHighlight(done, 30, time), done);
    items = items.map((x) => (x.id === done.id ? done : x));
  }
  const reopened: Highlight[] = JSON.parse(JSON.stringify(items));
  assert.equal(reviewQueue(reopened, 3, time).reviewed, 3);
  assert.equal(reviewQueue(reopened, 3, time).cards.length, 0);
  assert.equal(reviewQueue(reopened, 5, time).cards.length, 2);
  assert.equal(
    reviewQueue(reopened, 3, new Date(2026, 10, 11, 0, 1).getTime()).cards
      .length,
    3,
  );
});
test("tomorrow is the next local midnight across a daylight-saving change", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const time = new Date(2026, 9, 31, 23, 30).getTime();
    const next = new Date(
      reviewedHighlight(passage("1"), 2, time).review!.nextReview,
    );
    assert.equal(next.getDate(), 2);
    assert.equal(next.getMonth(), 10);
    assert.equal(next.getHours(), 0);
    assert.throws(() => reviewedHighlight(passage("2"), NaN, time));
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("private Mac highlight import links Calibre identity, keeps notes and the newer local review schedule", () => {
  const raw = {
    id: "12345678-1234-1234-1234-123456789abc",
    bookId: 7,
    title: "本",
    author: "著者",
    text: "月",
    note: "Mac note",
    lastReviewedAt: 10,
    nextReview: 20,
    reviewCount: 1,
  };
  const book = {
    id: "calibre-uuid",
    calibre: { id: "7" },
    title: "本",
  } as Book;
  const h = macHighlight(raw, [book], []);
  assert.equal(h.bookId, book.id);
  assert.equal(
    h.exported,
    true,
    "mirrored highlights must not be uploaded as new Readwise highlights",
  );
  assert.equal(h.review!.lastReviewed, 10000);
  const local = {
    ...h,
    note: "My edited note",
    review: { count: 3, lastReviewed: 30000, nextReview: 60000 },
  };
  assert.deepEqual(macHighlight(raw, [book], [local]), local);
  const other = macHighlight(
    { ...raw, id: "87654321-1234-1234-1234-123456789abc" },
    [book],
    [h],
  );
  assert.notEqual(
    other.id,
    h.id,
    "identical passages at different source locations stay distinct",
  );
  assert.throws(() => macHighlight({ ...raw, text: "" }, [book], []));
});

test("mirrored passages and edited exported notes cannot be sent as new highlights", () => {
  const local = passage("new");
  const mirrored = passage("mirrored", {
    mirrored: true,
    exported: false,
    note: "Edited on iPhone",
  });
  const sent = passage("sent", { exported: true });
  assert.deepEqual(
    pendingHighlightExports([local, mirrored, sent]).map((h) => h.id),
    ["new"],
  );
});

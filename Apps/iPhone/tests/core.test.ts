import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import {
  parseEPUB,
  partialMD5,
  parseFeed,
  parseOPDS,
  normalizePath,
} from "../src/lib/parsers";
import { mergeProgress, webURL } from "../src/lib/model";
import { digestAuthorization } from "../src/lib/auth";

async function fixture(nav = false) {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  zip.file(
    "OPS/book.opf",
    `<package><metadata><dc:title xmlns:dc="urn:dc">六人の嘘つきな大学生</dc:title><dc:creator xmlns:dc="urn:dc">浅倉 秋成</dc:creator></metadata><manifest><item id="ten" href="10.xhtml"/><item id="two" href="2.xhtml"/>${nav ? '<item id="nav" href="nav.xhtml" properties="nav"/>' : ""}</manifest><spine><itemref idref="two"/><itemref idref="ten"/></spine></package>`,
  );
  zip.file(
    "OPS/2.xhtml",
    '<html><body><h1 id="start">Chapter 2</h1><p>Second</p><a href="10.xhtml#start">Next</a></body></html>',
  );
  zip.file(
    "OPS/10.xhtml",
    '<html><body><h1 id="start">Chapter 10</h1><p>Tenth</p><a href="#start">Top</a></body></html>',
  );
  if (nav)
    zip.file(
      "OPS/nav.xhtml",
      '<html><body><nav epub:type="toc" xmlns:epub="urn:epub"><ol><li><a href="2.xhtml#start">The second chapter</a><ol><li><a href="10.xhtml#start">The tenth chapter</a></li></ol></li></ol></nav></body></html>',
    );
  return zip.generateAsync({ type: "uint8array" });
}
test("EPUB uses spine order, Unicode metadata and collision-free fragment links", async () => {
  const b = await parseEPUB(await fixture());
  assert.equal(b.title, "六人の嘘つきな大学生");
  assert.equal(b.author, "浅倉 秋成");
  assert.ok(b.html!.indexOf("Second") < b.html!.indexOf("Tenth"));
  assert.deepEqual(
    b.chapters!.map((x) => x.title),
    ["Chapter 2", "Chapter 10"],
  );
  assert.match(b.html!, /href="#chapter-1-start"/);
  assert.match(b.html!, /id="chapter-0-start"/);
});
test("EPUB nested navigation preserves labels and fragment targets", async () => {
  const b = await parseEPUB(await fixture(true));
  assert.deepEqual(b.chapters, [
    { id: "chapter-0-start", title: "The second chapter" },
    { id: "chapter-1-start", title: "The tenth chapter" },
  ]);
});
test("KOReader sampled fingerprint matches independent hash implementation", () => {
  const data = Uint8Array.from(
    { length: 100_000 },
    (_, i) => (i * 13 + (i % 31)) % 256,
  );
  const h = createHash("md5");
  for (const offset of [0, 1024, 4096, 16384, 65536])
    h.update(data.subarray(offset, offset + 1024));
  assert.equal(partialMD5(data), h.digest("hex"));
  assert.equal(
    partialMD5(new Uint8Array([1, 2, 3])),
    createHash("md5")
      .update(new Uint8Array([1, 2, 3]))
      .digest("hex"),
  );
});
test("invalid and oversized EPUBs fail, traversal is rejected", async () => {
  await assert.rejects(parseEPUB(new Uint8Array([1, 2, 3])));
  await assert.rejects(parseEPUB(new Uint8Array(33 * 1024 * 1024)), /32 MB/);
  assert.throws(() => normalizePath("OPS/book.opf", "../../secret"), /Invalid/);
});
test("OPDS relative navigation, covers and acquisitions resolve on their source server", () => {
  const entries = parseOPDS(
    '<feed><entry><id>1</id><title>Book</title><author><name>Writer</name></author><link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="../get/1.epub"/><link rel="http://opds-spec.org/image" href="/cover/1"/></entry></feed>',
    "https://books.example/opds/new",
  );
  assert.equal(entries[0].download, "https://books.example/get/1.epub");
  assert.equal(entries[0].cover, "https://books.example/cover/1");
});
test("RSS and Atom recognize subscriptions, not article extraction", () => {
  assert.equal(
    parseFeed(
      "<rss><channel><title>Feed</title><item><title>One</title><link>https://example.org/post</link></item></channel></rss>",
      "https://example.org/feed",
    ).entries[0].title,
    "One",
  );
  assert.equal(
    parseFeed(
      '<feed><title>Atom</title><entry><title>Two</title><link href="/post"/></entry></feed>',
      "https://example.org/feed",
    ).entries[0].url,
    "https://example.org/post",
  );
  assert.throws(() =>
    parseFeed("<html>not a feed</html>", "https://example.org/feed"),
  );
});
test("sync preserves a newer offline position and accepts a newer remote rewind", () => {
  const local = {
    document: "id",
    title: "Book",
    author: "Writer",
    percentage: 0.7,
    timestamp: 100,
  };
  assert.equal(
    mergeProgress(local, { percentage: 0.3, timestamp: 90 }).percentage,
    0.7,
  );
  assert.equal(
    mergeProgress(local, { percentage: 0.2, timestamp: 110 }).percentage,
    0.2,
  );
  assert.throws(() =>
    mergeProgress(undefined, { percentage: NaN, timestamp: 100 }),
  );
});
test("web addresses reject active schemes and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:secret@example.org",
  ])
    assert.throws(() => webURL(url));
  assert.equal(
    webURL("/post", "https://example.org"),
    "https://example.org/post",
  );
});
test("Calibre Digest matches RFC 2617 reference vector", () => {
  const result = digestAuthorization(
    'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
    "http://www.example.com/dir/index.html",
    "Mufasa",
    "Circle Of Life",
    "0a4f113b",
  );
  assert.match(result, /response="6629fae49393a05397450978507c4ef1"/);
  assert.match(result, /qop=auth/);
  assert.throws(() =>
    digestAuthorization(
      'Digest realm="r", nonce="n", algorithm=SHA-512',
      "https://example.org",
      "a",
      "b",
      "c",
    ),
  );
});

test("exact external book linking keeps one record, progress and reader identity", async () => {
  const { linkedBook } = await import("../src/lib/matching");
  const existing = {
    id: "readwise-123",
    title: "Golden Son",
    author: "Pierce Brown",
    kind: "epub" as const,
    readerID: "123",
    chapters: [],
    progress: 0.4,
    finished: false,
    added: 10,
    updated: 20,
  };
  const incoming = {
    ...existing,
    id: "file-hash",
    document: "file-hash",
    readerID: undefined,
    html: "<p>Original EPUB</p>",
    progress: 0,
    added: 30,
  };
  const result = linkedBook(incoming, [existing]);
  assert.equal(result.id, "readwise-123");
  assert.equal(result.readerID, "123");
  assert.equal(result.document, "file-hash");
  assert.equal(result.progress, 0.4);
  assert.equal(result.html, incoming.html);
  assert.equal(
    linkedBook(incoming, [existing, { ...existing, id: "different-edition" }])
      .id,
    "file-hash",
  );
  assert.equal(
    linkedBook({ ...incoming, author: "" }, [existing]).id,
    "file-hash",
  );
});

test("invalid server positions cannot silently mark books finished", async () => {
  const { serverPosition } = await import("../src/lib/model");
  assert.deepEqual(serverPosition({ percentage: ".4", timestamp: "100" }), {
    percentage: 0.4,
    timestamp: 100,
  });
  for (const value of [
    { percentage: 40, timestamp: 100 },
    { percentage: 0.4, timestamp: "invalid" },
    { percentage: NaN, timestamp: 100 },
    { percentage: 0.4, timestamp: Date.now() },
  ])
    assert.throws(() => serverPosition(value));
});

test("Calibre catalog keeps all formats, Unicode titles, stable UUIDs and bridge progress", async () => {
  const { calibreBook, mergeCalibre, readableFormat, calibreBase } =
    await import("../src/lib/calibre-model");
  const b = calibreBook(
    "211",
    {
      uuid: "uuid-211",
      title: "日本語の本",
      authors: ["作家"],
      timestamp: "2026-01-01",
      last_modified: "2026-02-01",
      thumbnail: "/get/thumb/211/library",
      main_format: { epub: "/get/epub/211/library" },
      other_formats: { pdf: "/get/pdf/211/library" },
      user_metadata: {
        "#ko_md5": { "#value": "a".repeat(32) },
        "#ko_progfloat": { "#value": 0.44 },
      },
    },
    "https://books.example/",
  );
  assert.equal(b.id, "calibre-uuid-211");
  assert.equal(b.title, "日本語の本");
  assert.equal(b.progress, 0.44);
  assert.equal(b.document, "a".repeat(32));
  assert.equal(readableFormat(b)?.kind, "epub");
  assert.equal(
    b.calibre?.formats.pdf,
    "https://books.example/get/pdf/211/library",
  );
  assert.equal(
    calibreBase("https://books.example/proxy/opds/"),
    "https://books.example/proxy/",
  );
  const newer = {
    ...b,
    id: "readwise-one",
    readerID: "reader-one",
    progress: 0.7,
    updated: b.updated + 5000,
    hasContent: true,
  };
  const merged = mergeCalibre(b, newer);
  assert.equal(merged.id, "readwise-one");
  assert.equal(merged.progress, 0.7);
  assert.equal(merged.readerID, "reader-one");
  assert.equal(merged.hasContent, true);
});
test("pairing credentials stay in the fragment and reject unsafe endpoints and malformed grants", async () => {
  const { setupLink, encode64, validateProfile } =
    await import("../src/lib/pairing-model");
  const profile = {
    v: 1,
    endpoint: "https://pair.example/pair",
    token: "A".repeat(43),
    key: encode64(new Uint8Array(32)),
  };
  const url =
    "exp://u.expo.dev/project?channel-name=iphone-preview#read-setup=" +
    encode64(new TextEncoder().encode(JSON.stringify(profile)));
  assert.equal(setupLink(url)?.endpoint, profile.endpoint);
  assert.ok(!new URL(url).search.includes("token"));
  assert.equal(setupLink("exp://u.expo.dev/project"), undefined);
  const invalid = { ...profile, endpoint: "http://untrusted.example/pair" };
  assert.throws(() =>
    setupLink(
      "exp://u.expo.dev/project#read-setup=" +
        encode64(new TextEncoder().encode(JSON.stringify(invalid))),
    ),
  );
  assert.throws(() =>
    validateProfile({
      version: 1,
      settings: { opds: "javascript:alert(1)" },
      secrets: {},
      catalog: { records: [] },
    }),
  );
  const valid = validateProfile({
    version: 1,
    settings: {
      opds: "https://books.example/opds",
      sync: "https://sync.example",
      username: "reader",
    },
    secrets: { readwise: "sample-test-token" },
    catalog: { records: [] },
  });
  assert.equal(valid.settings.readerSync, true);
  assert.equal(valid.settings.onboarded, true);
});

test("catalog metadata edits do not reset newer local progress, and equivalent author order links safely", async () => {
  const { calibreBook, mergeCalibre } =
    await import("../src/lib/calibre-model");
  const { sameBook, linkedBook } = await import("../src/lib/matching");
  const remote = calibreBook(
    "5",
    {
      uuid: "five",
      title: "An Example",
      authors: ["Brown, Pierce"],
      last_modified: "2099-01-01",
      main_format: { epub: "/get/epub/5" },
      user_metadata: {
        "#ko_md5": { "#value": "b".repeat(32) },
        "#ko_progfloat": { "#value": 0.1 },
      },
    },
    "https://books.example/",
  );
  const local = {
    ...remote,
    updated: Date.parse("2026-01-01"),
    progress: 0.8,
    hasContent: true,
  };
  assert.equal(mergeCalibre(remote, local).progress, 0.8);
  assert.equal(
    sameBook(
      { title: "An Example", author: "Pierce Brown" },
      { title: "An Example", author: "Brown| Pierce" },
    ),
    true,
  );
  assert.equal(
    sameBook(
      { title: "A", author: "Unknown" },
      { title: "A", author: "Unknown" },
    ),
    false,
  );
  const replaced = linkedBook({ ...local, document: "a".repeat(32) }, [local]);
  assert.equal(replaced.document, "b".repeat(32));
});

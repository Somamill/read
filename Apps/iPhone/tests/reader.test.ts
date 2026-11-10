import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { readerHTML, extractionHTML } from "../src/lib/reader";
import { defaults, Book } from "../src/lib/model";
const book: Book = {
  id: "one",
  kind: "epub",
  title: "A book",
  author: "Writer",
  html: '<h2 id="chapter-0">Chapter 1</h2><p>A passage worth remembering.</p>',
  chapters: [{ id: "chapter-0", title: "Chapter 1" }],
  progress: 0.2,
  finished: false,
  added: 1,
  updated: 1,
};
function dom(html: string) {
  const messages: any[] = [];
  const errors: any[] = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (e: any) => {
    if (e.cause) errors.push(e.cause.message);
  });
  const d = new JSDOM(html, {
    runScripts: "dangerously",
    virtualConsole: console,
    beforeParse(window) {
      (window as any).ReactNativeWebView = {
        postMessage: (s: string) => messages.push(JSON.parse(s)),
      };
    },
  });
  return { d, messages, errors };
}
test("reader sanitizes active content and restores local highlights", () => {
  const { d, errors } = dom(
    readerHTML(
      {
        ...book,
        html:
          book.html +
          '<script>window.pwned=true</script><img src=x onerror="window.pwned=true"><iframe src="https://bad.example"></iframe>',
      },
      defaults,
      true,
      ["passage worth remembering"],
    ),
  );
  assert.equal((d.window as any).pwned, undefined);
  assert.equal(d.window.document.querySelector("#flow script"), null);
  assert.equal(d.window.document.querySelector("#flow iframe"), null);
  assert.equal(d.window.document.querySelector("#flow [onerror]"), null);
  assert.equal(
    d.window.document.querySelector("mark")?.textContent,
    "passage worth remembering",
  );
  assert.equal(
    d.window.document.getElementById("chapter-0")?.textContent,
    "Chapter 1",
  );
  assert.deepEqual(errors, []);
  d.window.close();
});
test("HTML data cannot close the embedded reader script", () => {
  const { d } = dom(
    readerHTML(
      { ...book, title: "</script><script>window.pwned=true</script>" },
      defaults,
      false,
    ),
  );
  assert.equal((d.window as any).pwned, undefined);
  assert.match(
    d.window.document.querySelector("h1")?.textContent || "",
    /script/,
  );
  d.window.close();
});
test("article extractor produces readable content and absolute image URLs", () => {
  const source =
    '<html><head><title>A long thoughtful essay</title></head><body><article><h1>A long thoughtful essay</h1><img src="/photo.jpg">' +
    Array.from(
      { length: 10 },
      () =>
        "<p>This paragraph discusses reading thoughtfully and remembering meaningful passages. A well written essay has room for reflection and ideas.</p>",
    ).join("") +
    "</article></body></html>";
  const { d, messages, errors } = dom(
    extractionHTML(source, "https://example.org/essay"),
  );
  const result = messages.find((x) => x.type === "extracted");
  assert.ok(result, JSON.stringify(messages));
  assert.match(result.item.content, /https:\/\/example.org\/photo.jpg/);
  assert.deepEqual(errors, []);
  d.window.close();
});

import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { md5 } from "js-md5";
import { useRead } from "../lib/context";
import { Page, Label, Button } from "../components/UI";
import { request } from "../lib/network";
import { webURL, Book } from "../lib/model";
import { importBytes } from "../lib/importer";
import { subscribe } from "../lib/feeds";
import { extractionHTML } from "../lib/reader";
export default function Capture() {
  const params = useLocalSearchParams<{ url: string; existing?: string }>(),
    { saveBook, books, reload, report } = useRead();
  const handled = useRef(false);
  const [html, setHTML] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      let url = webURL(params.url);
      for (let n = 0; n < 5; n++) {
        const u = new URL(url);
        if (/(^|\.)readwise\.io$/.test(u.hostname) && u.searchParams.has("url"))
          url = webURL(u.searchParams.get("url")!);
        else break;
      }
      const response = await request(url);
      if (!active) return;
      const type = response.headers.get("content-type") || "";
      if (/pdf|epub/.test(type)) {
        const b = await importBytes(
          new Uint8Array(await response.arrayBuffer()),
          new URL(response.url || url).pathname.split("/").pop() || "Document",
          type,
        );
        const saved = await saveBook(b);
        router.replace({ pathname: "/reader", params: { id: saved.id } });
        return;
      }
      const text = await response.text();
      if (text.length > 4 * 1024 * 1024)
        throw new Error("Article exceeds 4 MB.");
      if (/<(rss|feed)\b/.test(text.slice(0, 1000))) {
        await subscribe(response.url || url, true);
        await reload();
        router.replace("/articles");
        return;
      }
      setHTML(extractionHTML(text, response.url || url));
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [params.url, reload, saveBook]);
  return (
    <Page title="Saving article" subtitle="Preparing a readable local copy.">
      {!error && <ActivityIndicator />}
      {error ? (
        <>
          <Label>{error}</Label>
          <Label small>
            Login-only pages may not expose readable text. Use a public
            original-source URL.
          </Label>
          <Button title="Back" onPress={() => router.back()} />
        </>
      ) : (
        <Button secondary title="Cancel" onPress={() => router.back()} />
      )}
      <View style={{ height: 1, opacity: 0 }}>
        {!!html && (
          <WebView
            source={{ html }}
            originWhitelist={["*"]}
            javaScriptEnabled
            onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
            onMessage={async (e) => {
              try {
                if (handled.current) return;
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === "error") {
                  setError(msg.message);
                  return;
                }
                if (msg.type !== "extracted") return;
                handled.current = true;
                const item = msg.item;
                const existing = books.find(
                  (b) => b.id === params.existing || b.sourceURL === item.url,
                );
                const id = existing?.id || md5(item.url);
                const b: Book = {
                  id,
                  title: item.title,
                  author: item.author,
                  kind: "article",
                  sourceURL: item.url,
                  html: item.content,
                  chapters: [],
                  progress: existing?.progress || 0,
                  finished: existing?.finished || false,
                  added: existing?.added || Date.now(),
                  updated: Date.now(),
                  readerID: existing?.readerID,
                  cover:
                    existing?.cover ||
                    (() => {
                      try {
                        const image = item.content.match(
                          /<img[^>]+src=["']([^"']+)/i,
                        )?.[1];
                        return image ? webURL(image, item.url) : undefined;
                      } catch {
                        return undefined;
                      }
                    })(),
                  feed: existing?.feed,
                };
                const saved = await saveBook(b);
                router.replace({
                  pathname: "/reader",
                  params: { id: saved.id },
                });
              } catch (e) {
                report(e);
                setError(String(e));
              }
            }}
          />
        )}
      </View>
    </Page>
  );
}

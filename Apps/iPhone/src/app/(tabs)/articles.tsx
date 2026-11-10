import { useState, useCallback } from "react";
import { Alert, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useRead } from "../../lib/context";
import { Page, Card, Label, Button, Field } from "../../components/UI";
import { subscribe, suggestions } from "../../lib/feeds";
import { remove } from "../../lib/storage";
export default function Articles() {
  const { books, feeds, reload, report, saveProgress } = useRead();
  const [visible, setVisible] = useState(40);
  const [url, setURL] = useState(""),
    [feed, setFeed] = useState(""),
    [query, setQuery] = useState(""),
    [finished, setFinished] = useState(false);
  const feedURLs = JSON.stringify(feeds.map((f) => f.url));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        for (const url of JSON.parse(feedURLs) as string[])
          try {
            await subscribe(url);
          } catch {}
        if (active) await reload();
      })();
      return () => {
        active = false;
      };
    }, [feedURLs, reload]),
  );
  const follow = async (u: string) => {
    try {
      await subscribe(u, true);
      await reload();
      setFeed("");
    } catch (e) {
      report(e);
      Alert.alert("Feed unavailable", (e as Error).message);
    }
  };
  const filteredArticles = books.filter(
    (b) =>
      b.kind === "article" &&
      b.finished === finished &&
      [b.title, b.author].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Page title="Articles" subtitle="A quieter home for the web.">
      <Card>
        <Field
          label="Article URL"
          placeholder="https://…"
          value={url}
          onChange={setURL}
        />
        <Button
          title="Save & read"
          icon="add"
          onPress={() => {
            if (url) router.push({ pathname: "/capture", params: { url } });
          }}
        />
      </Card>
      <Field label="Search articles" value={query} onChange={setQuery} />
      <Button
        secondary
        title={finished ? "Show inbox" : "Show finished"}
        onPress={() => setFinished(!finished)}
      />
      {filteredArticles.slice(0, visible).map((b) => (
        <Card key={b.id}>
          {b.cover && (
            <Image
              source={{ uri: b.cover }}
              style={{ width: "100%", height: 150, borderRadius: 12 }}
            />
          )}
          <Label>{b.title}</Label>
          <Label small>
            {b.author} ·{" "}
            {b.hasContent || b.html ? "Saved offline" : "Feed preview"}
          </Label>
          <Button
            title={b.progress ? "Continue reading" : "Read"}
            onPress={() =>
              router.push(
                b.hasContent || b.html || b.readerID
                  ? { pathname: "/reader", params: { id: b.id } }
                  : {
                      pathname: "/capture",
                      params: { url: b.sourceURL!, existing: b.id },
                    },
              )
            }
          />
          <Button
            secondary
            title={b.finished ? "Move to inbox" : "Mark finished"}
            onPress={() => saveProgress(b.id, b.finished ? 0 : 1).catch(report)}
          />
        </Card>
      ))}
      {filteredArticles.length > visible && (
        <Button
          secondary
          title="Show more articles"
          onPress={() => setVisible(visible + 40)}
        />
      )}
      <Card>
        <Label>RSS & Atom</Label>
        <Field
          label="Feed address"
          value={feed}
          onChange={setFeed}
          placeholder="https://…/feed"
        />
        <Button title="Subscribe" onPress={() => follow(feed)} />
        {feeds.map((f) => (
          <Card key={f.url}>
            <Label>{f.title}</Label>
            <Label small>{new Date(f.checked).toLocaleString()}</Label>
            <Button
              secondary
              title="Unsubscribe"
              onPress={async () => {
                await remove("feed", f.url);
                await reload();
              }}
            />
          </Card>
        ))}
      </Card>
      <Card>
        <Label>Discover feeds</Label>
        <Label small>
          Curated independent writing. Follow only the sources you want.
        </Label>
        {suggestions
          .filter(([, u]) => !feeds.some((f) => f.url === u))
          .map(([title, u]) => (
            <Button
              secondary
              key={u}
              title={"Follow " + title}
              onPress={() => follow(u)}
            />
          ))}
      </Card>
    </Page>
  );
}

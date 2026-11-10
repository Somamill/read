import { Cover } from "../../components/Cover";
import { readableFormat } from "../../lib/calibre-model";
import { useState } from "react";
import { View, Alert } from "react-native";
import { router } from "expo-router";
import { useRead } from "../../lib/context";
import { Page, Card, Label, Button, Field } from "../../components/UI";
import { importFile, importBytes } from "../../lib/importer";
import { parseOPDS, CatalogEntry } from "../../lib/parsers";
import { catalogRequest, remoteProgress } from "../../lib/network";
import { Book, mergeProgress } from "../../lib/model";
import * as storage from "../../lib/storage";
export default function Books() {
  const {
    books,
    settings,
    ready,
    saveSettings,
    saveBook,
    saveProgress,
    reload,
    report,
  } = useRead();
  const [visible, setVisible] = useState(40);
  const [query, setQuery] = useState(""),
    [catalog, setCatalog] = useState<CatalogEntry[]>([]),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      report(e);
      Alert.alert("read.", String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  const open = async (b: Book) => {
    if (!b.hasContent && !b.html && !b.uri && !b.calibre && !b.readerID) {
      const imported = await importFile();
      if (!imported) return;
      b = await saveBook({
        ...imported,
        id: b.id,
        title: b.title,
        author: b.author,
        hardcoverID: b.hardcoverID,
      });
    }
    if (b.calibre && !b.hasContent && !b.html && !b.uri) {
      const format = readableFormat(b);
      if (!format)
        throw new Error(
          "Import an EPUB or PDF copy to read this Calibre title here.",
        );
      const r = await catalogRequest(format.url, settings);
      if (Number(r.headers.get("content-length") || 0) > 250 * 1024 * 1024)
        throw new Error("This file exceeds the mobile download limit.");
      const imported = await importBytes(
        new Uint8Array(await r.arrayBuffer()),
        b.title + "." + format.kind,
        format.mime,
      );
      b = await saveBook({
        ...imported,
        id: b.id,
        document: b.document || imported.document,
        title: b.title,
        author: b.author,
        calibre: b.calibre,
        readerID: b.readerID,
        cover: imported.cover || b.cover,
      });
    }
    if (settings.sync && b.document) {
      try {
        const remote = await remoteProgress(b, settings, 1500);
        const pending = (await storage.list<any>("pending")).find(
          (x) => x.document === b.document,
        );
        if (remote && (!pending || remote.timestamp > pending.timestamp)) {
          const value = mergeProgress(pending, remote).percentage;
          await storage.put("book", b.id, {
            ...b,
            progress: value,
            finished: value >= 0.97,
            updated: remote.timestamp * 1000,
          });
          await reload();
        }
      } catch {
        /* local reading remains available offline */
      }
    }
    router.push({ pathname: "/reader", params: { id: b.id } });
  };
  const browse = async (url = settings.opds) => {
    if (!url) throw new Error("Add your Calibre OPDS address in Connections.");
    const r = await catalogRequest(url, settings);
    setCatalog(parseOPDS(await r.text(), r.url || url));
  };
  const filteredBooks = books.filter(
    (b) =>
      b.kind !== "article" &&
      (filter === "all" ||
        (filter === "finished" && b.finished) ||
        (filter === "reading" &&
          (b.progress > 0 || b.trackingStatus === "reading") &&
          !b.finished)) &&
      [b.title, b.author].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Page title="Your books" subtitle="One quiet place to keep reading.">
      {!ready ? (
        <Label>Opening your library…</Label>
      ) : (
        !settings.onboarded && (
          <Card>
            <Label>Welcome to read.</Label>
            <Label small>
              Start with a file from Files or save an article. Connect your own
              Calibre and sync servers when you’re ready.
            </Label>
            <Button
              title="Start reading"
              onPress={() => saveSettings({ ...settings, onboarded: true })}
            />
          </Card>
        )
      )}
      <Button
        title={busy ? "Preparing…" : "Import from Files"}
        disabled={busy}
        icon="add"
        onPress={() =>
          run(async () => {
            const b = await importFile();
            if (b) {
              await open(await saveBook(b));
            }
          })
        }
      />
      <Field label="Search library" value={query} onChange={setQuery} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["all", "reading", "finished"].map((f) => (
          <Button
            key={f}
            title={f[0].toUpperCase() + f.slice(1)}
            secondary={filter !== f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
      {filteredBooks.slice(0, visible).map((b) => (
        <Card key={b.id}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Cover book={b} />
            <View style={{ flex: 1, gap: 7 }}>
              <Label>{b.title}</Label>
              <Label small>{b.author}</Label>
              <Label small>
                {b.finished
                  ? "Finished"
                  : b.progressKnown === false
                    ? "Reading on Hardcover"
                    : Math.round(b.progress * 100) + "% read"}{" "}
                ·{" "}
                {b.hasContent || b.uri
                  ? "Available offline"
                  : b.calibre
                    ? "In Calibre"
                    : "Connected title"}
              </Label>
            </View>
          </View>
          <Button
            title={
              !b.hasContent &&
              !b.uri &&
              (!b.calibre || !readableFormat(b)) &&
              !b.readerID
                ? "Add a readable copy"
                : b.progress
                  ? "Continue reading"
                  : "Read"
            }
            onPress={() => run(() => open(b))}
          />
          <Button
            secondary
            title={b.finished ? "Mark as reading" : "Mark finished"}
            onPress={() => saveProgress(b.id, b.finished ? 0 : 1).catch(report)}
          />
        </Card>
      ))}
      {filteredBooks.length > visible && (
        <Button
          secondary
          title="Show more books"
          onPress={() => setVisible(visible + 40)}
        />
      )}
      {!books.some((x) => x.kind !== "article") && (
        <Card>
          <Label>Your next book belongs here.</Label>
          <Label small>
            Import an EPUB, PDF or audiobook from iCloud Drive, OneDrive, Google
            Drive or any Files provider installed on your phone.
          </Label>
        </Card>
      )}
      <Button
        secondary
        title="Browse Calibre OPDS"
        disabled={busy}
        onPress={() => run(() => browse())}
      />
      {catalog.map((e) => (
        <Card key={e.id}>
          <Label>{e.title}</Label>
          <Label small>{e.author}</Label>
          <Button
            title={e.download ? "Download to library" : "Browse"}
            onPress={() =>
              run(async () => {
                if (e.download) {
                  const response = await catalogRequest(e.download, settings);
                  const bytes = new Uint8Array(await response.arrayBuffer());
                  const b = await importBytes(
                    bytes,
                    e.title +
                      (e.type?.includes("epub")
                        ? ".epub"
                        : e.type?.includes("pdf")
                          ? ".pdf"
                          : ".m4b"),
                    e.type,
                  );
                  await open(await saveBook(b));
                } else if (e.navigation) await browse(e.navigation);
              })
            }
          />
        </Card>
      ))}
    </Page>
  );
}

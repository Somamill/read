import { syncHardcover } from "./hardcover-sync";
import { syncCalibre } from "./calibre";
import { linkedBook } from "./matching";
import { queueReader, syncReader } from "./readwise";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { AppState, useColorScheme } from "react-native";
import {
  Book,
  Feed,
  Highlight,
  Settings,
  defaults,
  progress,
  uid,
} from "./model";
import * as storage from "./storage";
import { flush, pullProgress, queueProgress } from "./network";
type State = {
  books: Book[];
  highlights: Highlight[];
  feeds: Feed[];
  settings: Settings;
  ready: boolean;
  dark: boolean;
  error: string;
  reload: () => Promise<void>;
  saveBook: (b: Book) => Promise<Book>;
  saveSettings: (s: Settings) => Promise<void>;
  saveProgress: (id: string, p: number) => Promise<void>;
  addHighlight: (b: Book, text: string) => Promise<void>;
  report: (e: unknown) => void;
};
const Context = createContext<State>(null!);
export const useRead = () => useContext(Context);
export function ReadProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]),
    [highlights, setHighlights] = useState<Highlight[]>([]),
    [feeds, setFeeds] = useState<Feed[]>([]),
    [settings, setSettings] = useState(defaults),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const system = useColorScheme();
  const report = useCallback(
    (e: unknown) =>
      setError(
        String(e instanceof Error ? e.message : e).replace(
          /Token\s+\S+|Bearer\s+\S+/g,
          "[redacted]",
        ),
      ),
    [],
  );
  const reload = useCallback(async () => {
    const x = await storage.snapshot();
    setBooks(x.books.sort((a, b) => b.updated - a.updated));
    setHighlights(x.highlights.sort((a, b) => b.created - a.created));
    setFeeds(x.feeds);
    setSettings((old) =>
      JSON.stringify(old) === JSON.stringify(x.settings) ? old : x.settings,
    );
    setReady(true);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => reload().catch(report), 0);
    return () => clearTimeout(timer);
  }, [reload, report]);
  useEffect(() => {
    if (
      !ready ||
      (!settings.sync &&
        !settings.readerSync &&
        !settings.opds &&
        !settings.onboarded)
    )
      return;
    let running = false,
      active = true;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const errors: string[] = [];
        try {
          await syncCalibre(settings);
        } catch (e) {
          errors.push(
            "Calibre: cached books remain available; " + (e as Error).message,
          );
        }
        try {
          await flush(settings);
          const changes = await pullProgress(settings);
          for (const changed of changes) await queueReader(changed, settings);
        } catch (e) {
          errors.push("KOReader: " + (e as Error).message);
        }
        try {
          await syncReader(settings);
        } catch (e) {
          errors.push("Readwise Reader: " + (e as Error).message);
        }
        try {
          await syncHardcover();
        } catch (e) {
          errors.push("Hardcover: " + (e as Error).message);
        }
        if (active) {
          await reload();
          if (errors.length) report("Progress sync: " + errors.join(" · "));
          else setError((old) => (old.startsWith("Progress sync:") ? "" : old));
        }
      } catch (e) {
        if (active) report("Progress sync: " + (e as Error).message);
      } finally {
        running = false;
      }
    };
    sync();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") sync();
    }, 60000);
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") sync();
    });
    return () => {
      active = false;
      clearInterval(timer);
      listener.remove();
    };
  }, [ready, settings, report, reload]);
  const saveBook = useCallback(
    async (b: Book) => {
      // Reimporting an identical file refreshes its content, preserving its reading history.
      const all = await storage.list<Book>("book");
      const stored = linkedBook(b, all);
      await storage.put("book", stored.id, stored);
      await reload();
      return stored;
    },
    [reload],
  );
  const saveSettings = useCallback(async (s: Settings) => {
    await storage.put("settings", "profile", s);
    setSettings(s);
  }, []);
  const writes = useRef(Promise.resolve());
  const saveProgress = useCallback(
    (id: string, p: number) => {
      const operation = writes.current
        .catch(() => {})
        .then(async () => {
          const b = (await storage.list<Book>("book")).find((x) => x.id === id);
          if (!b) return;
          const value = progress(p),
            updated = {
              ...b,
              progress: value,
              finished: value >= 0.97,
              progressKnown: true,
              progressUpdated: Date.now(),
              trackingStatus:
                value >= 0.97 ? ("finished" as const) : ("reading" as const),
              updated: Date.now(),
            };
          await storage.put("book", id, updated);
          await queueProgress(updated, settings);
          await queueReader(updated, settings);
          setBooks((old) => old.map((x) => (x.id === id ? updated : x)));
        });
      writes.current = operation;
      return operation;
    },
    [settings],
  );
  const addHighlight = useCallback(
    async (b: Book, text: string) => {
      const normalized = text.trim();
      if (!normalized) return;
      const existing = await storage.list<Highlight>("highlight");
      if (existing.some((h) => h.bookId === b.id && h.text === normalized))
        return;
      const h: Highlight = {
        id: uid(),
        bookId: b.id,
        title: b.title,
        category: b.kind === "article" ? "articles" : "books",
        text: normalized,
        note: "",
        created: Date.now(),
      };
      await storage.put("highlight", h.id, h);
      await reload();
    },
    [reload],
  );
  return (
    <Context.Provider
      value={{
        books,
        highlights,
        feeds,
        settings,
        ready,
        dark:
          settings.theme === "black" ||
          (settings.theme === "system" && system === "dark"),
        error,
        reload,
        saveBook,
        saveSettings,
        saveProgress,
        addHighlight,
        report,
      }}
    >
      {children}
    </Context.Provider>
  );
}

import { content as storedContent } from "../lib/storage";
import { loadReaderContent } from "../lib/readwise";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  Pressable,
  Alert,
  ScrollView,
  Modal,
  Animated,
} from "react-native";
import { WebView } from "react-native-webview";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { useRead } from "../lib/context";
import { readerHTML } from "../lib/reader";
import { Label, Button, usePalette } from "../components/UI";
import { AudioReader } from "../components/AudioReader";

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    books,
    highlights,
    settings,
    saveSettings,
    saveBook,
    saveProgress,
    addHighlight,
    dark,
    report,
  } = useRead();
  const p = usePalette(),
    book = books.find((b) => b.id === id),
    web = useRef<WebView<object>>(null);
  const [loadError, setLoadError] = useState(""),
    [loaded, setLoaded] = useState<{ id: string; html: string } | undefined>();
  const [page, setPage] = useState(""),
    [contents, setContents] = useState(false),
    [appearance, setAppearance] = useState(false),
    [chrome, setChrome] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useCallback(() => {
    setChrome(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setChrome(false);
      });
    }, 4500);
  }, [opacity]);
  useEffect(() => {
    const startTimer = setTimeout(wake, 0);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer.current);
      Speech.stop();
    };
  }, [id, wake]);
  // Content is rebuilt only for presentation changes, not for every progress update.
  // Rebuild from the latest position when the user changes font, theme or layout.
  // Keep this WebView document stable while progress is reported. Rebuild on
  // presentation/content changes using the latest saved position and highlights.
  /* eslint-disable react-hooks/exhaustive-deps -- progress updates must not reload the WebView */
  const html = useMemo(
    () =>
      book
        ? readerHTML(
            { ...book, html: loaded?.id === id ? loaded.html : book.html },
            settings,
            dark,
            highlights.filter((h) => h.bookId === id).map((h) => h.text),
          )
        : "",
    [id, book?.html, loaded, settings, dark],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!book || book.uri || loaded?.id === book.id) return;
    let active = true;
    (async () => {
      let html = book.html || (await storedContent(book.id));
      if (!html && book.readerID) {
        const remote = await loadReaderContent(book);
        html = remote.html;
        await saveBook(remote);
      }
      if (!html)
        throw new Error("Import an EPUB from Files to read this title.");
      if (active) setLoaded({ id: book.id, html });
    })().catch((e) => {
      if (active) {
        setLoadError((e as Error).message);
        report(e);
      }
    });
    return () => {
      active = false;
    };
  }, [book, loaded, saveBook, report]);
  if (!book)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, padding: 24 }}>
        <Label>Opening your book…</Label>
        <Button title="Library" onPress={() => router.back()} />
      </SafeAreaView>
    );
  const toolbar: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    action: () => void;
  }[] = [
    {
      icon: "chevron-back",
      label: "Previous page",
      action: () => web.current?.injectJavaScript("window.movePage(-1);true;"),
    },
    ...(book.chapters.length
      ? [
          {
            icon: "list" as const,
            label: "Contents",
            action: () => setContents(true),
          },
        ]
      : []),
    {
      icon: "text",
      label: "Reading appearance",
      action: () => setAppearance(true),
    },
    {
      icon: "volume-medium",
      label: "Read aloud",
      action: () => {
        Speech.isSpeakingAsync()
          .then((active) =>
            active
              ? Speech.stop()
              : Speech.speak(
                  (loaded?.html || book.html || "")
                    .replace(/<[^>]+>/g, " ")
                    .slice(0, 15000),
                ),
          )
          .catch(report);
      },
    },
    {
      icon: "chevron-forward",
      label: "Next page",
      action: () => web.current?.injectJavaScript("window.movePage(1);true;"),
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 18,
          paddingVertical: 6,
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to library"
          onPress={() => router.back()}
          style={{ padding: 10, minWidth: 44, minHeight: 44 }}
        >
          <Ionicons name="chevron-back" size={25} color={p.blue} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: p.ink, fontSize: 16, fontWeight: "600" }}
        >
          {book.title}
        </Text>
      </View>
      {book.kind === "audio" ? (
        <AudioReader book={book} />
      ) : book.kind === "pdf" ? (
        <View style={{ padding: 22, gap: 18 }}>
          <Label>PDF document</Label>
          <Label small>
            Open the original PDF using iOS Preview. Native PDF annotations
            belong to that viewer, separately from read.’s EPUB/article
            highlights.
          </Label>
          <Button
            title="Open PDF"
            onPress={async () => {
              try {
                const file = new File(book.uri!);
                try {
                  if (
                    typeof file.canPreview === "function" &&
                    (await file.canPreview())
                  ) {
                    await file.preview();
                    return;
                  }
                } catch {
                  /* The system share sheet also works on older Expo Go clients. */
                }
                await Sharing.shareAsync(file.uri);
              } catch (e) {
                report(e);
                Alert.alert("PDF", String(e));
              }
            }}
          />
          <Button
            secondary
            title="Set reading progress"
            onPress={() =>
              Alert.prompt(
                "PDF progress",
                "Percentage read",
                (value) => {
                  const n = Number(value);
                  if (Number.isFinite(n) && n >= 0 && n <= 100)
                    saveProgress(book.id, n / 100).catch(report);
                },
                "plain-text",
                String(Math.round(book.progress * 100)),
                "number-pad",
              )
            }
          />
        </View>
      ) : !((loaded?.id === book.id && loaded.html) || book.html) ? (
        <View style={{ padding: 24, gap: 18 }}>
          {!loadError && <ActivityIndicator />}
          <Label>{loadError || "Preparing readable text…"}</Label>
          <Label small>
            Import your own EPUB or PDF from Files if this service cannot
            provide its text.
          </Label>
        </View>
      ) : (
        <View style={{ flex: 1 }} onTouchStart={wake}>
          <WebView<object>
            ref={web}
            source={{ html }}
            style={{ flex: 1, backgroundColor: p.bg }}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(r) =>
              r.url === "about:blank" || r.url.startsWith("data:")
            }
            onMessage={async (e) => {
              try {
                const m = JSON.parse(e.nativeEvent.data);
                if (m.type === "position") {
                  setPage(`${m.page} / ${m.pages}`);
                  if (m.user) await saveProgress(book.id, m.percentage);
                }
                if (m.type === "highlight") {
                  await addHighlight(book, m.text);
                }
                if (m.type === "link")
                  Alert.alert(
                    "Open in read.",
                    "Save this linked article to read here?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Save & read",
                        onPress: () =>
                          router.push({
                            pathname: "/capture",
                            params: { url: m.url },
                          }),
                      },
                    ],
                  );
              } catch (e) {
                report(e);
              }
            }}
          />
        </View>
      )}
      {(!!book.html || loaded?.id === book.id) && (
        <Animated.View
          pointerEvents={chrome ? "auto" : "none"}
          style={{
            opacity,
            position: "absolute",
            bottom: 28,
            left: 16,
            right: 16,
            borderRadius: 26,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: p.line,
          }}
        >
          <BlurView
            intensity={65}
            tint={dark ? "dark" : "light"}
            style={{
              padding: 8,
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              backgroundColor: dark ? "#10101055" : "#ffffff66",
            }}
          >
            {/* Action closures below read WebView refs only when pressed, never during render. */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {toolbar.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => {
                  wake();
                  item.action();
                }}
                style={{ padding: 10, minWidth: 44, minHeight: 44 }}
              >
                <Ionicons name={item.icon} size={22} color={p.ink} />
              </Pressable>
            ))}
            <Text style={{ fontSize: 11, color: p.muted }}>{page}</Text>
          </BlurView>
        </Animated.View>
      )}
      <Modal
        visible={contents || appearance}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setContents(false);
          setAppearance(false);
        }}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: p.bg, padding: 22, gap: 18 }}
        >
          <Button
            secondary
            title="Done"
            onPress={() => {
              setContents(false);
              setAppearance(false);
              wake();
            }}
          />
          {appearance ? (
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <Label>Reading appearance</Label>
              <Button
                title="Larger text"
                onPress={() =>
                  saveSettings({
                    ...settings,
                    fontSize: Math.min(32, settings.fontSize + 2),
                  })
                }
              />
              <Button
                secondary
                title="Smaller text"
                onPress={() =>
                  saveSettings({
                    ...settings,
                    fontSize: Math.max(14, settings.fontSize - 2),
                  })
                }
              />
              <Button
                secondary
                title={
                  settings.layout === "pages"
                    ? "Switch to continuous scroll"
                    : "Switch to paged reading"
                }
                onPress={() =>
                  saveSettings({
                    ...settings,
                    layout: settings.layout === "pages" ? "scroll" : "pages",
                  })
                }
              />
              {(["system", "black", "bright"] as const).map((theme) => (
                <Button
                  secondary
                  key={theme}
                  title={
                    theme === "black"
                      ? "Black (OLED)"
                      : theme[0].toUpperCase() + theme.slice(1)
                  }
                  onPress={() => saveSettings({ ...settings, theme })}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10 }}>
              <Label>Contents</Label>
              {book.chapters.map((ch) => (
                <Button
                  secondary
                  key={ch.id}
                  title={ch.title}
                  onPress={() => {
                    web.current?.injectJavaScript(
                      "window.goChapter(" + JSON.stringify(ch.id) + ");true;",
                    );
                    setContents(false);
                  }}
                />
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

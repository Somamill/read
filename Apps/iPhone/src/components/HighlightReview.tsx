import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View, Share } from "react-native";
import { router } from "expo-router";
import { useRead } from "../lib/context";
import { Highlight } from "../lib/model";
import { list, put } from "../lib/storage";
import { reviewQueue, reviewedHighlight } from "../lib/review";
import { Card, Label, Button, usePalette } from "./UI";

export function HighlightReview() {
  const { highlights, books, settings, saveSettings, reload, report } =
    useRead();
  const p = usePalette();
  const [time, setTime] = useState(Date.now),
    [offset, setOffset] = useState(0),
    [revealed, setRevealed] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const queue = useMemo(
    () => reviewQueue(highlights, settings.reviewSize, time),
    [highlights, settings.reviewSize, time],
  );
  const h = queue.cards[offset % Math.max(1, queue.cards.length)];
  const source = books.find((b) => b.id === h?.bookId);
  const review = async (days: number) => {
    if (!h || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      // Read the current record so a simultaneous note edit cannot be overwritten.
      const current = (await list<Highlight>("highlight")).find(
        (x) => x.id === h.id,
      );
      if (current)
        await put("highlight", h.id, reviewedHighlight(current, days));
      await reload();
      setTime(Date.now());
      setOffset(0);
      setRevealed("");
    } catch (e) {
      report(e);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Card>
        <Label>
          {Math.min(queue.reviewed, queue.goal)} of {queue.goal} reviewed today
        </Label>
        <View
          accessible
          accessibilityLabel={`${Math.min(queue.reviewed, queue.goal)} of ${queue.goal} passages reviewed`}
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: p.line,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 5,
              width: `${Math.min(100, (queue.reviewed / queue.goal) * 100)}%`,
              backgroundColor: p.blue,
            }}
          />
        </View>
        <Label small>
          Saved on this device. Review offline, without a subscription.
        </Label>
      </Card>
      {h ? (
        <Card key={h.id}>
          <Label small>
            {h.category === "articles" ? "ARTICLE" : "BOOK"}
            {h.source ? ` · ${h.source}` : ""}
          </Label>
          <Text
            selectable
            style={{ fontSize: 25, lineHeight: 36, color: p.ink }}
          >
            “{h.text}”
          </Text>
          <Label>{h.title}</Label>
          {!!h.author && <Label small>{h.author}</Label>}
          {!!h.note &&
            (revealed === h.id ? (
              <Label>{h.note}</Label>
            ) : (
              <Button
                title="Reveal your note"
                secondary
                icon="document-text-outline"
                onPress={() => setRevealed(h.id)}
              />
            ))}
          <Button
            title="Next week"
            icon="checkmark-outline"
            disabled={busy}
            onPress={() => review(7)}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              title="Tomorrow"
              secondary
              disabled={busy}
              onPress={() => review(1)}
            />
            <Button
              title="In a month"
              secondary
              disabled={busy}
              onPress={() => review(30)}
            />
          </View>
          <Button
            title="Skip for now"
            secondary
            icon="arrow-forward-outline"
            disabled={busy || queue.cards.length < 2}
            onPress={() => {
              setOffset(offset + 1);
              setRevealed("");
            }}
          />
          {source && (source.hasContent || source.uri || source.readerID) && (
            <Button
              title="Open source"
              secondary
              icon="book-outline"
              onPress={() =>
                router.push({ pathname: "/reader", params: { id: source.id } })
              }
            />
          )}
          <Button
            title="Share passage"
            secondary
            icon="share-outline"
            onPress={() => {
              Share.share({
                message: `${h.title}\n\n“${h.text}”\n\n${h.note}`,
              }).catch(report);
            }}
          />
        </Card>
      ) : (
        <Card>
          <Label>
            {queue.reviewed >= queue.goal
              ? "Today’s review is complete."
              : queue.total
                ? "You’re up to date."
                : "Your review starts with a highlight."}
          </Label>
          <Label small>
            {queue.total
              ? "Your passages will return on their scheduled day. You can change your daily goal below."
              : "Highlight a passage in a book or article, or connect your Mac to bring saved highlights here."}
          </Label>
        </Card>
      )}
      <Card>
        <Label small>DAILY GOAL</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[3, 5, 10].map((size) => (
            <Button
              key={size}
              title={`${size} passages`}
              secondary={queue.goal !== size}
              onPress={() => {
                saveSettings({ ...settings, reviewSize: size }).catch(report);
              }}
            />
          ))}
        </View>
        <Label small>
          Tomorrow, next week and next month use your device’s local calendar.
          Skipping does not mark a passage reviewed.
        </Label>
      </Card>
    </>
  );
}

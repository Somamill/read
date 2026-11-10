import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Book } from "../lib/model";
import { Card, Label, Button } from "./UI";
import { useRead } from "../lib/context";
export function AudioReader({ book }: { book: Book }) {
  const player = useAudioPlayer(book.uri || null),
    status = useAudioPlayerStatus(player),
    { saveProgress, report } = useRead();
  const restored = useRef(false),
    last = useRef(0),
    finished = useRef(false);
  useEffect(() => {
    if (status.isLoaded && !restored.current && status.duration > 0) {
      player.seekTo(book.progress * status.duration).catch(report);
      restored.current = true;
    }
    if (status.didJustFinish && !finished.current) {
      finished.current = true;
      saveProgress(book.id, 1).catch(report);
    }
    if (
      status.playing &&
      status.duration &&
      Date.now() - last.current > 10000
    ) {
      last.current = Date.now();
      saveProgress(book.id, status.currentTime / status.duration).catch(report);
    }
  }, [
    status.currentTime,
    status.isLoaded,
    status.duration,
    status.playing,
    status.didJustFinish,
    book.id,
    book.progress,
    player,
    saveProgress,
    report,
  ]);
  const run = async (action: () => void | Promise<void>) => {
    try {
      await action();
    } catch (e) {
      report(e);
      Alert.alert("Audio playback", (e as Error).message);
    }
  };
  return (
    <Card>
      <Label>{book.title}</Label>
      <Label small>
        {status.isLoaded
          ? `${Math.floor(status.currentTime / 60)} / ${Math.floor(status.duration / 60)} min`
          : "Preparing audio…"}
      </Label>
      <Button
        title={status.playing ? "Pause" : "Play"}
        disabled={!status.isLoaded}
        onPress={() =>
          run(async () => {
            if (status.playing) player.pause();
            else player.play();
            if (status.duration)
              await saveProgress(book.id, status.currentTime / status.duration);
          })
        }
      />
      <Button
        secondary
        title="Back 30 seconds"
        onPress={() =>
          run(() => player.seekTo(Math.max(0, status.currentTime - 30)))
        }
      />
      <Button
        secondary
        title="Forward 30 seconds"
        onPress={() =>
          run(() =>
            player.seekTo(Math.min(status.duration, status.currentTime + 30)),
          )
        }
      />
    </Card>
  );
}

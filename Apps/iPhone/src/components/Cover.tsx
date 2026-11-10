import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { md5 } from "js-md5";
import { Book } from "../lib/model";
import { useRead } from "../lib/context";
import { catalogRequest } from "../lib/network";
import { Label, usePalette } from "./UI";
let active = 0;
const waiting: (() => void)[] = [];
async function slot() {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  return () => {
    active--;
    waiting.shift()?.();
  };
}
export function Cover({ book }: { book: Book }) {
  const { settings } = useRead(),
    p = usePalette(),
    [uri, setURI] = useState<string>();
  useEffect(() => {
    let current = true;
    (async () => {
      if (!book.cover) return;
      if (!book.calibre || !/^https?:/.test(book.cover)) {
        if (current) setURI(book.cover);
        return;
      }
      const file = new File(
        Paths.cache,
        "read-cover-" + md5(book.cover) + ".jpg",
      );
      if (file.exists) {
        if (current) setURI(file.uri);
        return;
      }
      const release = await slot();
      try {
        if (!current) return;
        const r = await catalogRequest(book.cover, settings);
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes.length > 2 * 1024 * 1024) return;
        await file.write(bytes);
        if (current) setURI(file.uri);
      } finally {
        release();
      }
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [book.cover, book.calibre, settings]);
  return uri ? (
    <Image
      accessibilityLabel={"Cover of " + book.title}
      source={{ uri }}
      style={{ width: 78, height: 112, borderRadius: 9 }}
    />
  ) : (
    <View
      style={{
        width: 78,
        height: 112,
        borderRadius: 9,
        backgroundColor: p.bg,
        justifyContent: "center",
        padding: 8,
      }}
    >
      <Label small>{book.kind.toUpperCase()}</Label>
    </View>
  );
}

import { toByteArray } from "base64-js";
import { File, Paths } from "expo-file-system";
import * as Picker from "expo-document-picker";
import { Book, uid } from "./model";
import { parseEPUB } from "./parsers";
export async function importFile(): Promise<Book | undefined> {
  const result = await Picker.getDocumentAsync({
    type: [
      "application/epub+zip",
      "application/pdf",
      "audio/*",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  const epub =
    /\.epub$/i.test(asset.name) || asset.mimeType === "application/epub+zip";
  if ((asset.size || 0) > (epub ? 32 : 250) * 1024 * 1024)
    throw new Error(
      epub ? "EPUB limit is 32 MB." : "Media import limit is 250 MB.",
    );
  if (!epub) {
    if (
      !/\.(pdf|m4b|m4a|mp3|aac|wav|ogg|flac)$/i.test(asset.name) &&
      asset.mimeType !== "application/pdf" &&
      !asset.mimeType?.startsWith("audio/")
    )
      throw new Error("Choose an EPUB, PDF or supported audio file.");
    const file = new File(
      Paths.document,
      uid() + asset.name.replace(/[^a-z0-9.]/gi, "_"),
    );
    await new File(asset.uri).copy(file);
    const now = Date.now();
    return {
      id: uid(),
      title: asset.name.replace(/\.[^.]+$/, ""),
      author: "",
      kind:
        /\.pdf$/i.test(asset.name) || asset.mimeType === "application/pdf"
          ? "pdf"
          : "audio",
      uri: file.uri,
      chapters: [],
      progress: 0,
      finished: false,
      added: now,
      updated: now,
    };
  }
  return importBytes(
    await new File(asset.uri).bytes(),
    asset.name,
    asset.mimeType,
  );
}
export async function importBytes(
  bytes: Uint8Array,
  name: string,
  type?: string,
): Promise<Book> {
  const now = Date.now();
  let data: Partial<Book>;
  if (/\.epub$/i.test(name) || type === "application/epub+zip")
    data = await parseEPUB(bytes);
  else {
    if (
      !/\.(pdf|m4b|m4a|mp3|aac|wav|ogg|flac)$/i.test(name) &&
      type !== "application/pdf" &&
      !type?.startsWith("audio/")
    )
      throw new Error("Choose an EPUB, PDF or supported audio file.");
    if (bytes.length > 250 * 1024 * 1024)
      throw new Error("Media import limit is 250 MB.");
    const kind =
      /\.pdf$/i.test(name) || type === "application/pdf" ? "pdf" : "audio";
    const file = new File(
      Paths.document,
      uid() + name.replace(/[^a-z0-9.]/gi, "_"),
    );
    await file.write(bytes);
    data = {
      uri: file.uri,
      kind,
      title: name.replace(/\.[^.]+$/, ""),
      author: "",
      chapters: [],
    };
  }
  if (data.cover?.startsWith("data:image/")) {
    const file = new File(
      Paths.document,
      "cover-" +
        (data.document || uid()) +
        (data.cover.startsWith("data:image/png")
          ? ".png"
          : data.cover.startsWith("data:image/gif")
            ? ".gif"
            : data.cover.startsWith("data:image/webp")
              ? ".webp"
              : ".jpg"),
    );
    await file.write(toByteArray(data.cover.split(",")[1]));
    data.cover = file.uri;
  }
  return {
    id: data.document || uid(),
    title: data.title || name,
    author: "",
    kind: "epub",
    chapters: [],
    progress: 0,
    finished: false,
    added: now,
    updated: now,
    ...data,
  };
}

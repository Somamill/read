import { md5 } from "js-md5";
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  randomUUID,
} from "expo-crypto";
import { Settings, Book, Highlight } from "./model";
import { macHighlightImporter } from "./highlight-import";
import {
  setupLink,
  decode64,
  standard64,
  validateProfile,
} from "./pairing-model";
import { request } from "./network";
import { list, putSetupRecords, secret, setSecret } from "./storage";
import { calibreBook, mergeCalibre } from "./calibre-model";
import { sameBook } from "./matching";
export async function importMacSetup(
  raw: string,
  current: Settings,
  onProgress: (step: string) => void = () => {},
) {
  const link = setupLink(raw);
  if (!link)
    throw new Error("Paste the complete private setup link from your Mac.");
  onProgress("Opening secure device storage…");
  let device = await secret("pairingDevice");
  if (!device) {
    device = randomUUID();
    await setSecret("pairingDevice", device);
  }
  const headers = {
    Authorization: "Bearer " + link.token,
    "Content-Type": "application/json",
  };
  onProgress("Downloading encrypted setup…");
  const r = await request(link.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ device }),
  });
  onProgress("Receiving your encrypted library…");
  const sealed = await r.json();
  if (
    sealed.version !== 1 ||
    sealed.expiresAt < Date.now() ||
    typeof sealed.data !== "string" ||
    sealed.data.length > 12 * 1024 * 1024
  )
    throw new Error(
      "This setup link has expired. Generate a fresh one on the Mac.",
    );
  onProgress("Decrypting your library on this iPhone…");
  const key = await AESEncryptionKey.import(standard64(link.key), "base64");
  const data = AESSealedData.fromParts(
    standard64(sealed.nonce),
    standard64(sealed.data),
    16,
  );
  // Base64 strings avoid transferring millions of individual bytes through the native bridge.
  const clear = await aesDecryptAsync(data, key, { output: "base64" });
  const bytes = decode64(clear);
  const profile = validateProfile(JSON.parse(new TextDecoder().decode(bytes)));
  onProgress("Preparing your Calibre books…");
  let books = await list<Book>("book");
  const records: { kind: string; id: string; value: unknown }[] = [];
  for (const row of profile.catalog.records) {
    const incoming = calibreBook(
      String(row.id),
      row.metadata,
      profile.catalog.base,
    );
    const matching = books.filter(
      (b) => b.kind !== "article" && sameBook(b, incoming),
    );
    const prior =
      books.find((b) => b.id === incoming.id) ||
      (matching.length === 1 ? matching[0] : undefined);
    const b = mergeCalibre(incoming, prior);
    records.push({ kind: "book", id: b.id, value: b });
    books = books.filter((x) => x.id !== b.id).concat(b);
  }
  const cursor = md5(profile.catalog.base);
  records.push({
    kind: "calibreCursor",
    id: cursor,
    value: { id: cursor, checked: Date.now() },
  });
  onProgress("Preparing your highlights and review history…");
  const existing = await list<Highlight>("highlight");
  const mergeHighlight = macHighlightImporter(books, existing);
  const highlights = new Map(existing.map((h) => [h.id, h]));
  for (const raw of profile.highlights || []) {
    const h = mergeHighlight(raw);
    records.push({ kind: "highlight", id: h.id, value: h });
    highlights.set(h.id, h);
  }
  const settings = { ...current, ...profile.settings };
  records.push({ kind: "settings", id: "profile", value: settings });
  onProgress("Saving your service credentials securely…");
  // Replace service credentials together, never carry an old password to a new host.
  for (const name of [
    "opdsUser",
    "opdsPassword",
    "syncPassword",
    "syncKey",
    "readwise",
    "hardcover",
  ])
    await setSecret(name, String(profile.secrets[name] || ""));
  onProgress(`Saving ${books.length} books and ${highlights.size} highlights…`);
  await putSetupRecords(records);
  onProgress("Confirming the connection…");
  await request(link.endpoint + "/confirm", {
    method: "POST",
    headers,
    body: JSON.stringify({ device }),
  }).catch(() => {});
  return {
    settings,
    count: books.filter((b) => b.calibre?.base === profile.catalog.base).length,
    services: profile.services || [],
    highlights: highlights.size,
  };
}

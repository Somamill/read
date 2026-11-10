import { md5 } from "js-md5";
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  randomUUID,
} from "expo-crypto";
import { Settings, Book } from "./model";
import { setupLink, decode64, validateProfile } from "./pairing-model";
import { request } from "./network";
import { list, put, secret, setSecret } from "./storage";
import { calibreBook, mergeCalibre } from "./calibre-model";
import { sameBook } from "./matching";
export async function importMacSetup(raw: string, current: Settings) {
  const link = setupLink(raw);
  if (!link)
    throw new Error("Paste the complete private setup link from your Mac.");
  let device = await secret("pairingDevice");
  if (!device) {
    device = randomUUID();
    await setSecret("pairingDevice", device);
  }
  const headers = {
    Authorization: "Bearer " + link.token,
    "Content-Type": "application/json",
  };
  const r = await request(link.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ device }),
  });
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
  const key = await AESEncryptionKey.import(decode64(link.key));
  const data = AESSealedData.fromParts(
    decode64(sealed.nonce),
    decode64(sealed.data),
    16,
  );
  const bytes = await aesDecryptAsync(data, key);
  const profile = validateProfile(JSON.parse(new TextDecoder().decode(bytes)));
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
  let books = await list<Book>("book");
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
    await put("book", b.id, b);
    books = books.filter((x) => x.id !== b.id).concat(b);
  }
  await put("calibreCursor", md5(profile.catalog.base), {
    id: md5(profile.catalog.base),
    checked: Date.now(),
  });
  const settings = { ...current, ...profile.settings };
  await put("settings", "profile", settings);
  await request(link.endpoint + "/confirm", {
    method: "POST",
    headers,
    body: JSON.stringify({ device }),
  }).catch(() => {});
  return {
    settings,
    count: books.filter((b) => b.calibre?.base === profile.catalog.base).length,
    services: profile.services || [],
  };
}

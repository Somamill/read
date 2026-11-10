import { createServer } from "node:http";
import { createCipheriv, randomBytes, timingSafeEqual } from "node:crypto";
export function sealProfile(
  profile,
  {
    key = randomBytes(32),
    nonce = randomBytes(12),
    expiresAt = Date.now() + 30 * 60_000,
  } = {},
) {
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const data = Buffer.concat([
    cipher.update(JSON.stringify({ ...profile, expiresAt })),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    key,
    envelope: {
      version: 1,
      expiresAt,
      nonce: nonce.toString("base64url"),
      data: data.toString("base64url"),
    },
  };
}
export function createPairServer({ envelope, grant, onConfirm = () => {} }) {
  let client;
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    const expected = Buffer.from("Bearer " + grant),
      actual = Buffer.from(req.headers.authorization || "");
    if (
      req.method !== "POST" ||
      !["/pair", "/pair/confirm"].includes(req.url) ||
      Date.now() > envelope.expiresAt ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) {
        res.writeHead(413).end();
        return;
      }
    }
    let id;
    try {
      id = JSON.parse(body).device;
      if (typeof id !== "string" || !/^[a-f0-9-]{20,64}$/i.test(id))
        throw Error();
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (client && client !== id) {
      res.writeHead(409).end();
      return;
    }
    client = id;
    if (req.url === "/pair/confirm") {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end('{"ok":true}');
      onConfirm();
      return;
    }
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(envelope));
  });
}

import { sealProfile, createPairServer } from "./pairing-transport.mjs";
// Temporary end-to-end encrypted pairing. No profile or token is bundled into the app.
import { createDecipheriv, createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
const script = path.dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(
  execFileSync("python3", [path.join(script, "export-mac-profile.py")], {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  }),
);
const rawKey = profile._connectorKey || "";
let connectorKey;
if (/^[a-f0-9]{64}$/i.test(rawKey)) connectorKey = Buffer.from(rawKey, "hex");
else if (rawKey) {
  const bytes = Buffer.from(rawKey, "base64");
  connectorKey =
    bytes.length === 32 ? bytes : createHash("sha256").update(rawKey).digest();
}
for (const [name, encoded] of Object.entries(profile._encrypted || {}))
  if (connectorKey) {
    try {
      const bytes = Buffer.from(encoded, "base64");
      if (bytes[0] !== 1) continue;
      const decipher = createDecipheriv(
        "aes-256-gcm",
        connectorKey,
        bytes.subarray(1, 13),
      );
      decipher.setAuthTag(bytes.subarray(13, 29));
      const credential = JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(29)),
          decipher.final(),
        ]).toString(),
      );
      // OAuth refresh tokens stay on their server, avoiding rotation conflicts between clients.
      if (name === "hardcover" && credential.token) {
        profile.secrets.hardcover = credential.token;
        profile.services.push("Hardcover");
      }
      if (
        (name === "readwise" || name === "readwise-reader") &&
        credential.token &&
        !profile.secrets.readwise
      ) {
        profile.secrets.readwise = credential.token;
        profile.services.push("Readwise Reader");
      }
    } catch {
      console.error(
        "A connector credential could not be exported; its server-side connection was left unchanged.",
      );
    }
  }
delete profile._connectorKey;
delete profile._encrypted;
const key = randomBytes(32),
  iv = randomBytes(12),
  grant = randomBytes(32).toString("base64url"),
  expiresAt = Date.now() + 30 * 60_000;
const { envelope } = sealProfile(profile, { key, nonce: iv, expiresAt });
let cloud;
let finished = false;
const finish = () => {
  if (finished) return;
  finished = true;
  cloud?.kill("SIGTERM");
  server.close();
  setTimeout(() => process.exit(0), 150).unref();
};
const server = createPairServer({
  envelope,
  grant,
  onConfirm: () => {
    console.log("iPhone confirmed secure connection setup.");
    setTimeout(finish, 1000);
  },
});
server.listen(17458, "127.0.0.1", () => {
  console.log(
    `Encrypted setup prepared: ${profile.catalog.records.length} Calibre books; services: ${profile.services.join(", ")}. Expires in 30 minutes.`,
  );
  cloud = spawn(
    process.env.READ_CLOUDFLARED || "cloudflared",
    ["tunnel", "--url", "http://127.0.0.1:17458", "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let found = false;
  const output = (data) => {
    if (found) return;
    const host = data
      .toString()
      .match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!host) return;
    found = true;
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        endpoint: host[0] + "/pair",
        token: grant,
        key: key.toString("base64url"),
      }),
    ).toString("base64url");
    const link =
      "read-mobile://connections#read-setup=" +
      payload;
    const destination = path.join(
      homedir(),
      "Downloads/read-private-setup-link.txt",
    );
    writeFileSync(destination, link + "\n", { mode: 0o600 });
    console.log(
      "Private setup link saved to Downloads/read-private-setup-link.txt. Open it in the installed read. app; never share it publicly.",
    );
  };
  cloud.stdout.on("data", output);
  cloud.stderr.on("data", output);
  cloud.on("error", () => {
    console.error(
      "Install cloudflared to open the temporary encrypted setup tunnel.",
    );
    finish();
  });
});
setTimeout(finish, 30 * 60_000).unref();
process.on("SIGTERM", finish);
process.on("SIGINT", finish);

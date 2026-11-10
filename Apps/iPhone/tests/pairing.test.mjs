import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, randomUUID } from "node:crypto";
import {
  createPairServer,
  sealProfile,
} from "../scripts/pairing-transport.mjs";
test("private pairing is encrypted, bound to the first device and retryable until confirmation", async (t) => {
  const original = {
    version: 1,
    secrets: { opdsPassword: "fake-test-password" },
    catalog: { records: [] },
  };
  const { envelope, key } = sealProfile(original);
  assert.ok(!JSON.stringify(envelope).includes("fake-test-password"));
  const bytes = Buffer.from(envelope.data, "base64url"),
    iv = Buffer.from(envelope.nonce, "base64url"),
    d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(bytes.subarray(-16));
  const clear = JSON.parse(
    Buffer.concat([d.update(bytes.subarray(0, -16)), d.final()]).toString(),
  );
  assert.equal(clear.secrets.opdsPassword, original.secrets.opdsPassword);
  let confirmed = 0;
  const grant = "random-test-grant",
    server = createPairServer({
      envelope,
      grant,
      onConfirm: () => confirmed++,
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const url = "http://127.0.0.1:" + server.address().port,
    first = randomUUID(),
    second = randomUUID();
  const post = (path, device, token = grant) =>
    fetch(url + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device }),
    });
  assert.equal((await fetch(url + "/pair")).status, 404);
  assert.equal((await post("/pair", first, "wrong")).status, 404);
  assert.equal((await post("/pair", first)).status, 200);
  assert.equal((await post("/pair", second)).status, 409);
  assert.equal((await post("/pair", first)).status, 200);
  assert.equal((await post("/pair/confirm", second)).status, 409);
  assert.equal(confirmed, 0);
  assert.equal((await post("/pair/confirm", first)).status, 200);
  assert.equal(confirmed, 1);
});
test("expired pairing grants cannot retrieve credentials", async (t) => {
  const { envelope } = sealProfile(
    { secrets: {} },
    { expiresAt: Date.now() - 1 },
  );
  const server = createPairServer({ envelope, grant: "grant" });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const response = await fetch(
    "http://127.0.0.1:" + server.address().port + "/pair",
    {
      method: "POST",
      headers: { Authorization: "Bearer grant" },
      body: JSON.stringify({ device: randomUUID() }),
    },
  );
  assert.equal(response.status, 404);
});

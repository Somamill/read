import { useCallback, useEffect, useState } from "react";
import { useRead } from "../lib/context";
import {
  catalogRequest,
  request,
  syncHeaders,
  hardcover,
} from "../lib/network";
import { secret } from "../lib/storage";
import { Card, Label, Button } from "./UI";

export function ConnectionHealth() {
  const { settings } = useRead();
  const [lines, setLines] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const check = useCallback(async () => {
    setBusy(true);
    const probe = async (
      name: string,
      enabled: boolean,
      run: () => Promise<string>,
    ) => {
      if (!enabled) return `${name}: not configured`;
      try {
        return `${name}: ${await run()}`;
      } catch (e) {
        return `${name}: ${String((e as Error).message).replace(/Token\s+\S+|Bearer\s+\S+/g, "[redacted]")}`;
      }
    };
    try {
      const [readwise, hc] = await Promise.all([
        secret("readwise"),
        secret("hardcover"),
      ]);
      setLines(
        await Promise.all([
          probe("Calibre / OPDS", !!settings.opds, async () => {
            const feed = await (
              await catalogRequest(settings.opds, settings)
            ).text();
            if (!/<feed\b/.test(feed))
              throw new Error("The address did not return an OPDS feed.");
            return "connected";
          }),
          probe("KOReader / CrossPoint", !!settings.sync, async () => {
            const auth = await (
              await request(settings.sync.replace(/\/$/, "") + "/users/auth", {
                headers: await syncHeaders(settings),
              })
            ).json();
            if (
              auth.username !== settings.username &&
              auth.authorized !== "OK" &&
              auth.authorized !== true
            )
              throw new Error("Login was not accepted.");
            return "connected";
          }),
          probe("Readwise", !!readwise, async () => {
            await request("https://readwise.io/api/v2/auth/", {
              headers: { Authorization: "Token " + readwise },
            });
            return "connected";
          }),
          probe("Hardcover", !!hc, async () => {
            const accounts = await hardcover();
            const count = accounts.reduce(
              (total: number, account: any) =>
                total + (account.user_books?.length || 0),
              0,
            );
            return `connected · ${count} currently reading`;
          }),
        ]),
      );
    } catch {
      setLines([
        "Secure connection settings are unavailable. Unlock this iPhone and reopen read.",
      ]);
    } finally {
      setBusy(false);
    }
  }, [settings]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (settings.opds || settings.sync || settings.readerSync) check();
    }, 0);
    return () => clearTimeout(timer);
  }, [check, settings.opds, settings.sync, settings.readerSync]);
  if (!settings.opds && !settings.sync && !settings.readerSync) return null;
  return (
    <Card>
      <Label>Your connected services</Label>
      {lines.map((line) => (
        <Label key={line} small>
          {line}
        </Label>
      ))}
      <Label small>
        Checks are read-only. Reading progress syncs automatically while read.
        is active.
      </Label>
      <Button
        title={busy ? "Checking connections…" : "Check connections"}
        secondary
        icon="checkmark-circle-outline"
        disabled={busy}
        onPress={check}
      />
    </Card>
  );
}

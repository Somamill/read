import { syncReader } from "../../lib/readwise";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Page, Card, Label, Button, Field } from "../../components/UI";
import { useRead } from "../../lib/context";
import { secret, setSecret, snapshot, exportSnapshot } from "../../lib/storage";
import {
  request,
  syncHeaders,
  flush,
  catalogRequest,
  hardcover,
} from "../../lib/network";
import { webURL } from "../../lib/model";
export default function Connections() {
  const { settings, saveSettings, error, report, reload } = useRead();
  const [opds, setOpds] = useState(settings.opds),
    [sync, setSync] = useState(settings.sync),
    [username, setUsername] = useState(settings.username),
    [opdsUser, setOpdsUser] = useState(""),
    [opdsPassword, setOpdsPassword] = useState(""),
    [syncPassword, setSyncPassword] = useState(""),
    [readwise, setReadwise] = useState(""),
    [hardcoverToken, setHardcover] = useState(""),
    [status, setStatus] = useState(""),
    [hc, setHC] = useState<any[]>([]);
  useEffect(() => {
    Promise.all(
      ["opdsUser", "opdsPassword", "syncPassword", "readwise", "hardcover"].map(
        secret,
      ),
    ).then(([u, p, s, r, h]) => {
      setOpdsUser(u || "");
      setOpdsPassword(p || "");
      setSyncPassword(s || "");
      setReadwise(r || "");
      setHardcover(h || "");
    });
  }, []);
  const save = async () => {
    try {
      const next = {
        ...settings,
        opds: opds ? webURL(opds) : "",
        sync: sync ? webURL(sync).replace(/\/$/, "") : "",
        username: username.trim(),
      };
      await Promise.all(
        [
          ["opdsUser", opdsUser],
          ["opdsPassword", opdsPassword],
          ["syncPassword", syncPassword],
          ["readwise", readwise.trim()],
          ["hardcover", hardcoverToken.trim()],
        ].map(([k, v]) => setSecret(k, v)),
      );
      await saveSettings(next);
      setStatus("Saved securely on this phone.");
      return next;
    } catch (e) {
      report(e);
      Alert.alert("Connection settings", (e as Error).message);
    }
  };
  const test = async () => {
    const next = await save();
    if (!next) return;
    const results: string[] = [];
    if (next.opds)
      try {
        const r = await catalogRequest(next.opds, next);
        const text = await r.text();
        if (!/<feed\b/.test(text))
          throw new Error("Address did not return an OPDS feed.");
        results.push("Calibre OPDS: connected");
      } catch (e) {
        results.push("OPDS: " + (e as Error).message);
      }
    if (next.sync)
      try {
        await request(next.sync + "/healthcheck", {
          headers: await syncHeaders(next),
        });
        await flush(next);
        results.push("KOReader sync: healthy; pending positions retried");
      } catch (e) {
        results.push("Sync: " + (e as Error).message);
      }
    if (readwise)
      try {
        await request("https://readwise.io/api/v2/auth/", {
          headers: { Authorization: "Token " + readwise.trim() },
        });
        results.push("Readwise token: valid");
      } catch (e) {
        results.push("Readwise: " + (e as Error).message);
      }
    setStatus(
      results.join("\n") || "No servers configured. Local reading is ready.",
    );
  };
  return (
    <Page title="Connections" subtitle="Your servers. Your accounts. Optional.">
      <Card>
        <Label>Appearance</Label>
        {(["system", "black", "bright"] as const).map((theme) => (
          <Button
            key={theme}
            secondary={settings.theme !== theme}
            title={
              theme === "black"
                ? "Black (OLED)"
                : theme[0].toUpperCase() + theme.slice(1)
            }
            onPress={() => saveSettings({ ...settings, theme })}
          />
        ))}
      </Card>
      <Card>
        <Label>Calibre / OPDS</Label>
        <Label small>
          Use the Mac’s reachable LAN or HTTPS address, not 127.0.0.1. Calibre
          Basic and MD5 Digest authentication are supported. Prefer HTTPS
          outside your trusted home network.
        </Label>
        <Field
          label="OPDS URL"
          value={opds}
          onChange={setOpds}
          placeholder="https://your-server/opds"
        />
        <Field label="OPDS username" value={opdsUser} onChange={setOpdsUser} />
        <Field
          label="OPDS password"
          value={opdsPassword}
          onChange={setOpdsPassword}
          secure
        />
      </Card>
      <Card>
        <Label>KOReader / CrossPoint progress</Label>
        <Field
          label="Sync server URL"
          value={sync}
          onChange={setSync}
          placeholder="https://your-sync-server"
        />
        <Field label="Sync username" value={username} onChange={setUsername} />
        <Field
          label="Sync password"
          value={syncPassword}
          onChange={setSyncPassword}
          secure
        />
        <Label small>
          EPUBs use KOReader’s sampled document fingerprint. Read position is
          synchronized as an approximate percentage; different rendering engines
          do not share exact page locations. Retries run while read. is open and
          online.
        </Label>
      </Card>
      <Card>
        <Label>Readwise</Label>
        <Field
          label="Readwise access token"
          value={readwise}
          onChange={setReadwise}
          secure
        />
        <Button
          secondary
          title={
            settings.readerSync
              ? "Disconnect Reader library sync"
              : "Connect Readwise Reader library"
          }
          onPress={async () => {
            const next = await save();
            if (!next) return;
            const connected = { ...next, readerSync: !settings.readerSync };
            await saveSettings(connected);
            if (connected.readerSync)
              try {
                await syncReader(connected, true);
                await reload();
                setStatus(
                  "Reader library connected. Documents arrive in small batches while read. is open.",
                );
              } catch (e) {
                report(e);
                setStatus((e as Error).message);
              }
          }}
        />
        <Label small>
          Reader library and progress synchronization is optional. EPUBs link by
          exact title and author when unambiguous. PDF progress is not supported
          by Reader’s API. Refreshes run in the foreground.
        </Label>
        <Label small>
          Highlights are local first. Upload only when you choose Send in
          Highlights.
        </Label>
      </Card>
      <Card>
        <Label>Hardcover</Label>
        <Field
          label="Hardcover API token"
          value={hardcoverToken}
          onChange={setHardcover}
          secure
        />
        <Button
          secondary
          title="Load currently reading from Hardcover"
          onPress={async () => {
            try {
              await save();
              setHC(await hardcover());
            } catch (e) {
              report(e);
              Alert.alert("Hardcover", (e as Error).message);
            }
          }}
        />
        {hc
          .flatMap((me) => me.user_books || [])
          .map((b: any) => (
            <Label small key={b.id}>
              {b.book?.title} · tracked externally
            </Label>
          ))}
        <Label small>
          External titles do not become readable files automatically. Import
          your own copy. Hardcover catalog access does not synchronize
          BookPlayer’s live playback position.
        </Label>
      </Card>
      <Button title="Save connections" onPress={() => save()} />
      <Button
        secondary
        title="Test connections & retry sync"
        onPress={() => test()}
      />
      {!!status && (
        <Card>
          <Label>{status}</Label>
        </Card>
      )}
      <Card>
        <Label>Diagnostics & export</Label>
        <Label small>{error || "No current local error."}</Label>
        <Button
          secondary
          title="Copy current diagnostics"
          onPress={async () => {
            const data = await snapshot();
            await Clipboard.setStringAsync(
              JSON.stringify(
                {
                  app: "read. iPhone",
                  sdk: 58,
                  books: data.books.length,
                  highlights: data.highlights.length,
                  feeds: data.feeds.length,
                  pending: data.pending.length,
                  error: error.replace(/https?:\/\/\S+/g, "[address]"),
                },
                null,
                2,
              ),
            );
            Alert.alert(
              "Copied",
              "Counts and current errors copied; tokens and library text are excluded.",
            );
          }}
        />
        <Button
          secondary
          title="Export local library & highlights"
          onPress={async () => {
            try {
              const data = await exportSnapshot();
              const file = new File(Paths.cache, "read-mobile-backup.json");
              await file.write(
                JSON.stringify({
                  version: 1,
                  books: data.books,
                  highlights: data.highlights,
                  feeds: data.feeds,
                }),
              );
              await Sharing.shareAsync(file.uri, {
                mimeType: "application/json",
              });
            } catch (e) {
              report(e);
            }
          }}
        />
        <Label small>
          Backups exclude credentials. Audio and original PDF binaries are not
          included; retain those source files.
        </Label>
      </Card>
      <Card>
        <Label>Expo Go compatibility</Label>
        <Label small>
          Local reading, Files import, feeds, speech, audio playback and these
          connections run in Expo Go SDK 58. Apple Books/BookPlayer private
          databases, Mac background jobs, native OCR and extensions require
          separate platform integrations. Expo Go is a preview host, not a
          standalone App Store release.
        </Label>
      </Card>
    </Page>
  );
}

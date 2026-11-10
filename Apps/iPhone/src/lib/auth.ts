import { md5 } from "js-md5";
/** Calibre's HTTP Digest authentication. No credentials in URLs or logs. */
export function digestAuthorization(
  challenge: string,
  url: string,
  username: string,
  password: string,
  cnonce: string,
  nc = "00000001",
) {
  const fields: Record<string, string> = {};
  for (const m of challenge.matchAll(
    /([\w-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/g,
  ))
    fields[m[1].toLowerCase()] = (m[2] ?? m[3]).replace(/\\(.)/g, "$1");
  const algorithm = (fields.algorithm || "MD5").toUpperCase();
  if (
    !["MD5", "MD5-SESS"].includes(algorithm) ||
    !fields.nonce ||
    fields.realm === undefined
  )
    throw new Error("This OPDS Digest authentication method is not supported.");
  const qop = fields.qop
    ?.split(",")
    .map((x) => x.trim())
    .find((x) => x === "auth");
  if (fields.qop && !qop)
    throw new Error("OPDS requires an unsupported Digest protection mode.");
  const u = new URL(url),
    uri = u.pathname + u.search;
  let ha1 = md5(username + ":" + fields.realm + ":" + password);
  if (algorithm === "MD5-SESS")
    ha1 = md5(ha1 + ":" + fields.nonce + ":" + cnonce);
  const ha2 = md5("GET:" + uri),
    response = md5(
      ha1 +
        ":" +
        fields.nonce +
        ":" +
        (qop ? nc + ":" + cnonce + ":auth:" : "") +
        ha2,
    );
  const quote = (s: string) => '"' + s.replace(/["\\]/g, "\\$&") + '"';
  return (
    "Digest " +
    [
      ["username", username],
      ["realm", fields.realm],
      ["nonce", fields.nonce],
      ["uri", uri],
      ["response", response],
      ...(fields.opaque ? [["opaque", fields.opaque]] : []),
    ]
      .map(([k, v]) => k + "=" + quote(v))
      .join(", ") +
    ", algorithm=" +
    algorithm +
    (qop
      ? ", qop=auth, nc=" + nc + ", cnonce=" + quote(cnonce)
      : algorithm === "MD5-SESS"
        ? ", cnonce=" + quote(cnonce)
        : "")
  );
}

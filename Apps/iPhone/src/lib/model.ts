export type Kind = "epub" | "article" | "pdf" | "audio";
export type Book = {
  id: string;
  title: string;
  author: string;
  kind: Kind;
  html?: string;
  hasContent?: boolean;
  uri?: string;
  sourceURL?: string;
  cover?: string;
  document?: string;
  readerID?: string;
  hardcoverID?: string;
  progressKnown?: boolean;
  progressUpdated?: number;
  trackingStatus?: "reading" | "finished";
  identifiers?: Record<string, string>;
  calibre?: { id: string; base: string; formats: Record<string, string> };
  chapters: { id: string; title: string }[];
  progress: number;
  updated: number;
  added: number;
  finished: boolean;
  feed?: string;
};
export type Highlight = {
  id: string;
  bookId: string;
  title: string;
  text: string;
  note: string;
  created: number;
  exported?: boolean;
  category?: "books" | "articles";
  author?: string;
  source?: string;
  sourceURL?: string;
  archived?: boolean;
  frequency?: number;
  review?: { count: number; lastReviewed: number; nextReview: number };
};
export type Settings = {
  theme: "system" | "black" | "bright";
  fontSize: number;
  layout: "pages" | "scroll";
  opds: string;
  sync: string;
  username: string;
  onboarded: boolean;
  readerSync: boolean;
  reviewSize?: number;
};
export type Feed = {
  url: string;
  title: string;
  checked: number;
  error?: string;
};
export type Pending = {
  document: string;
  percentage: number;
  timestamp: number;
  title: string;
  author: string;
};
export const defaults: Settings = {
  theme: "system",
  fontSize: 20,
  layout: "pages",
  opds: "",
  sync: "",
  username: "",
  onboarded: false,
  readerSync: false,
};
export function webURL(raw: string, base?: string): string {
  const u = new URL(raw.trim(), base);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Use an http(s) address without embedded passwords.");
  return u.href;
}
export function progress(value: number) {
  if (!Number.isFinite(value)) throw new Error("Invalid reading position");
  return Math.max(0, Math.min(1, value));
}
export function mergeProgress(
  local: Pending | undefined,
  remote: { percentage: number; timestamp: number },
) {
  return !local || remote.timestamp > local.timestamp
    ? { ...remote, percentage: progress(remote.percentage) }
    : local;
}
export const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
export const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function serverPosition(value: {
  percentage: unknown;
  timestamp: unknown;
}) {
  const p = Number(value?.percentage),
    stamp = Number(value?.timestamp);
  if (
    !Number.isFinite(p) ||
    p < 0 ||
    p > 1 ||
    !Number.isFinite(stamp) ||
    stamp < 0 ||
    stamp > Date.now() / 1000 + 86400
  )
    throw new Error(
      "The sync server returned an invalid position or timestamp. Check device clocks.",
    );
  return { percentage: p, timestamp: stamp };
}

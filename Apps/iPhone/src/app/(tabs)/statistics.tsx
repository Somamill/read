import { useRead } from "../../lib/context";
import { Page, Card, Label } from "../../components/UI";
export default function Statistics() {
  const { books, highlights, feeds } = useRead();
  const reading = books.filter((b) => b.progress > 0 && !b.finished),
    finished = books.filter((b) => b.finished);
  return (
    <Page
      title="Your reading"
      subtitle="Real local activity, without invented reading times."
    >
      {[
        ["Library", books.filter((b) => b.kind !== "article").length],
        ["Articles", books.filter((b) => b.kind === "article").length],
        ["In progress", reading.length],
        ["Finished", finished.length],
        ["Highlights", highlights.length],
        ["Feeds", feeds.length],
      ].map(([label, value]) => (
        <Card key={String(label)}>
          <Label>{label}</Label>
          <Label>{value}</Label>
        </Card>
      ))}
      <Card>
        <Label>Recently active</Label>
        {[...books]
          .sort((a, b) => b.updated - a.updated)
          .slice(0, 8)
          .map((b) => (
            <Label small key={b.id}>
              {b.title} · {Math.round(b.progress * 100)}% ·{" "}
              {new Date(b.updated).toLocaleDateString()}
            </Label>
          ))}
        <Label small>
          Statistics reflect this phone’s library and positions downloaded from
          your sync server. Reading time and full account-wide totals are not
          estimated.
        </Label>
      </Card>
    </Page>
  );
}

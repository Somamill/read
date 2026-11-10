import { md5 } from "js-md5";
import { useState } from "react";
import { Alert, Share } from "react-native";
import { router } from "expo-router";
import { useRead } from "../../lib/context";
import { Page, Card, Label, Button, Field } from "../../components/UI";
import { put, remove } from "../../lib/storage";
import { sendReadwise } from "../../lib/network";
export default function Highlights() {
  const { highlights, reload, report } = useRead(),
    [query, setQuery] = useState(""),
    [review, setReview] = useState(false);
  const [visible, setVisible] = useState(40);
  const rows = highlights.filter((h) =>
    [h.text, h.note, h.title]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const due = review
    ? [...rows]
        .sort((a, b) =>
          md5(new Date().toDateString() + a.id).localeCompare(
            md5(new Date().toDateString() + b.id),
          ),
        )
        .slice(0, 5)
    : rows;
  return (
    <Page
      title={review ? "Daily review" : "Highlights"}
      subtitle="Your passages, notes and ideas. Stored locally."
    >
      <Field label="Search highlights" value={query} onChange={setQuery} />
      <Button
        secondary
        title={review ? "All highlights" : "Review five passages"}
        onPress={() => setReview(!review)}
      />
      {due.slice(0, visible).map((h) => (
        <Card key={h.id}>
          <Label>{h.text}</Label>
          <Label small>{h.title}</Label>
          {!!h.note && <Label>{h.note}</Label>}
          <Button
            secondary
            title="Open source"
            onPress={() =>
              router.push({ pathname: "/reader", params: { id: h.bookId } })
            }
          />
          <Button
            secondary
            title="Add or edit note"
            onPress={() =>
              Alert.prompt(
                "Your note",
                "",
                async (note) => {
                  await put("highlight", h.id, {
                    ...h,
                    note: note || "",
                    exported: false,
                  });
                  await reload();
                },
                "plain-text",
                h.note,
              )
            }
          />
          <Button
            secondary
            title="Share / save to Notes"
            onPress={() =>
              Share.share({ message: `${h.title}\n\n“${h.text}”\n\n${h.note}` })
            }
          />
          <Button
            secondary
            title="Delete highlight"
            onPress={() =>
              Alert.alert(
                "Delete this highlight?",
                "Export first if you want a separate copy.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      await remove("highlight", h.id);
                      await reload();
                    },
                  },
                ],
              )
            }
          />
        </Card>
      ))}
      {due.length > visible && (
        <Button
          secondary
          title="Show more highlights"
          onPress={() => setVisible(visible + 40)}
        />
      )}
      {!rows.length && (
        <Card>
          <Label>Select a passage while reading.</Label>
          <Label small>
            Tap Highlight selection. You can use highlights and review without
            Readwise.
          </Label>
        </Card>
      )}
      <Button
        title="Export highlights"
        onPress={() =>
          Share.share({
            message: highlights
              .map((h) => `# ${h.title}\n\n> ${h.text}\n\n${h.note}`)
              .join("\n\n---\n\n"),
          })
        }
      />
      <Button
        secondary
        title="Send new highlights to Readwise"
        onPress={() =>
          Alert.alert(
            "Send highlights to Readwise?",
            "This uploads your unexported passages and notes to your connected Readwise account.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Send",
                onPress: async () => {
                  try {
                    const count = await sendReadwise(highlights);
                    await reload();
                    Alert.alert("Readwise", `${count} highlights sent.`);
                  } catch (e) {
                    report(e);
                    Alert.alert("Readwise", (e as Error).message);
                  }
                },
              },
            ],
          )
        }
      />
    </Page>
  );
}

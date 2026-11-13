import { useState } from "react";
import { Image, Linking } from "react-native";
import { Card, Label, Button } from "./UI";

export function DotSuite() {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const open = (repo: string) => { setError(""); void Linking.openURL(`https://github.com/Somamill/${repo}`).catch(() => setError("Could not open the project page. Try again.")); };
  return <Card>
    <Image source={require("../../assets/read-icon.png")} accessibilityLabel="read. open book" style={{width:48,height:48,borderRadius:12,marginBottom:12}} />
    <Label>read. · Part of dot.</Label>
    <Button secondary title={expanded ? "Hide companion apps" : "More from dot."} onPress={() => setExpanded(value => !value)} />
    {expanded && <>
      <Label small>listen. — Find your next audiobook.</Label>
      <Button secondary title="Explore listen." onPress={() => open("listen")} />
      <Label small>Immersed — Japanese worth watching.</Label>
      <Button secondary title="Explore Immersed" onPress={() => open("immersed")} />
    </>}
    {!!error && <Label small>{error}</Label>}
  </Card>;
}

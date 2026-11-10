import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useLinkingURL } from "expo-linking";
import { useRead } from "../lib/context";
import { importMacSetup } from "../lib/pairing";
export function SetupHandoff() {
  const url = useLinkingURL(),
    { settings, ready, reload, report } = useRead(),
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || !url?.includes("#read-setup=") || seen.current.has(url))
      return;
    seen.current.add(url);
    const apply = async () => {
      try {
        const result = await importMacSetup(url, settings);
        await reload();
        Alert.alert(
          "Your library is connected",
          `${result.count} Calibre books · ${result.highlights} saved highlights. Connections: ${result.services.join(", ")}. Open Highlights → Start daily review to revisit your passages.`,
        );
      } catch (e) {
        report(e);
        Alert.alert("Mac setup", (e as Error).message);
      }
    };
    if (
      settings.onboarded ||
      settings.opds ||
      settings.sync ||
      settings.readerSync
    )
      Alert.alert(
        "Use connections from your Mac?",
        "This replaces connection settings. Your local books and highlights are kept.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Connect", onPress: apply },
        ],
      );
    else apply();
  }, [url, ready, settings, reload, report]);
  return null;
}

import { SetupHandoff } from "../components/SetupHandoff";
import { Stack } from "expo-router";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ReadProvider, useRead } from "../lib/context";
import { usePalette } from "../components/UI";
function Navigation() {
  const palette = usePalette();
  const { dark, ready, error, reload, report } = useRead();
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          justifyContent: "center",
          alignItems: "center",
          padding: 28,
          gap: 20,
        }}
      >
        <SetupHandoff />
        <StatusBar style={dark ? "light" : "dark"} />
        {error ? (
          <>
            <Text style={{ color: palette.ink }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => reload().catch(report)}
            >
              <Text
                style={{ color: palette.blue, padding: 16 }}
              >
                Try opening the library again
              </Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  return (
    <>
      <SetupHandoff />
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reader" />
        <Stack.Screen name="capture" />
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <ReadProvider>
      <Navigation />
    </ReadProvider>
  );
}

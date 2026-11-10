import { Stack } from "expo-router";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ReadProvider, useRead } from "../lib/context";
function Navigation() {
  const { dark, ready, error, reload, report } = useRead();
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: dark ? "#000" : "#fff",
          justifyContent: "center",
          alignItems: "center",
          padding: 28,
          gap: 20,
        }}
      >
        <StatusBar style={dark ? "light" : "dark"} />
        {error ? (
          <>
            <Text style={{ color: dark ? "#fff" : "#111" }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => reload().catch(report)}
            >
              <Text
                style={{ color: dark ? "#85b9ff" : "#075ccc", padding: 16 }}
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
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? "#000" : "#fff" },
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

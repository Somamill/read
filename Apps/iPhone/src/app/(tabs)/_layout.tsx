import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../../components/UI";
export default function TabLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.blue,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: {
          backgroundColor: p.card,
          borderTopColor: p.line,
          height: 88,
          paddingTop: 9,
          paddingBottom: 24,
        },
      }}
    >
      {[
        ["index", "Library", "book-outline"],
        ["articles", "Articles", "newspaper-outline"],
        ["highlights", "Highlights", "pencil-outline"],
        ["statistics", "Stats", "stats-chart-outline"],
        ["connections", "Settings", "options-outline"],
      ].map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={icon as any}
                color={typeof color === "number" ? p.muted : color || p.muted}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

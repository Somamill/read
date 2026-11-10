import React from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRead } from "../lib/context";
import { Ionicons } from "@expo/vector-icons";
export function usePalette() {
  const { dark } = useRead();
  return {
    bg: dark ? "#000" : "#f7f7f9",
    card: dark ? "#141416" : "#fff",
    ink: dark ? "#f5f5f7" : "#18181a",
    muted: dark ? "#a4a4ab" : "#66666d",
    line: dark ? "#29292e" : "#e2e2e8",
    blue: dark ? "#85b9ff" : "#075ccc",
    onBlue: dark ? "#00152c" : "#fff",
  };
}
export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const p = usePalette(),
    insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        padding: 22,
        paddingBottom: 110,
        paddingTop: insets.top + 18,
        gap: 18,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 36,
          fontWeight: "700",
          letterSpacing: -1,
          color: p.ink,
          marginTop: 10,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 16,
            lineHeight: 23,
            color: p.muted,
            marginTop: -8,
          }}
        >
          {subtitle}
        </Text>
      )}
      {children}
    </ScrollView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          padding: 18,
          borderRadius: 24,
          backgroundColor: p.card,
          borderWidth: 1,
          borderColor: p.line,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Label({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  const p = usePalette();
  return (
    <Text
      style={{
        color: small ? p.muted : p.ink,
        fontSize: small ? 13 : 17,
        lineHeight: small ? 19 : 24,
        fontWeight: small ? "400" : "500",
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  icon,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  secondary?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: secondary ? p.bg : p.blue,
        opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
      })}
    >
      {icon && (
        <Ionicons name={icon} size={19} color={secondary ? p.ink : p.onBlue} />
      )}
      <Text
        style={{
          fontWeight: "600",
          fontSize: 16,
          color: secondary ? p.ink : p.onBlue,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure = false,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (x: string) => void;
  secure?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: 7 }}>
      <Label small>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor={p.muted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        style={{
          backgroundColor: p.bg,
          color: p.ink,
          padding: 14,
          borderRadius: 13,
          fontSize: 16,
          borderWidth: 1,
          borderColor: p.line,
          minHeight: 48,
        }}
      />
    </View>
  );
}

import React from "react";
import { router } from "expo-router";
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
import { dotTokens as dot } from "../lib/dot-tokens";
export function usePalette() {
  const { dark, settings } = useRead();
  const colors = dark ? dot.colors.dark : dot.colors.light;
  return {
    bg: settings.theme === "black" ? "#000000" : colors.background,
    card: colors.surface,
    ink: colors.text,
    muted: colors.secondaryText,
    line: colors.border,
    blue: dot.colors[dark ? "accentsDark" : "accents"].read,
    onBlue: dot.colors.onAccent[dark ? "dark" : "light"],
  };
}
export function Page({
  title,
  subtitle,
  searchable = true,
  children,
}: {
  title: string;
  subtitle?: string;
  searchable?: boolean;
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
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:16}}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 28,
          fontWeight: "700",
          letterSpacing: -0.5,
          color: p.ink,
          flex:1,
          marginTop: 10,
        }}
      >
        {title}
      </Text>
      {searchable&&<Pressable accessibilityRole="button" accessibilityLabel="Search library and commands" onPress={()=>router.push("/search")} style={{padding:12,minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}><Ionicons name="search-outline" size={24} color={p.ink}/></Pressable>}
      </View>
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
          borderRadius: dot.radius.card,
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
        borderRadius: dot.radius.control,
        backgroundColor: secondary ? p.bg : p.blue,
        opacity: disabled ? 0.4 : dot.interaction.pressedOpacity,
        borderWidth: 1,
        borderColor: pressed ? (secondary ? p.ink : p.onBlue) : "transparent",
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

import AppKit

/// Uses the same checked-in semantic tokens as the dashboard and iPhone app.
enum DotTheme {
    private static let tokens: [String: Any] = {
        guard let url = Bundle.main.url(forResource: "dot-theme", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return object
    }()

    static func hex(_ role: String, dark: Bool) -> String {
        let palettes = tokens["colors"] as? [String: [String: String]]
        return palettes?[dark ? "dark" : "light"]?[role] ?? (dark ? "#151815" : "#FAF8F4")
    }

    static func color(_ role: String, dark: Bool, oled: Bool = false) -> NSColor {
        if oled && role == "background" { return .black }
        let value = UInt32(hex(role, dark: dark).dropFirst(), radix: 16) ?? 0
        return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255,
                       green: CGFloat((value >> 8) & 255) / 255,
                       blue: CGFloat(value & 255) / 255, alpha: 1)
    }
}

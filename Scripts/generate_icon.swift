import AppKit
import Foundation

// One vector source supplies every platform; keep suite snapshots unchanged.
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let spec = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("branding/read/icon.json"))) as! [String: Any]
let kit = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("branding/dot/tokens.json"))) as! [String: Any]
let colors = kit["colors"] as! [String: Any]
let light = colors["light"] as! [String: String]
let accents = colors["accents"] as! [String: String]
let pages = spec["pages"] as! [[[Any]]]
let grid = CGFloat(spec["grid"] as! Double)

func color(_ hex: String) -> NSColor {
    let value = UInt32(hex.dropFirst(), radix: 16)!
    return NSColor(srgbRed: CGFloat((value >> 16) & 255)/255,
                   green: CGFloat((value >> 8) & 255)/255,
                   blue: CGFloat(value & 255)/255, alpha: 1)
}
let paper = color(light["background"]!)
let ink = color(accents["read"]!)
let tintedPaper = paper.blended(withFraction: CGFloat(spec["paperTint"] as! Double), of: ink)!

func render(_ pixels: Int, mac: Bool, symbol: Bool = false) throws -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    defer { NSGraphicsContext.restoreGraphicsState() }
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current?.imageInterpolation = .high
    let size = CGFloat(pixels)
    let inset = mac ? size * CGFloat(spec["macInset"] as! Double) : 0
    let side = size - inset * 2
    if !symbol {
        // macOS keeps the standard transparent margin. iOS supplies its own mask.
        let radius = mac ? side * CGFloat(spec["tileRadius"] as! Double) : 0
        let tile = NSBezierPath(roundedRect: NSRect(x: inset, y: inset, width: side, height: side), xRadius: radius, yRadius: radius)
        NSGradient(starting: tintedPaper, ending: paper)!.draw(in: tile, angle: 90)
        if mac {
            paper.setStroke(); tile.lineWidth = max(0.5, size / 512); tile.stroke()
        }
    }
    func point(_ command: [Any], _ index: Int) -> NSPoint {
        NSPoint(x: inset + CGFloat(command[index] as! Double) / grid * side,
                y: size - inset - CGFloat(command[index + 1] as! Double) / grid * side)
    }
    (symbol ? NSColor.white : ink).setFill()
    for commands in pages {
        let path = NSBezierPath()
        for command in commands {
            switch command[0] as! String {
            case "M": path.move(to: point(command, 1))
            case "L": path.line(to: point(command, 1))
            case "C": path.curve(to: point(command, 5), controlPoint1: point(command, 1), controlPoint2: point(command, 3))
            case "Z": path.close()
            default: fatalError("Unsupported book path command")
            }
        }
        path.fill()
    }
    return bitmap.representation(using: .png, properties: [:])!
}

try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let variants: [(Int, String)] = [
    (16,"icon_16x16.png"),(32,"icon_16x16@2x.png"),(32,"icon_32x32.png"),(64,"icon_32x32@2x.png"),
    (128,"icon_128x128.png"),(256,"icon_128x128@2x.png"),(256,"icon_256x256.png"),
    (512,"icon_256x256@2x.png"),(512,"icon_512x512.png"),(1024,"icon_512x512@2x.png")
]
for (size, name) in variants {
    try render(size, mac: true).write(to: output.appendingPathComponent(name))
}
let parent = output.deletingLastPathComponent()
try render(1024, mac: true).write(to: parent.appendingPathComponent("AppIcon.png"))
try render(1024, mac: false).write(to: parent.appendingPathComponent("MobileIcon.png"))
try render(1024, mac: false, symbol: true).write(to: parent.appendingPathComponent("BookSymbol.png"))

import AppKit
import Foundation
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let icon = NSImage(contentsOf: root.appendingPathComponent("Apps/iPhone/assets/read-icon.png"))!
let destination = root.appendingPathComponent("Documentation/Brand")
func color(_ value: String) -> NSColor {
    let n = UInt32(value.dropFirst(), radix:16)!
    return NSColor(srgbRed:CGFloat((n>>16)&255)/255,green:CGFloat((n>>8)&255)/255,blue:CGFloat(n&255)/255,alpha:1)
}
let kit = try JSONSerialization.jsonObject(with:Data(contentsOf:root.appendingPathComponent("branding/dot/tokens.json"))) as! [String:Any]
let colors=kit["colors"] as! [String:Any], light=colors["light"] as! [String:String]
let accent=color((colors["accents"] as! [String:String])["read"]!)
func artwork(_ filename:String, _ width:Int, _ height:Int, features:Bool=false) throws {
    let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState();defer {NSGraphicsContext.restoreGraphicsState()}
    NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
    let scale=CGFloat(width)/1600
    NSGraphicsContext.current!.cgContext.scaleBy(x:scale,y:scale)
    color(light["background"]!).setFill();NSRect(x:0,y:0,width:1600,height:800).fill()
    func text(_ string:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ secondary:Bool=false,_ serif:Bool=false){
        let font=serif ? (NSFont(name:"Georgia-Bold",size:size) ?? NSFont.systemFont(ofSize:size,weight:.bold)) : NSFont.systemFont(ofSize:size,weight:.regular)
        (string as NSString).draw(at:NSPoint(x:x,y:y),withAttributes:[.font:font,.foregroundColor:color(light[secondary ? "secondaryText":"text"]!)])
    }
    let box=NSBezierPath(roundedRect:NSRect(x:120,y:350,width:240,height:240),xRadius:57,yRadius:57)
    NSGraphicsContext.saveGraphicsState();box.addClip();icon.draw(in:NSRect(x:120,y:350,width:240,height:240));NSGraphicsContext.restoreGraphicsState()
    text("read.",420,430,126,false,true)
    text("Part of dot.",1240,685,28,true)
    accent.setFill();NSRect(x:120,y:285,width:1360,height:2).fill()
    text(features ? "Books. Articles. Highlights." : "A quieter place to read.",120,170,64,false,true)
    text(features ? "Read offline • Follow feeds • Keep what matters" : "Free. Open source. Your library, in one place.",120,104,30,true)
    let data=bitmap.representation(using:.jpeg,properties:[.compressionFactor:0.9])!
    try data.write(to:destination.appendingPathComponent(filename))
}
try artwork("read-hero.jpg",1600,800)
try artwork("read-features.jpg",1600,800,features:true)
try artwork("read-social-preview.jpg",1280,640)

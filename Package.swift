// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ReadCore",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "ReadCore", targets: ["ReadCore"])],
    targets: [
        .target(name: "ReadCore", path: "Sources/ReadCore/ReadCore"),
        .testTarget(name: "ReadCoreTests", dependencies: ["ReadCore"], path: "Tests/ReadCoreTests")
    ]
)

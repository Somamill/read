cask "read" do
  version :latest
  sha256 :no_check

  url "https://github.com/Somamill/read/releases/latest/download/read.dmg"
  name "read."
  desc "Local-first books, articles, highlights and reading sync"
  homepage "https://github.com/Somamill/read"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :sonoma

  app "read.app"

  zap trash: [
    "~/Library/Application Support/Shelf",
    "~/Library/Preferences/app.shelf.dashboard.plist",
    "~/Library/Saved Application State/app.shelf.dashboard.savedState",
  ]

  caveats do
    unsigned_accessibility
  end
end

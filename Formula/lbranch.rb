class Lbranch < Formula
  desc "Link git branches to Linear issues"
  homepage "https://github.com/type-dot-com/homebrew-linear-branch"
  url "https://github.com/type-dot-com/homebrew-linear-branch/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "302b969d47bdb00bbfcddec96c11a41045be9b6948510558aee6778332420376"
  license "MIT"

  depends_on "jq"

  def install
    bin.install "bin/lbranch"
    (libexec/"lib").install Dir["lib/*"]
    # Rewrite the LIB_DIR reference to point to the Homebrew libexec location
    inreplace bin/"lbranch", /^LIB_DIR=.*$/, "LIB_DIR=\"#{libexec}/lib\""
  end

  test do
    assert_match "LINEAR_API_KEY not found", shell_output("#{bin}/lbranch 2>&1", 1)
  end
end

class Lbranch < Formula
  desc "Link git branches to Linear issues"
  homepage "https://github.com/type-dot-com/homebrew-linear-branch"
  url "https://github.com/type-dot-com/homebrew-linear-branch/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "d5558cd419c8d46bdc958064cb97f963d1ea793866414c025906ec15033512ed"
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

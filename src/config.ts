/** Config loading: API key, team config caching, git name */

import { homedir } from "node:os";
import { join } from "node:path";
import type { LbranchConfig } from "./types.js";
import { getGitRoot } from "./git.js";

const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
  "lbranch",
);
const CONFIG_FILE = join(CONFIG_DIR, "config");

export async function loadApiKey(): Promise<string> {
  // Try env var first
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }

  // Try .env file in git root
  const gitRoot = await getGitRoot();
  if (gitRoot) {
    const envPath = join(gitRoot, ".env");
    const file = Bun.file(envPath);
    if (await file.exists()) {
      const content = await file.text();
      for (const line of content.split("\n")) {
        const match = line.match(/^LINEAR_API_KEY=["']?([^"'\s]+)["']?/);
        if (match) {
          return match[1];
        }
      }
    }
  }

  throw new Error(
    "LINEAR_API_KEY not found.\n" +
      "   Set it as an environment variable: export LINEAR_API_KEY=lin_api_xxxxx\n" +
      "   Or add it to your repo's .env file: LINEAR_API_KEY=lin_api_xxxxx\n" +
      "   Generate one at: Linear > Settings > API > Personal API Keys",
  );
}

export async function loadTeamConfig(): Promise<LbranchConfig | null> {
  const file = Bun.file(CONFIG_FILE);
  if (await file.exists()) {
    try {
      const config = await file.json();
      if (config.teamId && config.teamKey) {
        return config as LbranchConfig;
      }
    } catch {
      // Corrupt config file — ignore
    }
  }
  return null;
}

export async function saveTeamConfig(config: LbranchConfig): Promise<void> {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(CONFIG_DIR, { recursive: true });
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getGitName(autoMode: boolean): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "config", "user.name"], { stdout: "pipe" });
    await proc.exited;
    const fullName = (await new Response(proc.stdout).text()).trim();
    if (fullName) {
      const firstName = fullName.split(/\s+/)[0].toLowerCase();
      return firstName;
    }
  } catch {
    // git config failed
  }

  if (autoMode) {
    return "ci";
  }

  // Will be handled by ui.ts promptGitName()
  return "";
}

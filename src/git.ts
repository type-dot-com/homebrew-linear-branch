/** Git operations: slugify, branch check, create/rename branch */

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join("-");
}

async function gitExec(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`git ${args[0]} failed: ${stderr.trim()}`);
  }
  return stdout.trim();
}

export async function getCurrentBranch(): Promise<string> {
  return gitExec(["symbolic-ref", "--short", "HEAD"]);
}

export async function getGitRoot(): Promise<string | null> {
  try {
    return await gitExec(["rev-parse", "--show-toplevel"]);
  } catch {
    return null;
  }
}

export function isAlreadyLinked(branch: string): { linked: boolean; issueId?: string } {
  const match = branch.match(/^[a-z]+\/([A-Z]+-[0-9]+)-[a-z0-9-]+$/);
  if (match) {
    return { linked: true, issueId: match[1] };
  }
  return { linked: false };
}

export async function createBranch(name: string, fromBranch: string): Promise<void> {
  await gitExec(["pull", "origin", fromBranch, "--quiet"]);
  await gitExec(["checkout", "-b", name]);
}

export async function renameBranch(newName: string): Promise<void> {
  await gitExec(["branch", "-m", newName]);
}

/** All clack-based interactive prompts */

import * as clack from "@clack/prompts";
import type { LinearIssue, LinearTeam } from "./types.js";

// ANSI helpers
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export async function selectTeam(teams: LinearTeam[]): Promise<LinearTeam> {
  const result = await clack.select({
    message: "Which team?",
    options: teams.map((t) => ({
      value: t.id,
      label: t.name,
      hint: t.key,
    })),
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  const team = teams.find((t) => t.id === result);
  if (!team) throw new Error("Invalid team selection");
  return team;
}

function formatIssueLabel(issue: LinearIssue, context?: string): string {
  const meta: string[] = [];
  if (context) {
    meta.push(context);
  } else {
    meta.push(issue.state.name);
    if (issue.assignee) {
      meta.push(issue.assignee.isMe ? "You" : issue.assignee.displayName);
    } else {
      meta.push("Unassigned");
    }
  }
  return `${dim(issue.identifier)}  ${issue.title}  ${dim(meta.join(" · "))}`;
}

export async function showInteractiveMenu(
  todos: LinearIssue[],
  recent: LinearIssue[],
): Promise<
  | { action: "search"; query: string }
  | { action: "create"; title: string }
  | { action: "pick"; issue: LinearIssue }
> {
  // Step 1: text input
  const input = await clack.text({
    message: "Search or create an issue",
    placeholder: "Type a query or issue title, or press Enter to browse",
  });

  if (clack.isCancel(input)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  const query = input.trim();

  // If they typed something, go straight to search
  if (query) {
    return { action: "search", query };
  }

  // Otherwise show issue picker with todos + recent
  const issueMap = new Map<string, LinearIssue>();
  const options: Array<{ value: string; label: string; hint?: string }> = [];

  const seen = new Set<string>();

  for (const issue of todos) {
    if (seen.has(issue.identifier)) continue;
    seen.add(issue.identifier);
    const key = `issue:${issue.identifier}`;
    issueMap.set(key, issue);
    options.push({
      value: key,
      label: formatIssueLabel(issue, "My Todo"),
    });
  }

  const recentFiltered = recent.filter((i) => !seen.has(i.identifier)).slice(0, 3);
  for (const issue of recentFiltered) {
    seen.add(issue.identifier);
    const key = `issue:${issue.identifier}`;
    issueMap.set(key, issue);
    options.push({
      value: key,
      label: formatIssueLabel(issue, "Recent"),
    });
  }

  options.push({ value: "action:create", label: dim("Create a new issue") });

  const result = await clack.select({
    message: "Pick an issue",
    options,
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  if (result === "action:create") return { action: "create", title: "" };

  const issue = issueMap.get(result);
  if (!issue) throw new Error("Invalid selection");
  return { action: "pick", issue };
}

export async function pickIssue(
  issues: LinearIssue[],
): Promise<LinearIssue | { action: "create" }> {
  const issueMap = new Map<string, LinearIssue>();

  const options: Array<{ value: string; label: string; hint?: string }> = issues.map(
    (issue) => {
      const key = `issue:${issue.identifier}`;
      issueMap.set(key, issue);
      return {
        value: key,
        label: formatIssueLabel(issue),
      };
    },
  );

  options.push({
    value: "create",
    label: dim("Create a new issue"),
  });

  const result = await clack.select({
    message: "Pick an issue",
    options,
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  if (result === "create") {
    return { action: "create" };
  }

  const issue = issueMap.get(result);
  if (!issue) throw new Error("Invalid selection");
  return issue;
}

export async function promptSearch(): Promise<string> {
  const result = await clack.text({
    message: "Search Linear",
    placeholder: "e.g. fix login bug",
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  return result;
}

export async function promptIssueTitle(): Promise<string> {
  const result = await clack.text({
    message: "Issue title",
    placeholder: "e.g. Add channel search endpoint",
    validate: (value) => {
      if (!value.trim()) return "Title is required";
    },
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  return result;
}

export async function promptGitName(): Promise<string> {
  const result = await clack.text({
    message: "Your name (lowercase, first name)",
    placeholder: "e.g. fletcher",
    validate: (value) => {
      if (!value.trim()) return "Name is required";
    },
  });

  if (clack.isCancel(result)) {
    clack.cancel("Cancelled.");
    process.exit(0);
  }

  return result;
}

#!/usr/bin/env bun
/** lbranch: Link your current work to a Linear issue and name your branch correctly. */

import { parseArgs } from "node:util";
import * as clack from "@clack/prompts";
import { loadApiKey, loadTeamConfig, saveTeamConfig, getGitName } from "./config.js";
import { setApiKey, getTeams, getIssueById, searchIssues, createIssue as linearCreateIssue, getViewerId, getInProgressStateId, updateIssue, getIssueUrl, getAssignedTodos, getRecentUnassigned } from "./linear.js";
import { slugify, getCurrentBranch, isAlreadyLinked, createBranch, renameBranch } from "./git.js";
import { selectTeam, showInteractiveMenu, pickIssue, promptIssueTitle, promptGitName } from "./ui.js";
import type { LinearIssue, Mode } from "./types.js";

// --- Parse args ---
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    auto: { type: "boolean", default: false },
    c: { type: "boolean", short: "c", default: false },
  },
  allowPositionals: true,
  strict: false,
});

const autoMode = values.auto === true;
const createMode = values.c === true;
const arg = positionals.join(" ").trim();

// --- Determine mode ---
function determineMode(): Mode {
  if (autoMode) {
    return { type: "auto", arg: arg || undefined };
  }
  if (createMode) {
    return { type: "create", title: arg || undefined };
  }
  if (!arg) {
    return { type: "interactive" };
  }
  // Check if arg looks like an issue ID
  return { type: "search", query: arg };
}

// --- Resolve team ID (with caching) ---
async function resolveTeamId(): Promise<{ teamId: string; teamKey: string }> {
  const cached = await loadTeamConfig();
  if (cached) {
    return cached;
  }

  const s = clack.spinner();
  s.start("Fetching teams from Linear...");
  const teams = await getTeams();
  s.stop("Teams loaded");

  let team;
  if (teams.length === 1 || autoMode) {
    team = teams[0];
  } else {
    team = await selectTeam(teams);
  }

  const config = { teamId: team.id, teamKey: team.key };
  await saveTeamConfig(config);
  clack.log.info(`Saved team selection (${team.key}) to ~/.config/lbranch/config`);
  return config;
}

// --- Create issue flow ---
async function doCreateIssue(title?: string): Promise<{ identifier: string; title: string }> {
  const issueTitle = title ?? (autoMode ? undefined : await promptIssueTitle());
  if (!issueTitle) {
    throw new Error("Title is required");
  }

  const { teamId } = await resolveTeamId();

  const s = clack.spinner();
  s.start("Creating issue...");
  const issue = await linearCreateIssue(issueTitle, teamId);
  s.stop(`Created ${issue.identifier}: ${issue.title}`);
  return issue;
}

// --- Resolve issue based on mode ---
async function resolveIssue(mode: Mode): Promise<{ identifier: string; title: string }> {
  const teamConfig = await loadTeamConfig();
  const teamKey = teamConfig?.teamKey;

  // Build issue ID regex
  const issueRe = teamKey
    ? new RegExp(`^${teamKey}-\\d+$`)
    : /^[A-Z]+-\d+$/;

  switch (mode.type) {
    case "direct": {
      const s = clack.spinner();
      s.start(`Looking up ${mode.issueId}...`);
      const issue = await getIssueById(mode.issueId);
      if (!issue) {
        s.stop(`Issue ${mode.issueId} not found`);
        throw new Error(`Issue ${mode.issueId} not found in Linear`);
      }
      s.stop(`Found: ${issue.identifier} - ${issue.title}`);
      return issue;
    }

    case "create": {
      return doCreateIssue(mode.title);
    }

    case "auto": {
      if (!mode.arg) {
        throw new Error(
          "--auto requires an issue ID or description\n" +
            "   Usage: lbranch --auto ENG-142\n" +
            "   Usage: lbranch --auto \"task description\"",
        );
      }
      // Check if it's an issue ID
      if (issueRe.test(mode.arg)) {
        const issue = await getIssueById(mode.arg);
        if (!issue) {
          throw new Error(`Issue ${mode.arg} not found in Linear`);
        }
        return issue;
      }
      // Otherwise create a new issue
      return doCreateIssue(mode.arg);
    }

    case "search": {
      // First check if query looks like an issue ID
      if (issueRe.test(mode.query)) {
        const s = clack.spinner();
        s.start(`Looking up ${mode.query}...`);
        const issue = await getIssueById(mode.query);
        if (!issue) {
          s.stop(`Issue ${mode.query} not found`);
          throw new Error(`Issue ${mode.query} not found in Linear`);
        }
        s.stop(`Found: ${issue.identifier} - ${issue.title}`);
        return issue;
      }

      const s = clack.spinner();
      s.start(`Searching Linear for "${mode.query}"...`);
      const issues = await searchIssues(mode.query);
      s.stop(`Found ${issues.length} issue${issues.length === 1 ? "" : "s"}`);

      if (issues.length === 0) {
        const createResult = await pickIssue([]);
        if ("action" in createResult) {
          return doCreateIssue();
        }
        return createResult;
      }

      const selected = await pickIssue(issues);
      if ("action" in selected) {
        return doCreateIssue();
      }
      return selected;
    }

    case "interactive": {
      process.stdout.write("\x1b[2m  Loading...\x1b[0m");
      const [todos, recent] = await Promise.all([
        getAssignedTodos(3),
        getRecentUnassigned(6),
      ]);
      process.stdout.write("\r\x1b[2K");

      const menuResult = await showInteractiveMenu(todos, recent);

      switch (menuResult.action) {
        case "pick":
          return menuResult.issue;

        case "search": {
          const ss = clack.spinner();
          ss.start(`Searching for "${menuResult.query}"...`);
          const results = await searchIssues(menuResult.query);
          ss.stop(`Found ${results.length} issue${results.length === 1 ? "" : "s"}`);
          const selected = await pickIssue(results);
          if ("action" in selected) {
            return doCreateIssue();
          }
          return selected;
        }

        case "create":
          return doCreateIssue(menuResult.title || undefined);
      }
    }
  }
}

// --- Main ---
async function main(): Promise<void> {
  // Load config
  const apiKey = await loadApiKey();
  setApiKey(apiKey);

  let gitName = await getGitName(autoMode);
  if (!gitName && !autoMode) {
    gitName = await promptGitName();
  }

  // Check if branch already linked
  const currentBranch = await getCurrentBranch();
  const linkCheck = isAlreadyLinked(currentBranch);
  if (linkCheck.linked) {
    if (!autoMode) {
      clack.log.info(`Already linked to ${linkCheck.issueId} on branch: ${currentBranch}`);
    } else {
      console.log(`Already linked to ${linkCheck.issueId} on branch: ${currentBranch}`);
    }
    return;
  }

  // Determine mode (may refine based on arg matching)
  let mode = determineMode();

  // If mode is "search" but arg looks like an issue ID, switch to "direct"
  if (mode.type === "search") {
    const teamConfig = await loadTeamConfig();
    const teamKey = teamConfig?.teamKey;
    const issueRe = teamKey
      ? new RegExp(`^${teamKey}-\\d+$`)
      : /^[A-Z]+-\d+$/;
    if (issueRe.test(mode.query)) {
      mode = { type: "direct", issueId: mode.query };
    }
  }

  // Resolve issue
  const issue = await resolveIssue(mode);

  // Update Linear (assign + In Progress)
  {
    const s = clack.spinner();
    s.start("Updating issue in Linear...");
    const [viewerId, inProgressId] = await Promise.all([
      getViewerId(),
      getInProgressStateId(issue.identifier),
    ]);
    const updates: { assigneeId?: string; stateId?: string } = {};
    if (viewerId) updates.assigneeId = viewerId;
    if (inProgressId) updates.stateId = inProgressId;
    await updateIssue(issue.identifier, updates);
    s.stop("Issue updated");
  }

  // Create or rename branch
  const slug = slugify(issue.title);
  const branchName = `${gitName}/${issue.identifier}-${slug}`;

  {
    const s = clack.spinner();
    if (currentBranch === "main" || currentBranch === "master") {
      s.start(`Creating branch: ${branchName}`);
      await createBranch(branchName, currentBranch);
    } else {
      s.start(`Renaming branch → ${branchName}`);
      await renameBranch(branchName);
    }
    s.stop(`Branch: ${branchName}`);
  }

  // Summary
  const issueUrl = await getIssueUrl(issue.identifier);

  const summaryLines = [
    `Linked to ${issue.identifier}: ${issue.title}`,
    "",
    `   Branch:  ${branchName}`,
  ];
  if (issueUrl) {
    summaryLines.push(`   Issue:   ${issueUrl}`);
  }
  summaryLines.push(`   Commits: Prefix with "${issue.identifier}: ..."`);

  clack.note(summaryLines.join("\n"), "Summary");
}

main().catch((err) => {
  if (!autoMode) {
    clack.log.error(err.message);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

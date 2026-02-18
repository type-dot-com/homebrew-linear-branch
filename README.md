# lbranch

Link your git branches to Linear issues. Picks an issue, names your branch, assigns it to you, and marks it In Progress — all in one command.

## Install

```bash
bun add -g lbranch
```

## Setup

Set your Linear API key:

```bash
export LINEAR_API_KEY=lin_api_xxxxx
```

Generate one at **Linear > Settings > API > Personal API Keys**.

You can also add `LINEAR_API_KEY=lin_api_xxxxx` to a `.env` file in any git repo root as a fallback.

## Usage

```bash
lbranch                  # Interactive: search, browse, or create issues
lbranch DEV-142          # Link to a specific issue
lbranch "search terms"   # Search issues by keyword
lbranch -c               # Jump straight to creating a new issue
lbranch -c "Fix login"   # Create issue with title and branch in one shot
```

### Non-interactive (CI)

```bash
lbranch --auto "task description"   # Creates issue + branch
lbranch --auto DEV-142              # Links to existing issue
```

## What it does

1. Finds or creates a Linear issue
2. Assigns the issue to you and sets it to **In Progress**
3. Creates (or renames) your branch: `yourname/DEV-142-short-slug`

## Branch format

```
<username>/<TEAM-123>-<slug>
```

The username comes from `git config user.name`. The team prefix (e.g., `DEV`) is fetched from Linear and cached.

## Configuration

Config is stored at `~/.config/lbranch/config` and caches your selected team's ID and issue key prefix. Delete this file to re-select your team.

## License

MIT

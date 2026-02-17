#!/bin/bash
# config.sh — Dependency checks, API key loading, and user config

# --- Check for jq ---
check_dependencies() {
  if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed."
    echo "   Install it: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
  fi
}

# --- Config ---
load_config() {
  CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/lbranch"
  CONFIG_FILE="$CONFIG_DIR/config"

  # Load API key: env var first, then repo .env as fallback
  if [ -z "$LINEAR_API_KEY" ]; then
    local GIT_ROOT
    GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    ENV_FILE="${GIT_ROOT:+$GIT_ROOT/.env}"
    if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
      LINEAR_API_KEY=$(grep -E '^LINEAR_API_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
  fi

  if [ -z "$LINEAR_API_KEY" ]; then
    echo "LINEAR_API_KEY not found."
    echo "   Set it as an environment variable: export LINEAR_API_KEY=lin_api_xxxxx"
    echo "   Or add it to your repo's .env file: LINEAR_API_KEY=lin_api_xxxxx"
    echo "   Generate one at: Linear > Settings > API > Personal API Keys"
    exit 1
  fi

  # Get username
  GIT_NAME=$(git config user.name 2>/dev/null | tr '[:upper:]' '[:lower:]' | awk '{print $1}')
  if [ -z "$GIT_NAME" ]; then
    if [ "$AUTO_MODE" = true ]; then
      GIT_NAME="ci"
    else
      echo -n "Your name (lowercase, first name): "
      read GIT_NAME
    fi
  fi
}

#!/bin/sh

jira_hook_branch_name() {
  if [ -n "${JIRA_HOOK_BRANCH_NAME:-}" ]; then
    printf '%s' "$JIRA_HOOK_BRANCH_NAME"
    return 0
  fi

  git symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

jira_hook_issue_key() {
  printf '%s' "$1" | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -n 1
}

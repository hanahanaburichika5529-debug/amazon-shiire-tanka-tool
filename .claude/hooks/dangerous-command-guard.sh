#!/usr/bin/env bash
# PreToolUse guard for Bash: force a confirmation prompt on destructive or
# credential-touching commands, regardless of where in the command the
# dangerous flag/word appears (allow-list prefix rules can't catch that).
cmd=$(jq -r '.tool_input.command // empty')

if printf '%s' "$cmd" | grep -qiE 'rm[[:space:]]+-[a-zA-Z]*(r[a-zA-Z]*f|f[a-zA-Z]*r)|--force|(^|[[:space:]])-f([[:space:]]|$)|force-with-lease|reset[[:space:]]+--hard|clean[[:space:]]+-[a-zA-Z]*f|\bsudo\b|\.env([[:space:]]|$)|credential|secret|api[_-]?key|password|id_rsa|\.pem\b|aws[[:space:]]+configure|chmod[[:space:]]+777'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"破壊的操作または機密情報を扱う可能性があるコマンドのため確認します"}}'
fi

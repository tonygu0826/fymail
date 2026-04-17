#!/usr/bin/env bash
# Cron wrapper — sets PATH, cd to fymail, runs the chosen step.
# Usage:  cron-wrapper.sh generate
#         cron-wrapper.sh send
set -euo pipefail
export PATH=/home/ubuntu/.nvm/versions/node/v22.22.1/bin:/usr/bin:/bin
cd /home/ubuntu/fymail
case "${1:-}" in
  generate) node scripts/linkedin-posts/generate.mjs ;;
  send)     node scripts/linkedin-posts/send.mjs ;;
  *)        echo "usage: $0 {generate|send}"; exit 2 ;;
esac

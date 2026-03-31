#!/bin/bash
# Apply template management updates to the server
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$TARGET_DIR/app/(app)/templates"

echo "Copying files to $TEMPLATES_DIR ..."

cp "$SCRIPT_DIR/templates/actions.ts" "$TEMPLATES_DIR/actions.ts"
cp "$SCRIPT_DIR/templates/delete-button.tsx" "$TEMPLATES_DIR/delete-button.tsx"
cp "$SCRIPT_DIR/templates/page.tsx" "$TEMPLATES_DIR/page.tsx"

echo "Done! Files updated:"
echo "  - actions.ts (added deleteTemplateAction)"
echo "  - delete-button.tsx (new client component)"
echo "  - page.tsx (vertical layout + edit/delete)"
echo ""
echo "Now run: npm run build && pm2 restart all"

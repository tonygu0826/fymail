#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Applying template updates ==="
TEMPLATES_DIR="$TARGET_DIR/app/(app)/templates"
cp "$SCRIPT_DIR/templates/actions.ts" "$TEMPLATES_DIR/actions.ts"
cp "$SCRIPT_DIR/templates/delete-button.tsx" "$TEMPLATES_DIR/delete-button.tsx"
cp "$SCRIPT_DIR/templates/template-creator.tsx" "$TEMPLATES_DIR/template-creator.tsx"
cp "$SCRIPT_DIR/templates/page.tsx" "$TEMPLATES_DIR/page.tsx"
echo "  templates: done"

echo "=== Applying contacts updates ==="
CONTACTS_DIR="$TARGET_DIR/app/(app)/contacts"
cp "$SCRIPT_DIR/contacts/actions.ts" "$CONTACTS_DIR/actions.ts"
cp "$SCRIPT_DIR/contacts/delete-button.tsx" "$CONTACTS_DIR/delete-button.tsx"
cp "$SCRIPT_DIR/contacts/page.tsx" "$CONTACTS_DIR/page.tsx"
echo "  contacts: done"

echo ""
echo "All files updated. Now run: npm run build && pm2 restart all"

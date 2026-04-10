#!/bin/bash
# check.sh - Automated sanity checks for Idle Pets RPG

TARGET="index.html"
ERRORS=0

echo "🔍 Starting checks on $TARGET..."

# 1. Check if file exists
if [ ! -f "$TARGET" ]; then
    echo "❌ Error: $TARGET not found!"
    exit 1
fi
echo "✔️  File exists."

# 2. Check for basic HTML5 structure
if ! grep -qi "<!DOCTYPE html>" "$TARGET"; then
    echo "❌ Error: Missing <!DOCTYPE html> declaration."
    ERRORS=$((ERRORS+1))
else
    echo "✔️  HTML5 DOCTYPE found."
fi

# 3. Check for the title
if ! grep -qi "<title>Idle Pets RPG</title>" "$TARGET"; then
    echo "❌ Error: Missing correct <title> tag."
    ERRORS=$((ERRORS+1))
else
    echo "✔️  Title is correct."
fi

# 4. Check if the core JS class exists
if ! grep -q "class IdleRPG" "$TARGET"; then
    echo "❌ Error: Core 'IdleRPG' JavaScript class is missing."
    ERRORS=$((ERRORS+1))
else
    echo "✔️  IdleRPG JavaScript class found."
fi

# 5. Check if offline/localStorage save key is present
if ! grep -q "idle_rpg_save" "$TARGET"; then
    echo "❌ Error: Save key 'idle_rpg_save' missing. Saving might be broken."
    ERRORS=$((ERRORS+1))
else
    echo "✔️  Save functionality present."
fi

# Final Evaluation
echo "------------------------------------"
if [ $ERRORS -gt 0 ]; then
    echo "💥 Check failed with $ERRORS error(s)."
    exit 1
else
    echo "✅ All checks passed successfully! Your game is ready."
    exit 0
fi

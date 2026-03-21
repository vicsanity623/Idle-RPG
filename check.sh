#!/bin/bash

echo "🚀 Running Idle-RPG Validation on GitHub Actions..."

# 1. Install dependencies quietly
echo "📦 Installing testing dependencies..."
python3 -m pip install --upgrade pip --quiet
python3 -m pip install pytest selenium --quiet

# 2. Run the test suite and capture the exit code
echo "🧪 Running E2E tests for main.js..."
python3 -m pytest tests/test_main.py -v
TEST_EXIT_CODE=$?

# 3. Evaluate the result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All checks passed! The pending level-up saves and loads successfully."
    exit 0
else
    echo "❌ Tests failed! Please review the logs above."
    exit 1
fi

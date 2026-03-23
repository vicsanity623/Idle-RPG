# 🛡️ PYOB ARCHITECTURAL PROTOCOL: SYSTEM INTEGRITY

### 🚨 CRITICAL FIX: DE-DUPLICATION (PRIORITY 0)
The project is currently crashing due to `SyntaxError` caused by duplicate declarations. Your primary mission is to restore stability.

- **TASK 0.1 (entities.js):** Search for all instances of `const HiveMind`. DELETE the duplicate definition at line 530 (or wherever it repeats). Ensure only ONE global `HiveMind` exists.
- **TASK 0.2 (index.html/main.js):** Search for duplicate declarations of the `UI` object. If `UI` is defined in both files, migrate the logic to `main.js` and remove it from `index.html`.
- **TASK 0.3 (Cleanup):** Scan the entire project for any logic where the bot has accidentally pasted "Bot Logs" or "Approval Tags" (e.g., "APPROVED Feature") into the actual source code. DELETE these leaks immediately.

### 🏗️ THE "NEVER DUPLICATE" PROTOCOL (MANDATORY)

- **ATOMIC REPLACEMENT:** When using XML `<EDIT>` blocks, you MUST identify the exact starting line and ending line of the existing code. You are authorized to replace the entire block. NEVER append a new version of a function below the old one.
- **VARIABLE SCOPE:** Before declaring a `const` or `let`, check the `SYMBOLS.json` ledger. If the variable name already exists, you MUST refactor the existing code instead of redeclaring it.
- **SINGLE SOURCE OF TRUTH (SSoT):** 
    - Each Class (Player, Enemy, HiveMind) must live in exactly ONE file.
    - If you move a class (e.g., Player to player.js), the very next action in that SAME iteration must be the total deletion of that class from the original file.

### 🛡️ HTML & UI HYGIENE
- **NO SCAFFOLDING:** It is a CRITICAL FAILURE to commit bot-to-human communication (e.g., "I have updated this file") into `.html` or `.js` files. 
- **ENCAPSULATION:** All Logic must be in `.js`. All Styles in `.css`. All structure in `.html`. Do not mix them unless strictly required for a new component.
- **VISUAL SANITY:** If the `Final Verification` step detects raw code text (like `window.addEventListener`) appearing on the game screen during the 10-second test, the patch must be REJECTED.

### 🚫 PROHIBITED ACTIONS
- DO NOT redeclare `const` or `let` variables that already exist in the global scope.
- DO NOT add "Placeholder" comments that duplicate existing logic.
- DO NOT open a PR if the `npm test` or `check.sh` detects a `SyntaxError`.

### 🏁 VERIFICATION GATE
Before proposing a PR, you MUST run this internal checklist:
1. "Did I leave the old version of the code in the file?" (If yes: Delete it).
2. "Is there more than one `const UI` or `const HiveMind` in the project?" (If yes: Consolidate).
3. "Is my code clean of any LIBRARIAN or bot-specific strings?" (If no: Purge them).

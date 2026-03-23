# 🛡️ PYOB ARCHITECTURAL PROTOCOL: IDLE-RPG

### 🎯 CRITICAL REPAIR MISSION (IMMEDIATE)

- **TASK 0 (FATAL ERROR FIX): Eliminate Duplicate Variable Declarations**
    - **Issue:** The project is crashing with `SyntaxError: Can't create duplicate variable: 'UI'` and `inventoryManager`.
    - **Action:** Scan `index.html` and all linked `.js` files. 
    - **Requirement:** Ensure `const UI` and `const inventoryManager` are declared EXACTLY ONCE in the entire execution context.
    - **Method:** If you find multiple blocks defining these variables, MERGE the logic into the first declaration and DELETE all subsequent duplicate blocks.
    - **Verification:** The browser console must be free of "duplicate variable" errors before this task is considered complete.

### 🏗️ GLOBAL CODING STANDARDS (NON-NEGOTIABLE)

- **ANTI-DUPLICATION PROTOCOL:**
    - BEFORE adding any code block, you MUST search the file for existing variable names, function names, or HTML IDs.
    - If a component (e.g., a "Skill Tree" div or a "UI" object) already exists, you MUST modify the existing code. NEVER append a second copy of the same logic.
    - **ID Uniqueness:** Never inject an HTML element with an ID that already exists in the DOM.

- **HTML & SCRIPT HYGIENE:**
    - 🚫 **NO LEAKS:** Never inject bot logs, "APPROVED" tags, or LIBRARIAN notes into `.html` or `.js` files. 
    - **SCAFFOLDING CHECK:** Any text appearing on the game screen that is not part of the game's intentional UI is a CRITICAL FAILURE.
    - **ENCAPSULATION:** All Javascript must reside within `<script type="module">` tags. Do not use inline `onclick` handlers if an `addEventListener` logic has already been implemented.

### 🚫 PROHIBITED ACTIONS
- DO NOT duplicate the "APPROVED Feature" section.
- DO NOT re-declare variables that are already in the global scope.
- DO NOT remove existing CSS variables unless they are being replaced by a centralized theme file.

### 🏁 VERIFICATION GATE
Every PR MUST pass these three manual checks by the bot:
1. **GREP CHECK:** Search for the string "const UI" and "const inventoryManager". If count > 1, the patch is REJECTED.
2. **SYNTAX CHECK:** Scan for `SyntaxError` or `ReferenceError` in the test logs.
3. **UI CHECK:** Verify that no raw code (e.g., `window.addEventListener`) is visible as plain text in the HTML body.

### 🚀 FEATURE BACKLOG (PRIORITY)
1. Implement `saveGame()` / `loadGame()` in `main.js`.
2. Add Particle System to `entities.js`.

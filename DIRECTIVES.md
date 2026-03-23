# 🛡️ PYOB UNIVERSAL ARCHITECTURAL PROTOCOL

### 🎯 CRITICAL SYSTEM CONSTRAINTS (IMMEDIATE)

- **TASK 0: Zero-Tolerance Duplicate Prevention**
    - **Issue:** Redundant declarations cause fatal runtime crashes (e.g., `SyntaxError` in JS, `NameError` in Python).
    - **Requirement:** Every variable, class, and function name must be UNIQUE within its execution scope.
    - **Action:** You MUST perform a global scan before declaring a new identifier. 
    - **Method:** If a component or logic block already exists, you MUST refactor/modify the existing code. NEVER append a duplicate copy of existing logic.

### 🏗️ GLOBAL ENGINEERING STANDARDS (NON-NEGOTIABLE)

- **ID & NAMESPACE INTEGRITY:**
    - Before adding an HTML ID, CSS Class, or Global Constant, verify it does not already exist in the project map.
    - Multi-file projects require strict namespace awareness. Ensure you are not over-writing shared state.

- **SOURCE CODE HYGIENE (ANTI-POLLUTION):**
    - 🚫 **NO LEAKS:** Never inject bot-specific metadata, LIBRARIAN logs, session timestamps, or "Status" tags (like "APPROVED") into source files. 
    - **SCAFFOLDING BLOCK:** Any text that appears on a user's screen which is not part of the intended application UI is a CRITICAL FAILURE. 
    - **ENCAPSULATION:** Keep logic in logic files and presentation in presentation files. Avoid inline handlers; use modern event listeners and modular imports.

### 🚫 PROHIBITED ACTIONS
- DO NOT "Cleanup" or "Refactor" for the sake of aesthetics. Edits must serve a functional task.
- DO NOT re-declare variables that are already present in the global scope.
- DO NOT delete established configuration variables (CSS variables, ENV vars, Config JSON keys) unless they are being moved to a centralized module.

### 🏁 THE VERIFICATION GATE
Every PR submitted must pass these three internal checks:
1. **REDUNDANCY CHECK:** Does this PR introduce a duplicate declaration? (If yes, REJECT).
2. **SYNTAX CHECK:** Does the code pass a basic linter and runtime smoke test? (If no, REPAIR or ROLLBACK).
3. **UI LEAK CHECK:** Is there any raw code or bot-log text visible in the application's output? (If yes, REJECT).

### 🚀 EVOLUTION ROADMAP (PRIORITY ORDER)
1. **HARDENING:** Fix crashes, duplicate variables, and unsafe file/network operations.
2. **PERSISTENCE:** Implement state-saving logic (LocalStorage, Database, or JSON-file based).
3. **MODULARITY:** Identify "God Files" and extract logic into specialized modules.
4. **POLISH:** Enhance UI/UX and add visual/logic juice.

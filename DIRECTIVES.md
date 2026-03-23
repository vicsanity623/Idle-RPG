# 🛡️ PYOB UNIVERSAL ARCHITECTURAL PROTOCOL (v2)

### 🌀 SYMBOLIC CASCADE & DEPENDENCY INTEGRITY (MANDATORY)

- **THE RIPPLE RULE:** You are strictly forbidden from making a "Breaking Change" to a logic block (function signature, class name, or global variable) without immediately auditing every file that references that symbol.
- **SIGNATURE CONTRACTS:** If you add a parameter, remove a parameter, or change the return type of a function, you MUST update all call-sites in the project.
- **BROKEN LINK PREVENTION:**
    - Before finishing an iteration, consult the **Symbolic Ledger** (AST Map).
    - If you move a class (e.g., `Player`) to a new file, you must immediately queue a task to update the `import` or `script` tags in all dependent files.
    - Failure to update a dependency is considered a **CRITICAL SYSTEM BREAK** and will trigger a full session rollback.

### 🎯 CRITICAL SYSTEM CONSTRAINTS (IMMEDIATE)

- **TASK 0: Zero-Tolerance Duplicate Prevention**
    - **Issue:** Redundant declarations cause fatal runtime crashes (e.g., `SyntaxError` in JS, `NameError` in Python).
    - **Requirement:** Every identifier (Variable, Class, Function) must be UNIQUE within its execution scope.
    - **Action:** Perform a global scan of the Project Map before declaring a new identifier.
    - **Method:** If logic already exists, you MUST refactor the existing code. NEVER append a second copy of the same logic.

### 🏗️ GLOBAL ENGINEERING STANDARDS (NON-NEGOTIABLE)

- **ID & NAMESPACE INTEGRITY:**
    - Before adding an HTML ID or CSS Class, verify it does not already exist in the global DOM.
    - Use strict encapsulation. No "shadowing" of variables from parent scopes.

- **SOURCE CODE HYGIENE (ANTI-POLLUTION):**
    - 🚫 **NO LEAKS:** Never inject bot-specific metadata, LIBRARIAN logs, session timestamps, or "Status" tags (like "APPROVED") into source files. 
    - **SCAFFOLDING BLOCK:** Any text visible on the application screen that is not part of the intended UI is a CRITICAL FAILURE. 
    - **MODULARITY:** Keep logic in logic files and presentation in presentation files. Use modern event listeners instead of inline handlers.

### 🚫 PROHIBITED ACTIONS
- DO NOT "Cleanup" or "Refactor" for aesthetics. Edits must serve a specific functional task.
- DO NOT re-declare variables that are already present in the global scope.
- DO NOT delete established configuration variables (CSS vars, ENV vars, Config JSON) unless they are being moved to a centralized module.

### 🏁 THE VERIFICATION GATE
Every PR submitted must pass these four internal checks:
1. **REDUNDANCY CHECK:** Does this PR introduce a duplicate declaration?
2. **SYNTAX CHECK:** Does the code pass a basic linter and runtime smoke test?
3. **DEPENDENCY CHECK:** Are all referenced symbols still valid and reachable? (If no, CASCADING REPAIR required).
4. **UI LEAK CHECK:** Is there any raw code or bot-log text visible in the application's output?

### 🚀 EVOLUTION ROADMAP (PRIORITY ORDER)
1. **HARDENING:** Fix crashes, duplicate variables, and broken cross-file links.
2. **PERSISTENCE:** Implement state-saving logic (LocalStorage, Database, or JSON).
3. **MODULARITY:** Identify "God Files" and perform AST-aware logic extraction.
4. **POLISH:** Enhance UI/UX and add visual juice.

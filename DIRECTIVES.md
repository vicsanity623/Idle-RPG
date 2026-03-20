# 🛡️ PYOB ARCHITECTURAL PROTOCOL: IDLE-RPG

### 🎯 MANDATORY MISSION OBJECTIVES (IN ORDER)

- **TASK 0 (CRITICAL - MODULARITY): Atomic Player Extraction**
    - **Step 1:** Create `player.js`. Use `export class Player`.
    - **Step 2:** DELETE the `Player` class from `entities.js` entirely. DO NOT leave a placeholder.
    - **Step 3:** Update `index.html` script tags to `<script type="module" src="player.js"></script>`. 
    - **Step 4:** All internal imports MUST use the `.js` extension (e.g., `import { Player } from './player.js'`).
    - **FAILURE CONDITION:** If the game has two definitions of 'Player', the patch is a failure.

- **TASK 1 (PERSISTENCE): Robust Save/Load System**
    - Implement `saveGame()` and `loadGame()` in `main.js`.
    - Use `localStorage` to persist the `PlayerData` object.
    - All storage logic MUST be wrapped in `try/catch` blocks.
    - Logic must verify data integrity before loading to prevent save-corruption crashes.

- **TASK 2 (VISUAL): Particle System Implementation**
    - Hook into the attack logic to trigger 3-5 particles on impact.
    - Use the existing `Particle` class. Ensure they are pushed to the global `particles` array.

- **TASK 3 (UI): Advanced Stat Overlay**
    - Create a clean overlay in `index.html` for Crit, Regen, and Defense.

### 🏗️ CODING & UI STANDARDS (NON-NEGOTIABLE)

- **ANTI-DUPLICATION:** NEVER duplicate existing HTML sections. If a section like "APPROVED Feature" exists, modify it; DO NOT add a second one.
- **HTML HYGIENE:** 
    - 🚫 **NO LEAKS:** Never inject "LIBRARIAN" logs, "Iteration" notes, or "AI Thoughts" into any `.html` or `.js` file.
    - 🚫 **NO SCAFFOLDING:** Any text that is not part of the game's UI is a critical error.
    - **ENCAPSULATION:** All JS must stay in `<script>` tags. All CSS must stay in `<style>` tags.
- **MODULARITY:** Keep `main.js` under 600 lines. Extract logic to new files as needed.
- **TYPE SAFETY:** Use clear naming or JSDoc. `const` is preferred over `let` unless the value changes.

### 🚫 PROHIBITED ACTIONS
- DO NOT perform "cleanup" patches (formatting/renaming) unless required for a Task.
- DO NOT touch the `.pyob` directory.
- DO NOT remove existing CSS variables.
- DO NOT commit any code where raw Javascript (e.g., `window.addEventListener`) is visible as text on the game screen.

### 🏁 VERIFICATION REQUIRMENT
Before finalizing a PR, you MUST verify:
1. Does the console show `SyntaxError`? (If yes, fix).
2. Is there duplicate HTML? (If yes, fix).
3. Is there "Bot-Talk" in the code? (If yes, fix).

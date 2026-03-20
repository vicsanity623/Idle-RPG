# CORE ARCHITECTURAL DIRECTIVES

### 🎯 IMMEDIATE MISSION OBJECTIVES

- **TASK 0 (CRITICAL - Refactor): Extract Player logic to dedicated module.**
    - **Action:** Move the `Player` class out of `entities.js` and into `player.js`.
    - **Dependency Fix:** Ensure `player.js` correctly imports required constants (like `TILE_SIZE`) and handles its relation to `PlayerData`.
    - **Import Sync:** Update `entities.js`, `main.js`, and `index.html` to correctly import the new `Player` module.
    - **Validation:** The game must successfully launch without "Player is not defined" errors.
- **TASK 1 (Persistence):** Implement a global `saveGame()` and `loadGame()` system in `main.js`. 
    - Use `localStorage` to save the `PlayerData` and other objects like dungeon depth level and save the object as a JSON string.
    - Ensure the game auto-loads on page refresh.
- **TASK 2 (Visual Juice):** Implement a projectile particle system.
    - When a player attacks, spawn 3-5 small particles using the `Particle` class in `entities.js`.
    - Particles should have randomized velocity and fade out over 0.5 seconds.
- **TASK 3 (UI Polish):** Create a dedicated "Stat Window" overlay in `index.html`.
    - It should display detailed stats: Crit Chance, HP Regen, and Attack Factor.

### CODING STANDARDS (MANDATORY)
- **MODULARITY:** Do NOT let `main.js` grow beyond 600 lines. If logic gets complex, extract it into a new file (e.g., `combat_engine.js` or `ui_manager.js`).
- **TYPE SAFETY:** Every new function MUST have JSDoc comments or clear variable naming to indicate types.
- **ERROR HANDLING:** All `localStorage` interactions must be wrapped in `try/catch` blocks to prevent browser crashes if the quota is full.

### PROHIBITED ACTIONS
- DO NOT perform "minor formatting cleanups" or "variable renaming" unless they are required to finish a Task listed above.
- DO NOT remove existing CSS variables in `index.html`.

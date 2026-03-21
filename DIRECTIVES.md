# 🛡️ PYOB ARCHITECTURAL PROTOCOL: IDLE-RPG

### 🎯 MANDATORY MISSION OBJECTIVES (IN ORDER)

- **TASK 1: Advanced Enemy AI & Aggro Balancing**
    - Implement a dynamic Aggro Radius. Enemies must detect the player and begin chasing from further away, reducing "idle" time.
    - Integrate "Flocking" or Separation logic. Enemies chasing the player must NOT perfectly overlap into a single sprite; they should fan out and surround the player.
    - Create distinct AI states: `IDLE`, `CHASING`, `WINDUP`, and `ATTACKING`. Enemies must telegraph their attacks (e.g., flashing red or pausing for 0.2s) before dealing damage.
    - Scale AI intelligence and aggression with `GameState.level` (Depth). Deeper floors should have enemies that move faster and have larger aggro detection zones.

- **TASK 2: Combat Polish & Player Feedback**
    - Sync the new Projectile system with the player's Attack Speed (`atkSpeed`) stat and Auto-Attack loop.
    - Add subtle camera Screen Shake when the player takes damage or lands a Critical Hit to elevate the game feel.

- **TASK 3: Performance Profiling**
    - Cap the maximum number of active particles on screen (e.g., max 200) to ensure the SOTA effects do not crash mobile browsers. 
    - Verify that the new Enemy AI distance calculations (using `Math.hypot`) are optimized and don't stall the main `requestAnimationFrame` loop.

### 🏗️ CODING & UI STANDARDS (NON-NEGOTIABLE)

- **ANTI-DUPLICATION:** NEVER duplicate existing HTML sections. If a section like "APPROVED Feature" exists, modify it; DO NOT add a second one.
- **HTML HYGIENE:** 
    - 🚫 **NO LEAKS:** Never inject "LIBRARIAN" logs, "Iteration" notes, or "AI Thoughts" into any `.html` or `.js` file.
    - 🚫 **NO SCAFFOLDING:** Any text that is not part of the game's UI is a critical error.
    - **ENCAPSULATION:** All JS must stay in `<script>` tags. All CSS must stay in `<style>` tags.
- **MODULARITY:** Keep `main.js` under 600 lines. Extract logic to new files as needed (e.g., move AI and Particle logic to a `combat.js` or `entities.js` file if necessary).
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
4. Do projectiles actually hit the enemies and trigger a visual burst? (If no, fix).

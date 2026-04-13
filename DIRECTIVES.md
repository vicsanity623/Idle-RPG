# 🌟 DIRECTIVES: Project "Endless Pal"

## 🎯 The Vision
To build the most addictive, browser-based, infinite-progression monster-catching RPG. It must seamlessly blend the deep, nostalgic mechanics of classic Pokémon games with modern Idle/Incremental progression, cutting-edge UI/UX, and state-of-the-art (SOTA) web performance.

This document serves as the master roadmap for our hybrid development team.

---

## 👥 Team Roles & Engagement Rules

### 🤖 **pyob (Autonomous Dev Bot)**
* **Domain:** Core Engine, Systems Architecture, Math/Scaling, Refactoring, Performance.
* **Directives:** 
  * Write clean, highly optimized, and modular ES6 JavaScript.
  * Ensure the infinite procedural generation scales without memory leaks.
  * Handle state management (saving/loading/offline calculations) flawlessly.
  * Implement complex logic systems (breeding algorithms, damage formulas, spatial hashing).
  * **Rule:** Never break the PWA compliance. The game must ALWAYS work 100% offline.

### 🧑‍🤝‍🧑 **Human Editors (Design & QA Leads)**
* **Domain:** UX/UI Design, Game Feel ("Juice"), Asset Curation, Balance, Playtesting.
* **Directives:**
  * Define the color palettes, layouts, and CSS glassmorphism/UI aesthetics.
  * Tune the game loops: Adjust EXP curves, Gold drops, and Catch rates to maximize player dopamine.
  * Curate or create visual assets (sprites, icons) and sound design (SFX/BGM).
  * Direct **pyob** by providing clear, scoped prompts based on these directives.

---

## 🚀 Phase 1: Core Architecture & Flow Upgrades
*Focus: Transitioning from a basic prototype to a fully-fledged game application.*

1. **Main Menu System**
   * **pyob:** Build a state machine for `[BOOT, MAIN_MENU, LOADING, PLAYING]`. Implement Save Slot management.
   * **Humans:** Design a cinematic Main Menu screen. Use a panning procedural background with the game title, a pulsing "Tap to Start", Options, and Credits.
2. **Loading Animations & Transitions**
   * **pyob:** Create an asset preloader that waits for all images/sounds before starting.
   * **Humans:** Design smooth CSS fade-ins, screen wipes (like classic wild encounters), and a visually pleasing loading spinner (e.g., a spinning Palball).
3. **Inventory & Paldex Tabs**
   * **pyob:** Expand the data structure to track Consumables, Evo Stones, and a "Seen/Caught" Paldex array.
   * **Humans:** Redesign the Sidebar. Add new tabs: `[Party]`, `[Inventory]`, `[Upgrades]`, `[Paldex]`, `[Settings]`. Use clean SVG icons for tabs.

---

## 🎨 Phase 2: Game Feel, "Juice", & Polish
*Focus: Making the game feel incredible to play through visual and auditory feedback.*

1. **Advanced Particle System**
   * **pyob:** Upgrade the particle engine. Add support for gravity, friction, color fading over life, and sprite-based particles (leaves, sparks, water drops).
   * **Humans:** Direct the creation of specific elemental impact effects (Fire explosions, Grass tornadoes, Water splashes) when attacking.
2. **Screen Shake & Hit Flashes**
   * **pyob:** Implement a camera-shake function linked to critical hits or high-damage attacks. Add a white-flash filter for taking damage.
3. **Animations**
   * **pyob:** Add simple sine-wave breathing animations to sprites in combat, and hop animations when moving.
   * **Humans:** Tune the speed and easing of UI elements (menus sliding in, HP bars smoothly draining, damage numbers popping and fading).
4. **Audio Integration**
   * **pyob:** Implement the Web Audio API to handle overlapping sound channels and background music looping.
   * **Humans:** Source nostalgic 8-bit/16-bit SFX (cursor moves, level ups, catch success/fail) and chill Lo-Fi beats for wandering.

---

## ⚔️ Phase 3: Deep Gameplay & Addicting Mechanics
*Focus: Retaining the player for hundreds of hours.*

1. **Biomes & World Expansion**
   * **pyob:** Expand the value noise algorithm to generate distinct Biomes (Lava Lands, Deep Ocean, Mystic Forest).
   * **Humans:** Define color palettes and spawn tables for each biome (e.g., Fire Pals only spawn in Lava Lands).
2. **Evolutions & Breeding**
   * **pyob:** Build a "Daycare" mechanic. Allow players to fuse two max-level Pals to create an Egg with inherited, mutated stats.
   * **Humans:** Design the Egg hatching screen and UI. Balance the stat inheritance multiplier.
3. **Dungeons & Boss Battles**
   * **pyob:** Generate instanced enclosed areas on the map. At the end, spawn a giant, high-stat "Boss Pal".
   * **Humans:** Make bosses drop rare permanent artifacts. Give them intimidating UI health bars that span the top of the screen.
4. **Enhanced Offline Progression (V2)**
   * **pyob:** Move offline calculation to a Web Worker if necessary. Give an exact breakdown of actions taken while away (e.g., "Defeated 42 LavaToads, Found 2 Evo Stones").
   * **Humans:** Design an incredibly satisfying "Welcome Back" modal featuring exploding loot boxes or raining gold coins.

---

## 🛠️ Operating Procedures for the Team

1. **Iterative Prompts (Humans -> pyob)**
   * When instructing pyob, do not ask for the entire game to be rewritten. 
   * *Good Prompt Example:* "pyob, please implement the Biome generation logic from Phase 3. Add a new property to `getTile()` that returns a biome string based on coordinates. Do not touch the combat logic."
2. **Asset Swapping (Humans)**
   * Replace the current `ctx.fillRect()` placeholder graphics by feeding base64 encoded images or loading local `.png` files into the canvas rendering loop.
3. **Continuous Deployment (CI/CD)**
   * Ensure `check.sh` and the GitHub Action pass before merging any code to the `main` branch. 
   * If pyob breaks the 3-file structure (if we decide to expand), update `check.sh` immediately to track the new files.

**Let's build the ultimate Idle Pal RPG.** 🚀

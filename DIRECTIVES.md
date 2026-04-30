## 1. Core Mission
The PYOB (Python/Open-Source Browser) team is tasked with refining the **Equip Screen**, **Inventory Management**, and **Player Progression Systems**. All updates must be production-ready, fully integrated, and bug-free.

---

## 2. Technical Constraints (The "No Rookie Mistakes" Rule)
To prevent incomplete PRs and broken builds, the following constraints are **mandatory**:

*   **Atomic Integration:** Never create a new `.js`, `.css`, or asset file without explicitly updating `index.html` to include the reference.
*   **Service Worker Compliance:** If a new file is added, you **must** update the `service-worker.js` cache list to ensure the game functions offline.
*   **No Placeholders:** Do not use comments like `// logic goes here`. All functions must be fully implemented.
*   **State Persistence:** Ensure any changes to equipment or inventory are reflected in the global state (e.g., `localStorage` or the game's state manager) so that progress survives a page refresh.

---

## 3. Focus Area A: Equip Screen & Inventory
The goal is a seamless, bug-free UI for managing items.

*   **Slot Validation:** Implement strict logic for character equip slots. 
    *   *Constraint:* Ensure "Head" items cannot be equipped in "Leg" slots. 
    *   *Constraint:* Ensure equipping an item automatically unequips the previous item in that slot and returns it to the inventory.
*   **Visual Feedback:** The Equip screen must reflect the current state of the player instantly. Use clear visual indicators for "Equipped" vs "In Inventory."
*   **Inventory Scaling:** Ensure the inventory UI can handle a large number of items (e.g., using a scroll view or pagination) without breaking the layout.

---

## 4. Focus Area B: Progression & Customization
Enhance player agency through advanced equipment features.

*   **Equipment Presets:**
    *   Implement a "Presets" system allowing players to save at least 3 distinct configurations of gear.
    *   Include a "Load Preset" function that checks if the items are still in the inventory before applying.
*   **Progression-Locked Customization:**
    *   Link specific equipment slots or customization options to player level or achievement milestones.
    *   UI must clearly show "Locked" states for items/slots not yet earned.

---

## 5. Development Workflow & PR Requirements
Before submitting a code block or PR, the AI must verify:

1.  **Dependency Check:** Are all imported modules actually present in the file structure?
2.  **HTML/SW Linkage:** Did I provide the code to update `index.html` and `service-worker.js`?
3.  **Conflict Resolution:** Does this new logic overwrite existing player stats? (It shouldn't—it should extend them).
4.  **Edge Cases:** What happens if the inventory is full? What happens if a player tries to equip an item they don't own?

---

## 6. Code Style & Architecture
*   **Modularity:** Keep logic for the "Equip Screen" separate from "Combat Logic."
*   **Naming Conventions:** Use descriptive variable names (e.g., `activeWeaponSlot` instead of `wSlot`).
*   **Comments:** Provide documentation for complex logic, especially for the "Preset" saving/loading functions.

***

**Instruction to LLM:** *Read these directives before every task. If a request contradicts these directives, flag the contradiction to the user before proceeding. Prioritize stability and integration over feature volume.*

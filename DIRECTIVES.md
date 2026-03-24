# 🛠️ DOF Engine - Directives (Phase: Advanced Loot & Rarity System)

**Assignee:** Pyob (Lead Engine Refactor & Systems Integration)
**Current Status:** Core Inventory and Equip systems are merged, stable, and fully functional. 

## 🎯 Epic Objective
Evolve the basic gear drop system into a highly rewarding, ARPG-style loot system (featuring Rarity Tiers, Stat Variance, and Dynamic Names). 

**Strict constraints for this Epic:**
1. **Pacing:** We must complete this epic within **8 iterations**. 
2. **Scope Limits:** Do not attempt to build everything at once. **One PR per edit.** Keep changes small, atomic, and highly focused.
3. **Stability:** Do not break existing logic. Do not create duplicate variables. Strictly maintain the **Single Constant Rule** at the top of the files.

---

## 🚀 Iteration 1 Focus: Implementing Gear Rarity Data

For this first PR, your **only goal** is to introduce Rarity Tiers to the background data generation. Do not touch the UI or visual rendering systems yet—focus purely on the math and data structure of the newly dropped items.

### 📋 Task Breakdown (`entities.js` only)

#### 1. Add Rarity Calculation to Gear Generation
* Locate the `generateRandomGear` function inside the global `const` block.
* Introduce a weighted RNG roll to determine the item's rarity when it drops.
  * **Common (60% chance):** 1.0x stat multiplier. Color: `#ffffff`
  * **Rare (25% chance):** 1.3x stat multiplier. Color: `#00e5ff`
  * **Epic (12% chance):** 1.6x stat multiplier. Color: `#bb86fc`
  * **Legendary (3% chance):** 2.0x stat multiplier. Color: `#ffd700`

#### 2. Update the Item Object Structure
* When constructing the `item` object in `generateRandomGear`, inject two new properties:
  * `rarity`: The string name of the rarity (e.g., 'Rare').
  * `color`: The hex code corresponding to the rarity.
* Apply the new rarity multiplier to the existing stat generation math (which currently relies on `randomFloat(0.8, 1.2)`).

#### 3. Dynamic Naming (Basic)
* Prepend the rarity to the generated item's name so we can verify it in the data.
* *Example:* Instead of `"Sword of Level 2"`, it should output `"Rare Sword of Level 2"`.

### ⚠️ Reviewer Notes for Pyob:
* **DO NOT** update the UI logic in `main.js` to draw these colors yet. That is Iteration 2.
* **DO NOT** change the `Loot` drop chance on enemy death. We are modifying the *quality* of the gear once it drops, not *if* it drops.
* Keep your variable declarations safe (`let`, not `const` inside local scopes) to prevent strict mode duplicate errors. 

***End of Directives. Please acknowledge and provide the patch for Iteration 1.***

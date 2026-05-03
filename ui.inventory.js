/**
 * UI Inventory Manager
 * Handles all inventory, equipment, and item detail UI logic.
 * Depends on the global `UI` object for utility functions and state.
 */
const UI_Inventory = {
    // --- State ---
    currentInvTab: 'equip', // This state is specific to inventory UI

    /**
     * Automatically equips the best gear from inventory for each slot.
     */
    autoEquip() {
        if (!window.Game || !Game.player) return;
        const p = Game.player;
        const slots = ['head', 'armor', 'hands', 'legs', 'cape', 'amulet', 'ring1', 'ring2'];
        const rarityMap = window.UI.RARITY_MAP; // Access from global UI

        let changed = false;
        slots.forEach(slot => {
            const current = p.equipment[slot];
            // Find best item in inventory for this slot
            const candidates = p.inventory.filter(i => i.type === 'equipment' && i.slot === slot);
            if (candidates.length === 0) return;

            candidates.sort((a, b) => {
                const scoreA = (a.stats.attack * 10) + (a.stats.defense * 15) + ((rarityMap[a.rarity] || 0) * 100);
                const scoreB = (b.stats.attack * 10) + (b.stats.defense * 15) + ((rarityMap[b.rarity] || 0) * 100);
                return scoreB - scoreA;
            });

            const best = candidates[0];
            const currentScore = current ? (current.stats.attack * 10) + (current.stats.defense * 15) + ((rarityMap[current.rarity] || 0) * 100) : -1;
            const bestScore = (best.stats.attack * 10) + (best.stats.defense * 15) + ((rarityMap[best.rarity] || 0) * 100);

            if (bestScore > currentScore) {
                // Swap
                p.equipment[slot] = best;
                p.inventory = p.inventory.filter(i => i !== best);
                if (current) p.inventory.push(current);
                changed = true;
            }
        });

        if (changed) {
            p.recalculateStats();
            this.updateInventory(p);
            window.UI.showLootNotification("Auto-Equipped Best Gear", "rarity-legendary");
        } else {
            window.UI.showLootNotification("Already wearing best gear", "rarity-common");
        }
    },

    /**
     * Sets the active inventory tab and updates the display.
     * @param {string} tab - The tab to activate ('equip' or 'consumables').
     * @param {Event} event - The click event from the tab button.
     */
    setInventoryTab(tab, event) {
        this.currentInvTab = tab;
        document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        if (window.Game && Game.player) this.updateInventory(Game.player);
    },

    /**
     * Sorts the inventory based on criteria and updates the display.
     * @param {string} criteria - The sorting criteria (e.g., 'rarity', 'value', 'attack').
     */
    sortInventory(criteria) {
        // The actual sorting logic is within updateInventory, this just triggers a refresh.
        if (window.Game && Game.player) this.updateInventory(Game.player);
    },

    /**
     * Purges lower quality items from the inventory.
     */
    purgeInventory() {
        if (!window.Game || !Game.player) return;
        const player = Game.player;
        const rarityMap = window.UI.RARITY_MAP;

        if (!confirm("Are you sure you want to delete all lower quality items? This cannot be undone.")) return;

        player.inventory = player.inventory.filter(item => {
            if (item.type !== 'equipment') return true; // Keep consumables and other types

            const equipped = player.equipment[item.slot];
            if (equipped) {
                // Keep if rarity is equal or higher than equipped
                return (rarityMap[item.rarity] || 0) >= (rarityMap[equipped.rarity] || 0);
            } else {
                // If nothing equipped in this slot, find the best item for this slot in inventory
                const sameSlotItems = player.inventory.filter(i => i.slot === item.slot);
                const maxRarity = Math.max(...sameSlotItems.map(i => rarityMap[i.rarity] || 0));
                // Keep if rarity is the highest for this slot among unequipped items
                return (rarityMap[item.rarity] || 0) === maxRarity;
            }
        });

        this.updateInventory(player);
        window.UI.showLootNotification("Purged lower quality gear", "rarity-common");
    },

    /**
     * Updates the inventory grid and equipment slots based on player data.
     * @param {object} player - The player object.
     */
    updateInventory(player) {
        const grid = document.getElementById('inv-grid');
        const goldTxt = document.getElementById('inv-gold');
        const mainGoldTxt = document.getElementById('main-gold-count');
        if (!grid || !player) return;

        if (goldTxt) goldTxt.innerText = window.UI.formatNumber(player.gold);
        if (mainGoldTxt) mainGoldTxt.innerText = window.UI.formatNumber(player.gold);

        let items = player.inventory.filter(item =>
            (this.currentInvTab === 'equip' ? item.type === 'equipment' : item.type !== 'equipment')
        );

        // Apply Sorting
        const sortCriteria = document.getElementById('inv-sort')?.value || 'rarity';
        const rarityMap = window.UI.RARITY_MAP;

        items.sort((a, b) => {
            if (sortCriteria === 'rarity') return (rarityMap[b.rarity] || 0) - (rarityMap[a.rarity] || 0);
            if (sortCriteria === 'value') return (b.value || 0) - (a.value || 0);
            if (sortCriteria === 'attack') return (b.stats?.attack || 0) - (a.stats?.attack || 0);
            return 0;
        });

        // Render Only Actual Items (No empty slots)
        const fragment = document.createDocumentFragment();
        items.forEach((item) => {
            const slot = document.createElement('div');
            slot.className = `inv-slot rarity-${item.rarity || 'common'}`;
            slot.setAttribute('role', 'button');
            slot.setAttribute('tabindex', '0');

            slot.innerHTML = `<div class="item-icon-text">${item.icon || item.name[0]}</div>`;
            if (item.stackable && item.count > 1) {
                slot.innerHTML += `<div class="count">${item.count}</div>`;
            }

            slot.onclick = () => this.handleItemClick(item);

            fragment.appendChild(slot);
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);

        // Update Equipment Slots
        let equipAtk = 0;
        let equipDef = 0;
        const defaultIcons = { head: 'ðª', armor: 'ð¡ï¸', hands: 'ð§¤', legs: 'ð', cape: 'ð¦¹', amulet: 'ð¿', ring1: 'ð', ring2: 'ð' };
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''} slot-icon`;
                if (item) {
                    el.innerHTML = `<div class="item-icon-text">${item.icon || item.name[0]}</div>`;
                    equipAtk += (item.stats.attack || 0);
                    equipDef += (item.stats.defense || 0);
                    el.onclick = () => this.showItemDetails(item);
                    el.oncontextmenu = (e) => e.preventDefault();
                } else {
                    el.innerHTML = `<div class="item-icon-text" style="opacity: 0.3;">${defaultIcons[slotName] || 'â'}</div>`;
                    el.onclick = null;
                    el.oncontextmenu = null;
                }
            }
        });

        const cp = Math.floor((player.level * 150) + (equipAtk * 10) + (equipDef * 15));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = window.UI.formatNumber(cp);

        const gearSummary = document.getElementById('gear-summary-stats');
        if (gearSummary) {
            let equipStats = {};
            Object.values(player.equipment).forEach(item => {
                if (item && item.stats) {
                    for (let key in item.stats) {
                        equipStats[key] = (equipStats[key] || 0) + item.stats[key];
                    }
                }
            });

            let summaryHTML = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; font-size:12px; margin-top:5px;">`;
            const statIcons = {
                attack: 'âï¸', defense: 'ð¡ï¸', maxHp: 'â¤ï¸', critRate: 'ð¥', moveSpeed: 'ð',
                atkSpeed: 'â¡', evade: 'ð¨', hpRecovery: 'ð'
            };
            let hasStats = false;
            for (let key in equipStats) {
                if (equipStats[key] > 0) {
                    hasStats = true;
                    const icon = statIcons[key] || 'â¨';
                    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    summaryHTML += `<span style="color:#a8e6cf">${icon} ${displayKey}: +${equipStats[key]}</span>`;
                }
            }
            if (!hasStats) {
                summaryHTML += `<span style="color:#888;">No Gear Stats</span>`;
            }
            summaryHTML += `</div>`;
            gearSummary.innerHTML = summaryHTML;
        }

        window.UI.updateStatsModal(player, cp, equipAtk, equipDef);
    },

    /**
     * Handles a click on an inventory item (equip, unequip, use).
     * @param {object} item - The item object that was clicked.
     */
    handleItemClick(item) {
        if (!window.Game || !Game.player) return;
        const p = Game.player;

        if (item.type === 'equipment') {
            const isEquipped = Object.values(p.equipment).includes(item);

            if (isEquipped) {
                p.equipment[item.slot] = null;
                p.inventory.push(item);
                window.UI.showLootNotification(`Unequipped ${item.name}`, 'rarity-common');
            } else {
                const oldItem = p.equipment[item.slot];
                p.equipment[item.slot] = item;
                p.inventory = p.inventory.filter(i => i !== item);
                if (oldItem) p.inventory.push(oldItem);

                let statText = item.stats.attack ? `ATK +${item.stats.attack}` : `DEF +${item.stats.defense}`;
                Game.spawnDamageText(p.x, p.y - 50, statText, "#f1c40f");
                window.UI.showLootNotification(`Equipped ${item.name}`, 'rarity-epic');
            }
            p.recalculateStats();
        } else if (item.name.includes("Health Potion")) {
            p.hp = Math.min(p.maxHp, p.hp + 200);
            Game.spawnDamageText(p.x, p.y - 50, "HP +200", "#2ecc71");
            item.count--;
            if (item.count <= 0) p.inventory = p.inventory.filter(i => i !== item);

        } else if (item.name.includes("Mana Potion")) {
            p.mp = Math.min(p.maxMp, p.mp + 100);
            Game.spawnDamageText(p.x, p.y - 50, "MP +100", "#3498db");
            item.count--;
            if (item.count <= 0) p.inventory = p.inventory.filter(i => i !== item);
        }

        this.updateInventory(p);
        Game.saveGame();
    },

    /**
     * Displays the item details modal for a given item.
     * @param {object} item - The item object to display details for.
     */
    showItemDetails(item) {
        const modal = document.getElementById('item-details-modal');
        if (!modal) return;

        document.getElementById('detail-name').innerText = item.name;
        document.getElementById('detail-name').className = `rarity-${item.rarity}`;
        document.getElementById('detail-icon').innerText = item.icon || item.name[0];

        let statStr = "";
        if (item.stats) {
            for (const [key, value] of Object.entries(item.stats)) {
                const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                statStr += `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;"><span style="color:#aaa;">${displayKey}</span> <span style="color:#2ecc71;">+${value}</span></div>`;
            }
        } else if (item.type === 'potion') {
            statStr = "Restores HP/MP instantly.";
        } else if (item.type === 'rune') {
            statStr = "A mysterious rune glowing with energy.";
        }
        document.getElementById('detail-stats').innerHTML = statStr;

        const compareBox = document.getElementById('detail-compare-box');
        const actionBtn = document.getElementById('detail-action-btn');

        actionBtn.onclick = null;
        actionBtn.style.display = 'block';

        if (item.type === 'equipment') {
            const isEquipped = Object.values(Game.player.equipment).includes(item);

            if (isEquipped) {
                compareBox.style.display = 'none';
                actionBtn.innerText = "Unequip";
                actionBtn.onclick = () => {
                    this.handleItemClick(item);
                    modal.style.display = 'none';
                };
            } else {
                actionBtn.innerText = "Equip";
                actionBtn.onclick = () => {
                    this.handleItemClick(item);
                    modal.style.display = 'none';
                };

                const currentEquipped = Game.player.equipment[item.slot];
                if (currentEquipped) {
                    compareBox.style.display = 'block';
                    document.getElementById('compare-icon').innerText = currentEquipped.icon || currentEquipped.name[0];
                    let compStr = "";
                    if (currentEquipped.stats) {
                        for (const [key, value] of Object.entries(currentEquipped.stats)) {
                            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            compStr += `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;"><span style="color:#888;">${displayKey}</span> <span style="color:#999;">+${value}</span></div>`;
                        }
                    }
                    document.getElementById('compare-stats').innerHTML = compStr;
                } else {
                    compareBox.style.display = 'none';
                }
            }
        } else {
            compareBox.style.display = 'none';
            if (item.type === 'potion') {
                actionBtn.innerText = "Use";
                actionBtn.onclick = () => {
                    this.handleItemClick(item);
                    modal.style.display = 'none';
                };
            } else {
                actionBtn.style.display = 'none';
            }
        }

        modal.style.display = 'block';
    },

    /**
     * Populates the inventory grid with empty placeholder slots.
     */
    populateInventoryPlaceholder() {
        const grid = document.getElementById('inv-grid');
        if (!grid) return;

        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 40; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            fragment.appendChild(slot);
        }
        grid.appendChild(fragment);
    },
};

// Expose UI_Inventory to the global window object for access by UI.js and other modules.
window.UI_Inventory = UI_Inventory;
/**
 * UI Manager
 * Standards: ES6+, DOM Safety, High-Performance Event Handling
 */

const UI = {
    // --- State ---
    joystick: { active: false, vector: { x: 0, y: 0 } },
    currentInvTab: 'equip',
    isLongPress: false,
    pressTimer: null,

    formatNumber(num) {
        if (num < 1000) return Math.floor(num).toString();
        const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
        let i = 0;
        let val = num;
        while (val >= 1000 && i < suffixes.length - 1) {
            val /= 1000;
            i++;
        }
        // Handle AA-ZZ style after Decillion
        if (i === suffixes.length - 1 && val >= 1000) {
            let letterIdx = Math.floor(Math.log(val / 1000) / Math.log(1000));
            const char1 = String.fromCharCode(65 + Math.floor(letterIdx / 26));
            const char2 = String.fromCharCode(65 + (letterIdx % 26));
            return (val / Math.pow(1000, letterIdx + 1)).toFixed(2) + char1 + char2;
        }
        return (val < 10 ? val.toFixed(2) : val.toFixed(1)) + suffixes[i];
    },

    autoEquip() {
        if (!window.Game || !Game.player) return;
        const p = Game.player;
        const slots = ['head', 'armor', 'hands', 'legs', 'cape', 'amulet', 'ring1', 'ring2'];
        const rarityMap = { legendary: 4, epic: 3, rare: 2, uncommon: 1.5, common: 1 };
        
        let changed = false;
        slots.forEach(slot => {
            const current = p.equipment[slot];
            // Find best item in inventory for this slot
            const candidates = p.inventory.filter(i => i.type === 'equipment' && i.slot === slot);
            if (candidates.length === 0) return;

            candidates.sort((a, b) => {
                const scoreA = (a.stats.attack * 10) + (a.stats.defense * 15) + (rarityMap[a.rarity] * 100);
                const scoreB = (b.stats.attack * 10) + (b.stats.defense * 15) + (rarityMap[b.rarity] * 100);
                return scoreB - scoreA;
            });

            const best = candidates[0];
            const currentScore = current ? (current.stats.attack * 10) + (current.stats.defense * 15) + (rarityMap[current.rarity] * 100) : -1;
            const bestScore = (best.stats.attack * 10) + (best.stats.defense * 15) + (rarityMap[best.rarity] * 100);

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
            this.showLootNotification("Auto-Equipped Best Gear", "rarity-legendary");
        } else {
            this.showLootNotification("Already wearing best gear", "rarity-common");
        }
    },

    init() {
        this.setupJoystick();
        this.bindEvents();
        this.populateInventoryPlaceholder();
        this.startPreviewAnimation();
        
        // Skill Overhaul States
        this.currentSkillCategory = 'unique';
        this.currentSkillPreset = 'A';
        this.selectedSkillId = 'spirit_spear';
    },

    startPreviewAnimation() {
        const canvas = document.getElementById('char-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        let timer = 0;

        const loop = (t) => {
            if (!window.Game || !Game.player) { requestAnimationFrame(loop); return; }
            const p = Game.player;
            const anim = p.animations.idle;
            const dt = 0.016; 
            timer += dt;
            
            if (timer >= anim.speed) {
                frame = (frame + 1) % anim.frames.length;
                timer = 0;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const img = anim.frames[frame];
            if (img && img.complete) {
                // Better Scaling for Preview: Fit inside the 200x240 canvas
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
                const w = img.width * scale;
                const h = img.height * scale;
                // Center it properly
                ctx.drawImage(img, canvas.width/2 - w/2, canvas.height/2 - h/2, w, h);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    bindEvents() {
        // --- Auto Attack Toggle ---
        const btnAuto = document.getElementById('btn-auto');
        const autoStatus = document.getElementById('auto-status');
        
        if (btnAuto) {
            btnAuto.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (!window.Game || !Game.player) return;
                Game.player.autoAttack = !Game.player.autoAttack;
                if (autoStatus) autoStatus.innerText = Game.player.autoAttack ? "ON" : "OFF";
                btnAuto.style.borderColor = Game.player.autoAttack ? "#0f0" : "#b89947";
            });
        }

        // --- Manual Attack Trigger ---
        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            btnAttack.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (window.Game && Game.player) {
                    Game.player.forceAttackTriggered = true;
                }
            });
        }
    },

    setupJoystick() {
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');
        if (!base || !knob) return; 

        base.style.touchAction = 'none';

        let rect, maxRadius, centerX, centerY;
        let pointerId = null;

        const cacheDimensions = () => {
            rect = base.getBoundingClientRect();
            maxRadius = rect.width / 2;
            centerX = rect.left + maxRadius;
            centerY = rect.top + maxRadius;
        };

        const updateKnob = (clientX, clientY) => {
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const distance = Math.hypot(dx, dy);

            if (distance > maxRadius) {
                dx = (dx / distance) * maxRadius;
                dy = (dy / distance) * maxRadius;
            }
            
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            this.joystick.vector.x = dx / maxRadius;
            this.joystick.vector.y = dy / maxRadius;
        };

        base.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pointerId = e.pointerId; 
            this.joystick.active = true;
            cacheDimensions();
            updateKnob(e.clientX, e.clientY); 
            base.setPointerCapture(pointerId);
        });

        base.addEventListener('pointermove', (e) => {
            if (this.joystick.active && e.pointerId === pointerId) {
                requestAnimationFrame(() => updateKnob(e.clientX, e.clientY));
            }
        });

        const resetJoy = (e) => {
            if (e.pointerId === pointerId) {
                this.joystick.active = false; 
                this.joystick.vector = { x: 0, y: 0 };
                knob.style.transform = `translate(-50%, -50%)`;
                base.releasePointerCapture(pointerId); 
                pointerId = null;
            }
        };

        base.addEventListener('pointerup', resetJoy);
        base.addEventListener('pointercancel', resetJoy);
        window.addEventListener('resize', () => { if (this.joystick.active) cacheDimensions(); });
    },

    toggleModal(id) { 
        const modal = document.getElementById(id);
        if (modal) modal.classList.toggle('hidden'); 
    },

    // --- Inventory System ---
    setInventoryTab(tab, event) {
        this.currentInvTab = tab;
        document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        if (window.Game && Game.player) this.updateInventory(Game.player);
    },

    sortInventory(criteria) {
        if (window.Game && Game.player) this.updateInventory(Game.player);
    },

    purgeInventory() {
        if (!window.Game || !Game.player) return;
        const player = Game.player;
        const rarityMap = { legendary: 4, epic: 3, rare: 2, common: 1 };

        if (!confirm("Are you sure you want to delete all lower quality items? This cannot be undone.")) return;

        player.inventory = player.inventory.filter(item => {
            if (item.type !== 'equipment') return true; // Keep consumables
            
            const equipped = player.equipment[item.slot];
            if (equipped) {
                // Delete if rarity is lower than equipped
                return rarityMap[item.rarity] >= rarityMap[equipped.rarity];
            } else {
                // If nothing equipped in this slot, find the best item for this slot in inventory
                const sameSlotItems = player.inventory.filter(i => i.slot === item.slot);
                const maxRarity = Math.max(...sameSlotItems.map(i => rarityMap[i.rarity] || 0));
                return rarityMap[item.rarity] === maxRarity;
            }
        });

        this.updateInventory(player);
        this.showLootNotification("Purged lower quality gear", "rarity-common");
    },

    updateInventory(player) {
        const grid = document.getElementById('inv-grid');
        const goldTxt = document.getElementById('inv-gold');
        const mainGoldTxt = document.getElementById('main-gold-count');
        if (!grid || !player) return;

        if (goldTxt) goldTxt.innerText = this.formatNumber(player.gold);
        if (mainGoldTxt) mainGoldTxt.innerText = this.formatNumber(player.gold);

        let items = player.inventory.filter(item => 
            (this.currentInvTab === 'equip' ? item.type === 'equipment' : item.type !== 'equipment')
        );

        // Apply Sorting
        const sortCriteria = document.getElementById('inv-sort')?.value || 'rarity';
        const rarityMap = { legendary: 4, epic: 3, rare: 2, common: 1 };
        
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
            
            const img = document.createElement('img');
            img.src = item.icon || 'assets/skill_attack.png';
            img.alt = item.name;
            img.onerror = () => img.style.display = 'none';
            
            slot.appendChild(img);
            slot.onclick = () => this.handleItemClick(item);
            
            fragment.appendChild(slot);
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);

        // Update Equipment Slots
        let equipAtk = 0;
        let equipDef = 0;
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''} slot-icon`;
                el.innerHTML = item ? `<div class="item-icon-text">${item.icon || item.name[0]}</div>` : '';
                if (item) {
                    equipAtk += (item.stats.attack || 0);
                    equipDef += (item.stats.defense || 0);
                    el.onclick = () => this.showItemDetails(item);
                    el.oncontextmenu = (e) => e.preventDefault();
                } else {
                    el.onclick = null;
                    el.oncontextmenu = null;
                }
            }
        });
        
        const cp = Math.floor((player.level * 150) + (equipAtk * 10) + (equipDef * 15));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = this.formatNumber(cp);

        const gearSummary = document.getElementById('gear-summary-stats');
        if (gearSummary) gearSummary.innerHTML = `<span style="color:#e74c3c">⚔️ +${equipAtk}</span> &nbsp;|&nbsp; <span style="color:#3498db">🛡️ +${equipDef}</span>`;

        this.updateStatsModal(player, cp, equipAtk, equipDef);
    },

    handleItemClick(item) {
        if (!window.Game || !Game.player) return;
        const p = Game.player;

        if (item.type === 'equipment') {
            const isEquipped = Object.values(p.equipment).includes(item);
            
            if (isEquipped) {
                p.equipment[item.slot] = null;
                p.inventory.push(item);
                this.showLootNotification(`Unequipped ${item.name}`, 'rarity-common');
            } else {
                const oldItem = p.equipment[item.slot];
                p.equipment[item.slot] = item;
                p.inventory = p.inventory.filter(i => i !== item);
                if (oldItem) p.inventory.push(oldItem);
                
                let statText = item.stats.attack ? `ATK +${item.stats.attack}` : `DEF +${item.stats.defense}`;
                Game.spawnDamageText(p.x, p.y - 50, statText, "#f1c40f");
                this.showLootNotification(`Equipped ${item.name}`, 'rarity-epic');
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

    // --- Modals ---
    showItemDetails(item) {
        const modal = document.getElementById('item-details-modal');
        if (!modal) return;
        
        document.getElementById('detail-name').innerText = item.name;
        document.getElementById('detail-name').className = `rarity-${item.rarity}`;
        document.getElementById('detail-icon').innerText = item.icon || item.name[0];
        
        let statStr = "";
        if (item.stats) {
            for (const [key, value] of Object.entries(item.stats)) {
                // Capitalize key
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

    // --- Stats & Quests ---
    updateStatsModal(player, cp, equipAtk, equipDef = 0) {
        const list = document.getElementById('stats-list');
        if (!list) return;

        // Save scroll position of the scrollable area
        const scrollContainer = list.querySelector('.stats-scroll-area');
        const lastScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        
        const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
        const mpPct = Math.max(0, Math.min(100, (player.mp / player.maxMp) * 100));
        const xpPct = Math.max(0, Math.min(100, (player.xp / player.maxXp) * 100));

        // Stat Groups Config
        const statConfig = [
            {
                title: "ATK",
                color: "#d4af37",
                stats: [
                    { key: "attackSpeed", label: "ATK Speed", pct: true },
                    { key: "skillSpeed", label: "Skill Speed", pct: true },
                    { key: "attack", label: "ATK", pct: false },
                    { key: "magicAtk", label: "Magic ATK", pct: false },
                    { key: "weaponAtk", label: "Weapon ATK", pct: false },
                    { key: "fatalityRate", label: "Fatality Rate", pct: true },
                    { key: "critRate", label: "CRIT Rate", pct: true },
                    { key: "magicCritRate", label: "Magic CRIT Rate", pct: true },
                    { key: "bashRate", label: "Bash Rate", pct: true },
                    { key: "accuracy", label: "Accuracy", pct: false },
                    { key: "magicAccuracy", label: "Magic Accuracy", pct: false }
                ]
            },
            {
                title: "DEF",
                color: "#d4af37",
                stats: [
                    { key: "maxHp", label: "Max HP", pct: false },
                    { key: "defense", label: "DEF", pct: false },
                    { key: "basicAtkRes", label: "Basic ATK DMG RES Rate", pct: true },
                    { key: "skillDmgRes", label: "Skill DMG RES Rate", pct: true },
                    { key: "finalDmgRes", label: "Final DMG RES Rate", pct: true },
                    { key: "dmgReduction", label: "DMG Reduction", pct: false },
                    { key: "evade", label: "Evade", pct: false },
                    { key: "block", label: "Block", pct: false }
                ]
            },
            {
                title: "Support",
                color: "#d4af37",
                stats: [
                    { key: "moveSpeed", label: "Movement Speed", pct: true },
                    { key: "cdReduction", label: "CD Reduction", pct: true },
                    { key: "hpRecovery", label: "HP Recovery", pct: false },
                    { key: "hpPotionRcvRate", label: "HP Potion RCV Rate", pct: true },
                    { key: "maxHpPotionCap", label: "Max HP Potion Capacity", pct: false },
                    { key: "mpRecovery", label: "MP Recovery", pct: false }
                ]
            },
            {
                title: "Immobile",
                color: "#d4af37",
                stats: [
                    { key: "immobileHitRate", label: "Immobile Hit Rate", pct: true },
                    { key: "immobileRes", label: "Immobile RES", pct: true }
                ]
            },
            {
                title: "Status Effect",
                color: "#d4af37",
                stats: [
                    { key: "statusTimeInc", label: "Status Effect Time INC Rate", pct: true },
                    { key: "statusTimeDec", label: "Status Effect Time DEC Rate", pct: true },
                    { key: "statusHitRate", label: "Status Effect Hit Rate", pct: true },
                    { key: "statusRes", label: "Status Effect RES", pct: true }
                ]
            },
            {
                title: "Weakening",
                color: "#d4af37",
                stats: [
                    { key: "weakTimeInc", label: "Weakened Time INC Rate", pct: true },
                    { key: "weakTimeDec", label: "Weakened Time DEC Rate", pct: true },
                    { key: "weakHitRate", label: "Weakened Hit Rate", pct: true },
                    { key: "weakRes", label: "Weakened RES", pct: true }
                ]
            },
            {
                title: "Misc",
                color: "#d4af37",
                stats: [
                    { key: "maxQuests", label: "Max Quests", pct: false },
                    { key: "maxDailyCorps", label: "Max Daily Special Corps", pct: false }
                ]
            }
        ];

        let statListHTML = '';
        statConfig.forEach(group => {
            statListHTML += `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: ${group.color}; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin: 0 0 10px 0; font-size: 16px; letter-spacing: 0.5px;">${group.title}</h3>
            `;
            group.stats.forEach(stat => {
                const val = player.stats[stat.key] || 0;
                const displayVal = stat.pct ? `${val}%` : val;
                statListHTML += `
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
                        <span style="color: #888;">${stat.label}</span>
                        <span style="color: #ddd; font-weight: bold;">${displayVal}</span>
                    </div>
                `;
            });
            statListHTML += `</div>`;
        });

        list.innerHTML = `
            <div class="stats-scroll-area" style="background: rgba(20,20,25,0.95); padding:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); box-shadow: inset 0 0 20px rgba(0,0,0,0.5); max-height: 70vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 20px; position: sticky; top: -20px; background: rgba(20,20,25,0.95); z-index: 10;">
                    <div>
                        <h2 style="color:#d4af37; margin:0; text-shadow: 0 0 10px rgba(212,175,55,0.5); letter-spacing: 1px; font-size: 20px;">Level ${player.level} Ninja</h2>
                        <div style="font-size: 14px; color: #aaa; margin-top: 4px;">CP: <span style="color: #f1c40f; font-weight: bold;">${this.formatNumber(cp)}</span></div>
                    </div>
                    <div style="text-align: right; font-size: 12px; color: #bbb; line-height: 1.6;">
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px; margin-bottom: 3px;">
                            <span style="width: 20px; text-align: left; color: #e74c3c; font-weight: bold;">HP</span>
                            <div style="width: 100px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;"><div style="width: ${hpPct}%; background: #e74c3c; height: 100%;"></div></div>
                            <span style="width: 70px; text-align: right;">${Math.floor(player.hp)} / ${player.maxHp}</span>
                        </div>
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px; margin-bottom: 3px;">
                            <span style="width: 20px; text-align: left; color: #3498db; font-weight: bold;">MP</span>
                            <div style="width: 100px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;"><div style="width: ${mpPct}%; background: #3498db; height: 100%;"></div></div>
                            <span style="width: 70px; text-align: right;">${Math.floor(player.mp)} / ${player.maxMp}</span>
                        </div>
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px;">
                            <span style="width: 20px; text-align: left; color: #9b59b6; font-weight: bold;">XP</span>
                            <div style="width: 100px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;"><div style="width: ${xpPct}%; background: #9b59b6; height: 100%;"></div></div>
                            <span style="width: 70px; text-align: right;">${Math.floor(player.xp)} / ${player.maxXp}</span>
                        </div>
                    </div>
                </div>
                ${statListHTML}
            </div>
        `;

        // Restore scroll position
        const newScrollArea = list.querySelector('.stats-scroll-area');
        if (newScrollArea) newScrollArea.scrollTop = lastScrollTop;
    },

    setSkillCategory(cat) {
        this.currentSkillCategory = cat;
        document.querySelectorAll('.cat-tab').forEach(btn => btn.classList.toggle('active', btn.innerText.toLowerCase().includes(cat)));
        if (window.Game && Game.player) this.updateSkillsModal(Game.player);
    },

    setSkillPreset(preset) {
        this.currentSkillPreset = preset;
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.toggle('active', btn.innerText === preset));
        // Reset skills to active/inactive based on preset (simplified for now: presets just visual)
        if (window.Game && Game.player) this.updateSkillsModal(Game.player);
    },

    selectSkill(id) {
        this.selectedSkillId = id;
        if (window.Game && Game.player) this.updateSkillsModal(Game.player);
    },

    toggleSkillActive(id) {
        if (!window.Game || !Game.player) return;
        const skill = Game.player.skills.find(s => s.id === id);
        if (skill) {
            skill.active = !skill.active;
            Game.player.recalculateStats();
            this.updateSkillsModal(Game.player);
        }
    },

    triggerSkillSlot(slotIdx) {
        if (!window.Game || !Game.player) return;
        const activeSkills = Game.player.skills.filter(s => s.active && s.category === 'Active');
        const skillPool = activeSkills.filter((s, i) => i % 3 === slotIdx);
        const nextSkill = skillPool.find(s => s.timer <= 0 && Game.player.mp >= s.mpCost) || skillPool[0];
        
        if (nextSkill) {
            Game.castSkill(nextSkill.id);
        }
    },

    updateSkillsModal(player) {
        const itemList = document.getElementById('skills-item-list');
        const detailPanel = document.getElementById('skill-detail-panel');
        if (!itemList || !detailPanel || !player.skills) return;

        // Optimized Rendering: Only update if modal is visible to prevent lag
        if (document.getElementById('skills-modal').classList.contains('hidden')) return;

        // 1. Render Sidebar List
        let gridHTML = '';
        player.skills.forEach(skill => {
            const isSelected = this.selectedSkillId === skill.id;
            const isActive = skill.active;
            const rarityColor = skill.rarity === 'epic' ? '#9b59b6' : skill.rarity === 'rare' ? '#3498db' : '#2ecc71';
            
            gridHTML += `
                <div class="skill-card ${isSelected ? 'selected' : ''} ${isActive ? 'active-skill' : ''}" 
                     onclick="UI.selectSkill('${skill.id}')"
                     style="border-bottom: 2px solid ${rarityColor}">
                    <span style="z-index:2;">${skill.icon}</span>
                    <div class="skill-rarity-tag" style="background:${rarityColor}">${skill.rarity}</div>
                </div>
            `;
        });
        itemList.innerHTML = gridHTML;

        // 2. Render Detail View
        const skill = player.skills.find(s => s.id === this.selectedSkillId) || player.skills[0];
        if (this.currentSkillCategory === 'enhancement') {
            detailPanel.innerHTML = `
                <div class="enhancement-view">
                    <h2 class="detail-title">Target to Enhance</h2>
                    <div class="ritual-backdrop">
                        <div class="ritual-inner"></div>
                        <div class="enhance-target-icon">${skill.icon}</div>
                    </div>
                    <div style="text-align:left; width:100%; max-width:400px; background:rgba(0,0,0,0.4); padding:20px; border-radius:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <span style="color:#888;">Skill Level</span>
                            <span style="color:white; font-weight:bold;">+${skill.level} <span style="color:var(--color-gold-glow); margin-left:10px;">▶ +${skill.level + 1}</span></span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#888;">Skill DMG</span>
                            <span style="color:white; font-weight:bold;">${Math.floor(skill.damageMult * 100)}% <span style="color:var(--color-gold-glow); margin-left:10px;">▶ ${Math.floor((skill.damageMult + 0.2) * 100)}%</span></span>
                        </div>
                    </div>
                    <p style="color:#e74c3c; margin-top:30px; font-weight:bold;">Insufficient materials required for Enhancement.</p>
                    <button class="menu-btn" style="background:#333; color:#666; margin-top:10px;" disabled>Skill Enhancement 💰 375,000</button>
                </div>
            `;
        } else {
            detailPanel.innerHTML = `
                <div class="skill-detail-view">
                    <div class="detail-icon-large">${skill.icon}</div>
                    <h2 class="detail-title">+${skill.level} ${skill.name}</h2>
                    <div class="detail-rarity">${skill.rarity} | ${skill.category}</div>
                    <p class="detail-desc">${skill.desc}</p>
                    
                    <div class="detail-stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">MP Cost</div>
                            <div class="stat-val">${skill.mpCost}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Cooldown</div>
                            <div class="stat-val">${skill.cooldown}s</div>
                        </div>
                    </div>

                    <button class="activate-btn ${skill.active ? 'active' : ''}" onclick="UI.toggleSkillActive('${skill.id}')">
                        ${skill.active ? 'ACTIVE' : 'ACTIVATE'}
                    </button>
                </div>
            `;
        }
    },

    updatePlayerStats(player) {
        if (!player) return;

        // Quests Box Sync
        const questBox = document.getElementById('quest-tracker');
        if (!window.Game || !Game.activeQuest) {
            if (questBox) questBox.style.display = 'none';
        } else if (questBox) {
            questBox.style.display = 'block';
            
            const qTitle = questBox.querySelector('.quest-title');
            const qObj = questBox.querySelector('.quest-obj');
            
            if (qTitle) qTitle.innerText = Game.activeQuest.title;
            if (qObj) qObj.innerHTML = `${Game.activeQuest.obj} (<span id="quest-count">${Game.kills}</span>/${Game.activeQuest.target})`;
            
            if (Game.kills >= Game.activeQuest.target) {
                questBox.classList.add('quest-complete-glow');
                const qContent = questBox.querySelector('#quest-content');
                if (qContent) {
                    qContent.innerHTML = `<h4 class="quest-title" style="color:#fff;">[DONE] Click to Claim!</h4><p class="quest-obj">Reward: ${Game.activeQuest.g} Gold & ${Game.activeQuest.xp} XP</p>`;
                }
                const ind = document.getElementById('auto-quest-indicator');
                if (ind) ind.classList.add('hidden');
                
                questBox.onclick = () => this.claimQuest(player);
            } else {
                questBox.classList.remove('quest-complete-glow');
                questBox.onclick = () => this.startAutoQuest();
            }
        }

        // Potion Counts Update
        const hpPot = player.inventory.find(i => i.name === "Health Potion");
        const mpPot = player.inventory.find(i => i.name === "Mana Potion");
        const hpLabel = document.getElementById('hp-potion-count');
        const mpLabel = document.getElementById('mp-potion-count');
        if (hpLabel) hpLabel.innerText = hpPot ? hpPot.count : 0;
        if (mpLabel) mpLabel.innerText = mpPot ? mpPot.count : 0;
        
        const mainGoldTxt = document.getElementById('main-gold-count');
        if (mainGoldTxt) mainGoldTxt.innerText = this.formatNumber(player.gold);
        
        // Skills Action Bar (Dynamic Sync)
        if (player.skills) {
            const skillContainer = document.getElementById('skill-buttons-container');
            if (skillContainer) {
                const activeSkills = player.skills.filter(s => s.active && (s.category === 'Active' || s.category === 'Combat'));
                
                // 1. Remove buttons for skills no longer active
                const currentButtons = skillContainer.querySelectorAll('.action-slot.skill');
                currentButtons.forEach(btn => {
                    const skillId = btn.id.replace('hud-skill-', '');
                    if (!activeSkills.find(s => s.id === skillId)) {
                        btn.remove();
                    }
                });

                // 2. Add or update buttons for active skills
                activeSkills.forEach((skill) => {
                    let btn = document.getElementById(`hud-skill-${skill.id}`);
                    if (!btn) {
                        btn = document.createElement('button');
                        btn.id = `hud-skill-${skill.id}`;
                        btn.className = `action-slot skill`;
                        btn.onclick = () => Game.castSkill(skill.id);
                        btn.innerHTML = `
                            <div class="skill-icon-wrap">${skill.icon}</div>
                            <span class="skill-label">${skill.name.toUpperCase()}</span>
                            <div class="cooldown-overlay"></div>
                        `;
                        skillContainer.appendChild(btn);
                    }
                    
                    const overlay = btn.querySelector('.cooldown-overlay');
                    const pct = skill.timer > 0 ? (skill.timer / skill.cooldown) * 100 : 0;
                    if (overlay) {
                        // Use CSS variable for the conic-gradient sweep
                        overlay.style.setProperty('--cd-pct', `${pct}%`);
                    }
                    btn.classList.toggle('locked', skill.timer > 0 || player.mp < skill.mpCost);
                });
            }

            // Responsiveness fix: Only update modal if open
            if (!document.getElementById('skills-modal').classList.contains('hidden')) {
                this.updateSkillsModal(player);
            }
        }

        // Health & Mana Bars
        const hpFill = document.getElementById('hp-fill');
        const mpFill = document.getElementById('mp-fill');
        const hpTxt = document.getElementById('hp-text');
        if (hpFill) hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + "%";
        if (mpFill) mpFill.style.width = Math.max(0, (player.mp / player.maxMp) * 100) + "%";
        if (hpTxt) hpTxt.innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    },

    updateXpBar(player) {
        if (!player) return;
        const fill = document.getElementById('exp-fill');
        const text = document.getElementById('exp-text');
        const badge = document.getElementById('player-level');
        
        if (fill) {
            const pct = (player.xp / player.maxXp) * 100;
            fill.style.width = pct + "%";
            if (text) text.innerText = `EXP ${pct.toFixed(3)}%`;
        }
        if (badge) badge.innerText = player.level;
    },

    // --- Quest Handlers ---
    startAutoQuest() {
        if (!window.Game || !Game.player) return;
        Game.player.autoQuest = !Game.player.autoQuest;
        
        const indicator = document.getElementById('auto-quest-indicator');
        if (indicator) indicator.classList.toggle('hidden', !Game.player.autoQuest);
        
        this.showLootNotification(Game.player.autoQuest ? "Auto-Quest Started" : "Auto-Quest Stopped", "rarity-rare");
    },

    claimQuest(player) {
        if (!window.Game || !Game.activeQuest) return;
        
        player.gainXp(Game.activeQuest.xp);
        player.gold += Game.activeQuest.g;
        
        this.showLootNotification(`Quest Complete! +${Game.activeQuest.g} Gold`, "rarity-legendary");
        
        Game.kills = 0; 
        Game.activeQuest = null; 
        
        const questBox = document.getElementById('quest-tracker');
        if (questBox) questBox.style.display = 'none';
        
        this.updateInventory(player);
        Game.saveGame(); 
    },

    // --- Misc UI Overlay ---
    showLootNotification(msg, rarity) {
        const container = document.getElementById('loot-notification-container');
        if (!container) return;
        
        const el = document.createElement('div');
        el.className = `loot-msg ${rarity}`;
        el.innerText = msg;
        container.appendChild(el);
        
        setTimeout(() => el.remove(), 3500);
    },

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

    // --- Map & Realms Modal ---
    setMapTab(tab) {
        this.currentMapTab = tab;
        document.querySelectorAll('#map-content .tab').forEach(btn => btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tab)));
        this.updateMapModal();
    },

    updateMapModal() {
        const sidebar = document.getElementById('realm-sidebar');
        const view = document.getElementById('map-view');
        if (!sidebar || !view || !window.Realms) return;

        // Render Sidebar
        sidebar.innerHTML = '<h4 style="color:#d4af37; margin-bottom:10px;">Travel Realms</h4>';
        Realms.list.forEach((realm, idx) => {
            const btn = document.createElement('button');
            const isActive = Realms.currentRealm === idx;
            btn.className = `menu-btn ${isActive ? 'active' : ''}`;
            btn.style.width = '100%';
            btn.style.marginBottom = '8px';
            btn.style.textAlign = 'left';
            btn.style.padding = '12px';
            btn.style.background = isActive ? 'rgba(184, 153, 71, 0.2)' : 'rgba(30, 30, 30, 0.5)';
            btn.style.border = isActive ? '1px solid var(--color-gold)' : '1px solid #444';
            btn.style.borderLeft = `4px solid ${realm.color}`;
            btn.style.borderRadius = '6px';
            btn.style.transition = 'all 0.2s ease';
            
            btn.innerHTML = `
                <div style="font-weight:bold; color:${isActive ? '#fff' : '#aaa'};">${realm.name}</div>
                <div style="font-size:10px; color:${isActive ? 'var(--color-gold-glow)' : '#666'};">Difficulty: ${(realm.difficulty * 100).toFixed(0)}%</div>
            `;
            btn.onclick = () => {
                Realms.setRealm(idx);
                this.updateMapModal();
            };
            sidebar.appendChild(btn);
        });

        // Render Main View
        if (this.currentMapTab === 'boss') {
            view.innerHTML = `
                <div style="text-align:center; color:white;">
                    <img src="assets/sleepless_ghost.png" style="width:300px; filter: drop-shadow(0 0 20px #9b59b6); margin-bottom:20px;">
                    <h2>The Sleepless Ghost Lord</h2>
                    <p style="color:#aaa; max-width:400px; margin:10px auto;">Challenge the spirit lord in a gladiator battle. Earn unique ranks and test your damage!</p>
                    <button class="menu-btn" style="background:#8e44ad; color:white; font-size:18px; padding:12px 30px; margin-top:20px; border:none; box-shadow: 0 4px 15px rgba(142, 68, 173, 0.4);" onclick="Game.enterBossArena()">
                        CHALLENGE BOSS <br>
                        <span style="font-size:12px; opacity:0.8;">💰 ${Game.getBossEntryCost().toLocaleString()} Gold</span>
                    </button>
                    <div style="margin-top:30px; display:flex; gap:20px; justify-content:center;">
                        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                            <div style="font-size:12px; color:#888;">Highest Rank</div>
                            <div style="font-size:20px; color:#f1c40f;">${Game.player.bossRank || 'Unranked'}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                            <div style="font-size:12px; color:#888;">Max Damage</div>
                            <div style="font-size:20px; color:#e74c3c;">${(Game.player.maxBossDmg || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            view.innerHTML = `
                <div style="position:relative; width:100%; height:100%; background:url('assets/grass.png'); background-size:100px;">
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:rgba(255,255,255,0.2); font-size:40px; font-weight:bold; pointer-events:none;">${Realms.list[Realms.currentRealm].name}</div>
                    <div style="position:absolute; top:${Game.player.y/Game.WORLD_SIZE*100}%; left:${Game.player.x/Game.WORLD_SIZE*100}%; color:lime; font-size:24px;">📍</div>
                </div>
            `;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    UI.init();
    // Add minimap click listener
    const mm = document.getElementById('minimap-container');
    if (mm) mm.onclick = () => {
        UI.toggleModal('map-modal');
        UI.updateMapModal();
    };
});

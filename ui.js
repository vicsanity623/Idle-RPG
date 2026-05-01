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

    init() {
        this.setupJoystick();
        this.bindEvents();
        this.populateInventoryPlaceholder();
    },

    bindEvents() {
        // --- Auto Attack Toggle ---
        const btnAuto = document.getElementById('btn-auto');
        const autoStatus = document.getElementById('auto-status');
        
        if (btnAuto) {
            btnAuto.addEventListener('click', () => {
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
                if (window.Game && Game.player && Game.player.forceAttack) {
                    Game.player.forceAttack();
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

    updateInventory(player) {
        const grid = document.getElementById('inv-grid');
        const goldTxt = document.getElementById('inv-gold');
        if (!grid || !player) return;

        grid.innerHTML = '';
        if (goldTxt) goldTxt.innerText = player.gold.toLocaleString();

        const items = player.inventory.filter(item => 
            (this.currentInvTab === 'equip' ? item.type === 'equipment' : item.type !== 'equipment')
        );

        // Render Exactly 40 Slots
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 40; i++) {
            const item = items[i];
            const slot = document.createElement('div');
            
            if (item) {
                slot.className = `inv-slot rarity-${item.rarity} slot-icon`;
                slot.innerHTML = `<div class="item-label">${item.name[0]}</div>`; 
                if (item.count > 1) slot.innerHTML += `<span class="count">${item.count}</span>`;
                
                // Tooltip & Click Logic
                slot.onpointerdown = (e) => {
                    this.isLongPress = false;
                    this.pressTimer = setTimeout(() => { this.isLongPress = true; this.showTooltip(item, e); }, 400); 
                };
                slot.onpointerup = () => {
                    clearTimeout(this.pressTimer);
                    this.hideTooltip();
                    if (!this.isLongPress) this.handleItemClick(item);
                };
                slot.onpointerleave = () => { clearTimeout(this.pressTimer); this.hideTooltip(); };
                slot.oncontextmenu = (e) => e.preventDefault();
            } else {
                slot.className = 'inv-slot';
            }
            fragment.appendChild(slot);
        }
        grid.appendChild(fragment);

        // Update Equipment Slots
        let equipAtk = 0;
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''} slot-icon`;
                el.innerHTML = item ? `<div class="item-label">${item.name[0]}</div>` : '';
                if (item) {
                    equipAtk += (item.stats.attack || 0);
                    el.onpointerdown = (e) => {
                        this.isLongPress = false;
                        this.pressTimer = setTimeout(() => { this.isLongPress = true; this.showTooltip(item, e); }, 400); 
                    };
                    el.onpointerup = () => {
                        clearTimeout(this.pressTimer);
                        this.hideTooltip();
                        if (!this.isLongPress) this.handleItemClick(item);
                    };
                    el.onpointerleave = () => { clearTimeout(this.pressTimer); this.hideTooltip(); };
                    el.oncontextmenu = (e) => e.preventDefault();
                } else {
                    el.onpointerdown = null; el.onpointerup = null;
                }
            }
        });
        
        const cp = Math.floor((player.level * 150) + (equipAtk * 10));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = `CP: ${cp.toLocaleString()}`;
        this.updateStatsModal(player, cp, equipAtk);
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

    // --- Tooltips ---
    showTooltip(item, event) {
        const tt = document.getElementById('item-tooltip');
        if (!tt) return;
        
        document.getElementById('tt-name').innerText = item.name;
        document.getElementById('tt-name').className = `rarity-${item.rarity}`;
        document.getElementById('tt-rarity').innerText = item.rarity + " " + (item.slot || item.type);
        
        let statStr = "";
        if (item.stats) {
            if (item.stats.attack) statStr += `Attack: +${item.stats.attack}<br>`;
            if (item.stats.defense) statStr += `Defense: +${item.stats.defense}`;
        } else if (item.type === 'potion') {
            statStr = "Consumable Buff";
        } else if (item.type === 'rune') {
            statStr = "Mysterious Material";
        }
        document.getElementById('tt-stats').innerHTML = statStr;
        
        let x = event.touches ? event.touches[0].clientX : event.clientX;
        let y = event.touches ? event.touches[0].clientY : event.clientY;
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
        tt.classList.remove('hidden');
    },

    hideTooltip() {
        const tt = document.getElementById('item-tooltip');
        if (tt) tt.classList.add('hidden');
    },

    // --- Stats & Quests ---
    updateStatsModal(player, cp, equipAtk) {
        const list = document.getElementById('stats-list');
        if (!list) return;
        list.innerHTML = `
            <div style="background:#222; padding:15px; border-radius:5px; border:1px solid #444;">
                <h2 style="color:#d4af37; margin-bottom:10px;">Level ${player.level} Ninja</h2>
                <div class="stat-row"><span>Combat Power</span><span style="color:#f1c40f">${cp}</span></div>
                <div class="stat-row"><span>Health</span><span>${Math.floor(player.hp)} / ${player.maxHp}</span></div>
                <div class="stat-row"><span>Mana</span><span>${Math.floor(player.mp)} / ${player.maxMp}</span></div>
                <div class="stat-row"><span>Base Attack</span><span>${player.level * 10}</span></div>
                <div class="stat-row"><span>Gear Attack</span><span style="color:#2ecc71">+${equipAtk}</span></div>
            </div>
        `;
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
        
        // Skill unlock
        const skillBtn = document.getElementById('btn-skill-1');
        if (skillBtn && player.level >= 5) skillBtn.classList.remove('locked');

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
    }
};

window.addEventListener('DOMContentLoaded', () => UI.init());

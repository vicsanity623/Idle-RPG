const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    WORLD_SIZE: 3000, TILE_SIZE: 100,
    player: null, enemies: [], npcs: [], lootItems: [], projectiles: [], damageTexts: [], 
    kills: 0, images: {},

    // --- NEW: REPEATABLE QUEST SYSTEM ---
    activeQuest: null,
    questList: [
        { title: "[Battle] Ghost Hunter", obj: "Kill Sleepless Ghost", target: 10, g: 100, xp: 200 },
        { title: "[Battle] Exorcist", obj: "Kill Sleepless Ghost", target: 20, g: 300, xp: 500 },
        { title: "[Battle] Spirit Bane", obj: "Kill Sleepless Ghost", target: 40, g: 600, xp: 1000 },
        { title: "[Battle] The Cleansing", obj: "Kill Sleepless Ghost", target: 60, g: 1000, xp: 2000 },
        { title: "[Battle] Ghost King's Fall", obj: "Kill Sleepless Ghost", target: 100, g: 2500, xp: 5000 }
    ],
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.miniCanvas = document.getElementById('minimapCanvas');
        this.miniCtx = this.miniCanvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('pointerdown', (e) => this.handleScreenTap(e));

        this.player = new Player(this.WORLD_SIZE/2, this.WORLD_SIZE/2);
        
        // Spawn Quest NPC
        this.npcs = [new NPC(this.WORLD_SIZE/2 + 100, this.WORLD_SIZE/2, "Quest Master")];
            
        // Hook up Potion Buttons
        document.querySelectorAll('.action-slot.potion').forEach((btn, idx) => {
            btn.onclick = () => {
                const type = idx === 0 ? "Health Potion" : "Mana Potion";
                const item = this.player.inventory.find(i => i.name === type);
                if (item) UI.handleItemClick(item);
                else UI.showLootNotification(`No ${type}s left!`, "rarity-common");
            };
        });

        for(let i=0; i<30; i++) this.enemies.push(new Enemy(Math.random()*this.WORLD_SIZE, Math.random()*this.WORLD_SIZE));

        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('ghost', 'assets/sleepless_ghost.png');

        // Load saved data before starting loop
        this.loadGame();

        requestAnimationFrame((t) => this.loop(t));
    },

    saveGame() {
        const saveData = {
            level: this.player.level,
            xp: this.player.xp,
            maxXp: this.player.maxXp,
            gold: this.player.gold,
            inventory: this.player.inventory,
            equipment: this.player.equipment,
            kills: this.kills,
            activeQuest: this.activeQuest // Save active quest
        };
        localStorage.setItem('mmo_save_data', JSON.stringify(saveData));
    },

    loadGame() {
        const saved = localStorage.getItem('mmo_save_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(this.player, data);
            this.kills = data.kills || 0;
            this.activeQuest = data.activeQuest || null; // Load active quest
            
            UI.updateInventory(this.player);
            UI.updatePlayerStats(this.player);
            UI.showLootNotification("Progress Loaded", "rarity-legendary");
        }
    },

    resize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.camera.width = this.canvas.width; this.camera.height = this.canvas.height;
    },

    loadAsset(key, src) {
        const img = new Image(); img.src = src; this.images[key] = img;
    },

    spawnLoot(x, y, type) {
        this.lootItems.push(new LootItem(x, y, type));
    },

    handleScreenTap(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Support for both mouse clicks and touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const worldX = (clientX - rect.left) + this.camera.x;
        const worldY = (clientY - rect.top) + this.camera.y;

        // --- NEW: NPC QUEST GIVER LOGIC ---
        for (let npc of this.npcs) {
            if (Math.hypot(npc.x - worldX, npc.y - worldY) < 60) {
                if (!this.activeQuest) {
                    // Give a new random quest
                    this.activeQuest = this.questList[Math.floor(Math.random() * this.questList.length)];
                    this.kills = 0; 
                    
                    const questBox = document.getElementById('quest-tracker');
                    if (questBox) {
                        questBox.style.display = 'block';
                        questBox.classList.remove('quest-complete-glow');
                    }
                    
                    UI.showLootNotification(`Quest Accepted: ${this.activeQuest.title}`, "rarity-epic");
                    UI.updatePlayerStats(this.player);
                    this.saveGame();
                } else {
                    UI.showLootNotification(`${npc.name}: "Finish your task first!"`, "rarity-common");
                }
                return;
            }
        }

        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && enemy.distanceTo({x: worldX, y: worldY}) < enemy.radius + 30) {
                clickedEnemy = enemy; break;
            }
        }
        this.player.target = clickedEnemy; 
    },

    castFireArrow() {
        if (this.player.level < 5 || this.player.mp < 50 || !this.player.target || this.player.isDead) return;
        this.player.mp -= 50;
        this.projectiles.push(new Projectile(this.player.x, this.player.y - 30, this.player.target, 500));
        UI.showLootNotification("FIRE ARROW!", "rarity-epic");
    },

    spawnDamageText(x, y, text, color) { this.damageTexts.push({ x, y, text, color, life: 1.0 }); },

    update(dt) {
        this.player.update(dt, this.enemies);
        
        if (!this.player.isDead) {
            this.camera.x = Math.max(0, Math.min(this.player.x - this.camera.width / 2, this.WORLD_SIZE - this.camera.width));
            this.camera.y = Math.max(0, Math.min(this.player.y - this.camera.height / 2, this.WORLD_SIZE - this.camera.height));
        }

        this.enemies.forEach(e => e.update(dt, this.player));
        this.enemies = this.enemies.filter(e => !e.isDead);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => p.life > 0);

        this.lootItems.forEach(item => {
            item.life -= dt;
            if (this.player.distanceTo(item) < 50 && !this.player.isDead) {
                this.player.pickUpItem(item);
                item.isPickedUp = true;
            }
        });
        this.lootItems = this.lootItems.filter(item => !item.isPickedUp && item.life > 0);

        this.damageTexts.forEach(dtxt => { dtxt.y -= 30 * dt; dtxt.life -= dt; });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        if (this.enemies.length < 30) this.enemies.push(new Enemy(Math.random()*this.WORLD_SIZE, Math.random()*this.WORLD_SIZE));
        
        UI.updatePlayerStats(this.player);
        UI.updateXpBar(this.player);

        if (Math.random() < 0.002) this.saveGame();
    },

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const startCol = Math.max(0, Math.floor(this.camera.x / this.TILE_SIZE));
        const endCol = Math.min(this.WORLD_SIZE / this.TILE_SIZE, startCol + (this.camera.width / this.TILE_SIZE) + 1);
        const startRow = Math.max(0, Math.floor(this.camera.y / this.TILE_SIZE));
        const endRow = Math.min(this.WORLD_SIZE / this.TILE_SIZE, startRow + (this.camera.height / this.TILE_SIZE) + 1);

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                let px = c * this.TILE_SIZE - this.camera.x;
                let py = r * this.TILE_SIZE - this.camera.y;
                if (this.images['bg'] && this.images['bg'].complete) {
                    this.ctx.drawImage(this.images['bg'], px, py, this.TILE_SIZE, this.TILE_SIZE);
                } else {
                    this.ctx.fillStyle = (r+c)%2===0 ? '#2a4a2a' : '#1e381e';
                    this.ctx.fillRect(px, py, this.TILE_SIZE, this.TILE_SIZE);
                }
            }
        }

        this.lootItems.forEach(item => {
            const sx = item.x - this.camera.x; const sy = item.y - this.camera.y;
            let color = item.rarity === 'legendary' ? "#f1c40f" : item.rarity === 'epic' ? "#9b59b6" : item.rarity === 'rare' ? "#3498db" : "#fff";
            this.ctx.save(); this.ctx.shadowBlur = 15; this.ctx.shadowColor = color;
            this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(sx, sy, 8, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();
        });

        this.npcs.forEach(n => {
            const sx = n.x - this.camera.x; const sy = n.y - this.camera.y;
            this.ctx.fillStyle = "#f1c40f"; this.ctx.beginPath(); this.ctx.arc(sx, sy, 25, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = "white"; this.ctx.font = "bold 14px sans-serif"; this.ctx.textAlign = "center";
            this.ctx.fillText(n.name, sx, sy - 40);
            this.ctx.fillStyle = "#f1c40f"; this.ctx.font = "bold 30px sans-serif"; this.ctx.fillText("!", sx, sy - 60);
        });

        this.projectiles.forEach(p => {
            p.trail.forEach(t => {
                this.ctx.fillStyle = `rgba(255, 69, 0, ${t.alpha})`;
                this.ctx.beginPath(); this.ctx.arc(t.x - this.camera.x, t.y - this.camera.y, 8, 0, Math.PI*2); this.ctx.fill();
            });
            this.ctx.fillStyle = "#ff0000";
            this.ctx.beginPath(); this.ctx.arc(p.x - this.camera.x, p.y - this.camera.y, 12, 0, Math.PI*2); this.ctx.fill();
        });

        this.enemies.forEach(e => {
            const sx = e.x - this.camera.x; const sy = e.y - this.camera.y;
            if (this.images['ghost'] && this.images['ghost'].complete) {
                this.ctx.drawImage(this.images['ghost'], sx - e.radius, sy - e.radius, e.radius*2, e.radius*2);
            } else {
                this.ctx.beginPath(); this.ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#888'; this.ctx.fill();
            }
            this.ctx.fillStyle = '#000'; this.ctx.fillRect(sx - 15, sy - e.radius - 10, 30, 4);
            this.ctx.fillStyle = '#f00'; this.ctx.fillRect(sx - 15, sy - e.radius - 10, 30 * (e.hp / e.maxHp), 4);
        });

        if (!this.player.isDead) {
            const pScreenX = Math.round(this.player.x - this.camera.x);
            const pScreenY = Math.round(this.player.y - this.camera.y);
            let pDraw = this.player.getDrawInfo();
            if (pDraw && pDraw.image) {
                this.ctx.save(); this.ctx.translate(pScreenX, pScreenY); 
                if (!this.player.facingRight) this.ctx.scale(-1, 1); 
                this.ctx.drawImage(pDraw.image, -pDraw.drawWidth/2, -pDraw.drawHeight, pDraw.drawWidth, pDraw.drawHeight);
                this.ctx.restore(); 
            }
        }

        this.ctx.font = "bold 20px sans-serif"; this.ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - this.camera.x; const sy = dtxt.y - this.camera.y;
            this.ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`; this.ctx.fillText(dtxt.text, sx+2, sy+2);
            this.ctx.fillStyle = dtxt.color; this.ctx.globalAlpha = dtxt.life;
            this.ctx.fillText(dtxt.text, sx, sy); this.ctx.globalAlpha = 1.0;
        });

        if (this.player.isDead) {
            this.ctx.fillStyle = "rgba(0,0,0,0.7)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "white"; this.ctx.font = "bold 40px sans-serif"; this.ctx.textAlign = "center";
            this.ctx.fillText("YOU HAVE FALLEN", this.canvas.width/2, this.canvas.height/2);
            this.ctx.font = "20px sans-serif";
            this.ctx.fillText(`Respawning in ${Math.ceil(10 - this.player.respawnTimer)}s...`, this.canvas.width/2, this.canvas.height/2 + 50);
        }

        this.drawMinimap();
    },

    drawMinimap() {
        this.miniCtx.clearRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);
        const scale = this.miniCanvas.width / this.WORLD_SIZE;
        this.miniCtx.fillStyle = 'red';
        this.enemies.forEach(e => this.miniCtx.fillRect(e.x * scale, e.y * scale, 3, 3));
        this.miniCtx.fillStyle = 'lime';
        this.miniCtx.fillRect(this.player.x * scale, this.player.y * scale, 4, 4);
    },

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; 
        this.lastTime = timestamp;
        this.update(dt); this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
};

class Projectile {
    constructor(x, y, target, damage) {
        this.x = x; this.y = y; this.target = target; this.damage = damage;
        this.speed = 600; this.life = 2; this.trail = [];
    }
    update(dt) {
        this.trail.push({x: this.x, y: this.y, alpha: 1.0});
        if (this.trail.length > 12) this.trail.shift();
        this.trail.forEach(t => t.alpha -= 0.08);

        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
        this.life -= dt;

        if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 25) {
            const wasDead = this.target.isDead;
            this.target.takeDamage(this.damage, Game.player);
            if (!wasDead && this.target.isDead && Game.activeQuest && this.target.name === Game.activeQuest.obj.replace("Kill ", "")) {
                Game.kills++;
            }
            this.life = 0;
        }
    }
}

// --- UI PATCHES ---
if (typeof UI !== 'undefined') {
    UI.currentInvTab = 'equip';

    UI.setInventoryTab = function(tab) {
        this.currentInvTab = tab;
        document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
        if (event) event.target.classList.add('active');
        this.updateInventory(Game.player);
    };

    UI.updateInventory = function(player) {
        const grid = document.getElementById('inv-grid');
        const goldTxt = document.getElementById('inv-gold');
        if (!grid) return;
        grid.innerHTML = '';
        goldTxt.innerText = player.gold.toLocaleString();

        const items = player.inventory.filter(item => (this.currentInvTab === 'equip' ? item.type === 'equipment' : item.type !== 'equipment'));

        items.forEach(item => {
            const slot = document.createElement('div');
            slot.className = `inv-slot rarity-${item.rarity} slot-icon`;
            slot.innerHTML = `<div class="item-label">${item.name[0]}</div>`; 
            if (item.count > 1) slot.innerHTML += `<span class="count">${item.count}</span>`;
            
            // --- NEW: LONG PRESS TOOLTIP FOR INVENTORY ---
            slot.onpointerdown = (e) => {
                this.isLongPress = false;
                this.pressTimer = setTimeout(() => {
                    this.isLongPress = true;
                    this.showTooltip(item, e);
                }, 400); 
            };
            slot.onpointerup = (e) => {
                clearTimeout(this.pressTimer);
                this.hideTooltip();
                if (!this.isLongPress) this.handleItemClick(item);
            };
            slot.onpointerleave = () => { clearTimeout(this.pressTimer); this.hideTooltip(); };
            slot.oncontextmenu = (e) => e.preventDefault(); 
            
            grid.appendChild(slot);
        });

        let equipAtk = 0;
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''} slot-icon`;
                el.innerHTML = item ? `<div class="item-label">${item.name[0]}</div>` : '';
                
                if (item) {
                    equipAtk += (item.stats.attack || 0);
                    // --- NEW: UNEQUIP AND TOOLTIPS FOR EQUIPPED ITEMS ---
                    el.onpointerdown = (e) => {
                        this.isLongPress = false;
                        this.pressTimer = setTimeout(() => {
                            this.isLongPress = true;
                            this.showTooltip(item, e);
                        }, 400); 
                    };
                    el.onpointerup = (e) => {
                        clearTimeout(this.pressTimer);
                        this.hideTooltip();
                        if (!this.isLongPress) this.handleItemClick(item); // Triggers Unequip
                    };
                    el.onpointerleave = () => { clearTimeout(this.pressTimer); this.hideTooltip(); };
                    el.oncontextmenu = (e) => e.preventDefault();
                } else {
                    // Clear events if slot is empty
                    el.onpointerdown = null; el.onpointerup = null; el.onpointerleave = null; el.oncontextmenu = null;
                }
            }
        });
        
        const cp = Math.floor((player.level * 150) + (equipAtk * 10));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = cp.toLocaleString();
        this.updateStatsModal(player, cp, equipAtk);
    };

    UI.handleItemClick = function(item) {
        if (item.type === 'equipment') {
            // Is it equipped?
            const isEquipped = Object.values(Game.player.equipment).includes(item);
            
            if (isEquipped) {
                // Unequip Logic
                Game.player.equipment[item.slot] = null;
                Game.player.inventory.push(item);
                this.showLootNotification(`Unequipped ${item.name}`, 'rarity-common');
            } else {
                // Equip Logic
                const oldItem = Game.player.equipment[item.slot];
                Game.player.equipment[item.slot] = item;
                Game.player.inventory = Game.player.inventory.filter(i => i !== item);
                if (oldItem) Game.player.inventory.push(oldItem); // Swap
                
                // Floating text for stats
                let statText = item.stats.attack ? `ATK +${item.stats.attack}` : `DEF +${item.stats.defense}`;
                Game.spawnDamageText(Game.player.x, Game.player.y - 50, statText, "#f1c40f");
                this.showLootNotification(`Equipped ${item.name}`, 'rarity-epic');
            }
        } else if (item.name.includes("Health Potion")) {
            Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + 200);
            Game.spawnDamageText(Game.player.x, Game.player.y - 50, "HP +200", "#2ecc71"); 
            item.count--;
            if (item.count <= 0) Game.player.inventory = Game.player.inventory.filter(i => i !== item);
            
        } else if (item.name.includes("Mana Potion")) {
            Game.player.mp = Math.min(Game.player.maxMp, Game.player.mp + 100);
            Game.spawnDamageText(Game.player.x, Game.player.y - 50, "MP +100", "#3498db"); 
            item.count--;
            if (item.count <= 0) Game.player.inventory = Game.player.inventory.filter(i => i !== item);
        }
        this.updateInventory(Game.player);
        Game.saveGame(); 
    };

    // --- NEW: TOOLTIP RENDERERS ---
    UI.showTooltip = function(item, event) {
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
    };

    UI.hideTooltip = function() {
        const tt = document.getElementById('item-tooltip');
        if (tt) tt.classList.add('hidden');
    };

    UI.startAutoQuest = function() {
        Game.player.autoQuest = !Game.player.autoQuest;
        const indicator = document.getElementById('auto-quest-indicator');
        if (indicator) indicator.classList.toggle('hidden', !Game.player.autoQuest);
        this.showLootNotification(Game.player.autoQuest ? "Auto-Quest Started" : "Auto-Quest Stopped", "rarity-rare");
    };

    UI.updateXpBar = function(player) {
        const fill = document.getElementById('exp-fill');
        const text = document.getElementById('exp-text');
        if (fill) {
            const pct = (player.xp / player.maxXp) * 100;
            fill.style.width = pct + "%";
            if (text) text.innerText = `EXP ${pct.toFixed(3)}%`;
        }
        const badge = document.getElementById('player-level');
        if (badge) badge.innerText = player.level;
    };

    UI.showLootNotification = function(msg, rarity) {
        const container = document.getElementById('loot-notification-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `loot-msg ${rarity}`;
        el.innerText = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    };
    
    UI.updateStatsModal = function(player, cp, equipAtk) {
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
    };

    UI.updatePlayerStats = function(player) {
        const questBox = document.getElementById('quest-tracker');
        
        if (!Game.activeQuest) {
            if (questBox) questBox.style.display = 'none';
        } else {
            if (questBox) {
                questBox.style.display = 'block';
                const qTitle = questBox.querySelector('.quest-title');
                const qObj = questBox.querySelector('.quest-obj');
                if (qTitle) qTitle.innerText = Game.activeQuest.title;
                
                // Inject current kills vs target
                if (qObj) qObj.innerHTML = `${Game.activeQuest.obj} (<span id="quest-count">${Game.kills}</span>/${Game.activeQuest.target})`;
                
                if (Game.kills >= Game.activeQuest.target) {
                    questBox.classList.add('quest-complete-glow');
                    // Target just the content, so we don't delete the auto-path indicator
                    const qContent = questBox.querySelector('#quest-content');
                    if (qContent) {
                        qContent.innerHTML = `<h4 class="quest-title" style="color:#fff;">[DONE] Click to Claim!</h4><p class="quest-obj">Reward: ${Game.activeQuest.g} Gold & ${Game.activeQuest.xp} XP</p>`;
                    }
                    
                    const ind = document.getElementById('auto-quest-indicator');
                    if (ind) ind.classList.add('hidden');
                    
                    questBox.onclick = () => UI.claimQuest(player);
                } else {
                    questBox.classList.remove('quest-complete-glow');
                    questBox.onclick = () => UI.startAutoQuest();
                }
            }
        }

        const hpPot = player.inventory.find(i => i.name === "Health Potion");
        const mpPot = player.inventory.find(i => i.name === "Mana Potion");
        const hpLabel = document.getElementById('hp-potion-count');
        const mpLabel = document.getElementById('mp-potion-count');
        if (hpLabel) hpLabel.innerText = hpPot ? hpPot.count : 0;
        if (mpLabel) mpLabel.innerText = mpPot ? mpPot.count : 0;
        
        const skillBtn = document.getElementById('btn-skill-1');
        if (skillBtn && player.level >= 5) skillBtn.classList.remove('locked');

        const hpFill = document.getElementById('hp-fill');
        const mpFill = document.getElementById('mp-fill');
        const hpTxt = document.getElementById('hp-text');
        if (hpFill) hpFill.style.width = (player.hp / player.maxHp * 100) + "%";
        if (mpFill) mpFill.style.width = (player.mp / player.maxMp * 100) + "%";
        if (hpTxt) hpTxt.innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    };

    UI.claimQuest = function(player) {
        if (!Game.activeQuest) return;
        
        player.gainXp(Game.activeQuest.xp);
        player.gold += Game.activeQuest.g;
        Game.kills = 0; 
        
        this.showLootNotification(`Quest Complete! +${Game.activeQuest.g} Gold`, "rarity-legendary");
        
        Game.activeQuest = null; 
        const questBox = document.getElementById('quest-tracker');
        if (questBox) questBox.style.display = 'none';
        
        this.updateInventory(player);
        Game.saveGame(); 
    };
}

window.addEventListener('load', () => Game.init());
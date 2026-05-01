/**
 * Core Game Engine
 * Standards: ES6+, Performance Optimized, Separation of Concerns
 */

const Game = {
    // --- Configuration ---
    WORLD_SIZE: 3000,
    TILE_SIZE: 100,
    MAX_ENEMIES: 30,
    SAVE_KEY: 'mmo_save_data',

    // --- State Management ---
    canvas: null,
    ctx: null,
    miniCanvas: null,
    miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    player: null,
    enemies: [],
    npcs: [],
    lootItems: [],
    projectiles: [],
    damageTexts: [], 
    kills: 0,
    images: {},
    assetsLoaded: 0,
    totalAssets: 0,

    // --- Quest System ---
    activeQuest: null,
    questList: [
        { id: 1, title: "[Battle] Ghost Hunter", obj: "Kill Sleepless Ghost", target: 10, g: 100, xp: 200 },
        { id: 2, title: "[Battle] Exorcist", obj: "Kill Sleepless Ghost", target: 20, g: 300, xp: 500 },
        { id: 3, title: "[Battle] Spirit Bane", obj: "Kill Sleepless Ghost", target: 40, g: 600, xp: 1000 },
        { id: 4, title: "[Battle] The Cleansing", obj: "Kill Sleepless Ghost", target: 60, g: 1000, xp: 2000 },
        { id: 5, title: "[Battle] Ghost King's Fall", obj: "Kill Sleepless Ghost", target: 100, g: 2500, xp: 5000 }
    ],

    async init() {
        // Initialization of Canvases
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return console.error("Game Canvas not found");
        
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimization: no alpha for main ctx
        this.miniCanvas = document.getElementById('minimapCanvas');
        this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Standardized Pointer Support (Mouse/Touch/Pen)
        this.canvas.addEventListener('pointerdown', (e) => this.handleInput(e));

        // Initialize Entities
        // Assuming Player and NPC classes are defined in other files
        this.player = new Player(this.WORLD_SIZE / 2, this.WORLD_SIZE / 2);
        this.npcs = [new NPC(this.WORLD_SIZE / 2 + 100, this.WORLD_SIZE / 2, "Quest Master")];

        // Setup Potion Shortcuts
        this.setupActionSlots();

        // Load Assets
        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('ghost', 'assets/sleepless_ghost.png');

        // Load Saved Data
        this.loadGame();

        // Initial UI Sync
        if (typeof UI !== 'undefined') {
            UI.updateInventory(this.player);
            UI.updatePlayerStats(this.player);
        }

        // Start Game Loop
        requestAnimationFrame((t) => this.loop(t));
        
        // Periodic Save (Every 30 seconds)
        setInterval(() => this.saveGame(), 30000);
    },

    setupActionSlots() {
        document.querySelectorAll('.action-slot.potion').forEach((btn, idx) => {
            btn.onclick = (e) => {
                e.preventDefault();
                const type = idx === 0 ? "Health Potion" : "Mana Potion";
                const item = this.player.inventory.find(i => i.name === type);
                if (item && typeof UI !== 'undefined') {
                    UI.handleItemClick(item);
                } else if (typeof UI !== 'undefined') {
                    UI.showLootNotification(`No ${type}s left!`, "rarity-common");
                }
            };
        });
    },

    loadAsset(key, src) {
        this.totalAssets++;
        const img = new Image();
        img.onload = () => this.assetsLoaded++;
        img.onerror = () => console.error(`Failed to load asset: ${src}`);
        img.src = src;
        this.images[key] = img;
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
    },

    handleInput(e) {
        const rect = this.canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left) + this.camera.x;
        const worldY = (e.clientY - rect.top) + this.camera.y;

        // 1. Check NPC Interactions
        for (let npc of this.npcs) {
            if (Math.hypot(npc.x - worldX, npc.y - worldY) < 60) {
                this.interactWithNPC(npc);
                return;
            }
        }

        // 2. Check Enemy Targeting
        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && Math.hypot(enemy.x - worldX, enemy.y - worldY) < enemy.radius + 20) {
                clickedEnemy = enemy;
                break;
            }
        }
        this.player.target = clickedEnemy;
    },

    interactWithNPC(npc) {
        if (!this.activeQuest) {
            // Assign new quest
            this.activeQuest = {...this.questList[Math.floor(Math.random() * this.questList.length)]};
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
    },

    saveGame() {
        if (!this.player) return;
        const saveData = {
            level: this.player.level,
            xp: this.player.xp,
            maxXp: this.player.maxXp,
            gold: this.player.gold,
            inventory: this.player.inventory,
            equipment: this.player.equipment,
            kills: this.kills,
            activeQuest: this.activeQuest
        };
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
    },

    loadGame() {
        const saved = localStorage.getItem(this.SAVE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                Object.assign(this.player, data);
                this.kills = data.kills || 0;
                this.activeQuest = data.activeQuest || null;
                UI.showLootNotification("Progress Loaded", "rarity-legendary");
            } catch (e) {
                console.error("Save data corrupted.");
            }
        }
    },

    spawnDamageText(x, y, text, color) {
        this.damageTexts.push({ x, y, text, color, life: 1.0 });
    },

    update(dt) {
        if (this.player.isDead) {
            this.player.update(dt, this.enemies); // Handle respawn timer
            return;
        }

        this.player.update(dt, this.enemies);
        
        // Smooth Camera Follow
        const targetCamX = this.player.x - this.camera.width / 2;
        const targetCamY = this.player.y - this.camera.height / 2;
        this.camera.x = Math.max(0, Math.min(targetCamX, this.WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(targetCamY, this.WORLD_SIZE - this.camera.height));

        // Update Entities
        this.enemies.forEach(e => e.update(dt, this.player));
        this.enemies = this.enemies.filter(e => !e.isDead);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => p.life > 0);

        this.lootItems.forEach(item => {
            item.life -= dt;
            if (this.player.distanceTo(item) < 50) {
                this.player.pickUpItem(item);
                item.isPickedUp = true;
            }
        });
        this.lootItems = this.lootItems.filter(item => !item.isPickedUp && item.life > 0);

        this.damageTexts.forEach(dtxt => {
            dtxt.y -= 40 * dt;
            dtxt.life -= dt;
        });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        // Respawn Enemies
        if (this.enemies.length < this.MAX_ENEMIES) {
            this.enemies.push(new Enemy(Math.random() * this.WORLD_SIZE, Math.random() * this.WORLD_SIZE));
        }

        // Logic-based UI updates (only when UI exists and not every frame)
        if (typeof UI !== 'undefined' && Math.random() < 0.1) {
            UI.updatePlayerStats(this.player);
            UI.updateXpBar(this.player);
        }
    },

    draw() {
        const { ctx, camera, images, TILE_SIZE } = this;
        ctx.fillStyle = "#1e381e"; // Fallback background
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Draw Tiled Background
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = Math.ceil((camera.x + camera.width) / TILE_SIZE);
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = Math.ceil((camera.y + camera.height) / TILE_SIZE);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                let px = c * TILE_SIZE - camera.x;
                let py = r * TILE_SIZE - camera.y;
                if (images.bg && images.bg.complete) {
                    ctx.drawImage(images.bg, px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // 2. Draw Loot
        this.lootItems.forEach(item => {
            const sx = item.x - camera.x;
            const sy = item.y - camera.y;
            const color = item.rarity === 'legendary' ? "#f1c40f" : item.rarity === 'epic' ? "#9b59b6" : "#fff";
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
        });

        // 3. Draw NPCs
        this.npcs.forEach(n => {
            const sx = n.x - camera.x; const sy = n.y - camera.y;
            ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(sx, sy, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "white"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(n.name, sx, sy - 40);
            ctx.fillStyle = "#f1c40f"; ctx.font = "bold 30px Arial"; ctx.fillText("!", sx, sy - 60);
        });

        // 4. Draw Projectiles
        this.projectiles.forEach(p => {
            ctx.fillStyle = "#ff4500";
            ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 8, 0, Math.PI*2); ctx.fill();
        });

        // 5. Draw Enemies
        this.enemies.forEach(e => {
            const sx = e.x - camera.x; const sy = e.y - camera.y;
            if (images.ghost && images.ghost.complete) {
                ctx.drawImage(images.ghost, sx - e.radius, sy - e.radius, e.radius*2, e.radius*2);
            } else {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.fill();
            }
            // Enemy HP Bar
            ctx.fillStyle = '#000'; ctx.fillRect(sx - 15, sy - e.radius - 10, 30, 4);
            ctx.fillStyle = '#f00'; ctx.fillRect(sx - 15, sy - e.radius - 10, 30 * (e.hp / e.maxHp), 4);
        });

        // 6. Draw Player
        if (!this.player.isDead) {
            const pScreenX = this.player.x - camera.x;
            const pScreenY = this.player.y - camera.y;
            const pDraw = this.player.getDrawInfo ? this.player.getDrawInfo() : null;

            if (pDraw && pDraw.image) {
                ctx.save();
                ctx.translate(pScreenX, pScreenY); 
                if (!this.player.facingRight) ctx.scale(-1, 1); 
                ctx.drawImage(pDraw.image, -pDraw.drawWidth/2, -pDraw.drawHeight, pDraw.drawWidth, pDraw.drawHeight);
                ctx.restore(); 
            } else {
                ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(pScreenX, pScreenY, 20, 0, Math.PI*2); ctx.fill();
            }
        }

        // 7. Damage Text Overlay
        ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            ctx.globalAlpha = dtxt.life;
            ctx.fillStyle = dtxt.color;
            ctx.font = "bold 20px Arial";
            ctx.fillText(dtxt.text, dtxt.x - camera.x, dtxt.y - camera.y);
        });
        ctx.globalAlpha = 1.0;

        // 8. Death Overlay
        if (this.player.isDead) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.fillText("YOU HAVE FALLEN", this.canvas.width/2, this.canvas.height/2);
        }

        this.drawMinimap();
    },

    drawMinimap() {
        if (!this.miniCtx) return;
        this.miniCtx.clearRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);
        const scale = this.miniCanvas.width / this.WORLD_SIZE;
        
        this.miniCtx.fillStyle = 'red';
        this.enemies.forEach(e => this.miniCtx.fillRect(e.x * scale, e.y * scale, 2, 2));
        
        this.miniCtx.fillStyle = 'lime';
        this.miniCtx.fillRect(this.player.x * scale, this.player.y * scale, 4, 4);
    },

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        dt = Math.min(dt, 0.1); // Cap dt to prevent huge jumps
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
};

/**
 * Projectile Class - Refactored for better logic
 */
class Projectile {
    constructor(x, y, target, damage) {
        this.x = x; this.y = y; this.target = target; this.damage = damage;
        this.speed = 700;
        this.life = 2.0;
    }
    update(dt) {
        if (!this.target || this.target.isDead) { this.life = 0; return; }
        
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
        this.life -= dt;

        if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 25) {
            if (this.target.takeDamage) this.target.takeDamage(this.damage, Game.player);
            this.life = 0;
        }
    }
}

/**
 * UI Patching - Enhanced UI logic
 */
if (typeof UI !== 'undefined') {
    UI.currentInvTab = 'equip';

    UI.setInventoryTab = function(tab) {
        this.currentInvTab = tab;
        document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        this.updateInventory(Game.player);
    };

    UI.updateInventory = function(player) {
        const grid = document.getElementById('inv-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        const items = player.inventory.filter(item => 
            this.currentInvTab === 'equip' ? item.type === 'equipment' : item.type !== 'equipment'
        );

        // Render 40 slots
        for (let i = 0; i < 40; i++) {
            const item = items[i];
            const slot = document.createElement('div');
            slot.className = `inv-slot ${item ? 'rarity-' + item.rarity : ''}`;
            
            if (item) {
                slot.innerHTML = `<div class="item-label">${item.name[0]}</div>`;
                if (item.count > 1) slot.innerHTML += `<span class="count">${item.count}</span>`;
                slot.onclick = () => this.handleItemClick(item);
            }
            grid.appendChild(slot);
        }

        // Update Equipment
        let equipAtk = 0;
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''}`;
                el.innerHTML = item ? `<div class="item-label">${item.name[0]}</div>` : '';
                if (item) {
                    equipAtk += (item.stats.attack || 0);
                    el.onclick = () => this.handleItemClick(item);
                }
            }
        });

        // CP Calculation
        const cp = Math.floor((player.level * 150) + (equipAtk * 10));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = `CP: ${cp.toLocaleString()}`;
    };

    UI.handleItemClick = function(item) {
        const p = Game.player;
        if (item.type === 'equipment') {
            const isEquipped = Object.values(p.equipment).includes(item);
            if (isEquipped) {
                p.equipment[item.slot] = null;
                p.inventory.push(item);
            } else {
                const old = p.equipment[item.slot];
                p.equipment[item.slot] = item;
                p.inventory = p.inventory.filter(i => i !== item);
                if (old) p.inventory.push(old);
            }
        } else if (item.name.includes("Potion")) {
            const isHealth = item.name.includes("Health");
            if (isHealth) p.hp = Math.min(p.maxHp, p.hp + 200);
            else p.mp = Math.min(p.maxMp, p.mp + 100);
            
            item.count--;
            if (item.count <= 0) p.inventory = p.inventory.filter(i => i !== item);
            Game.spawnDamageText(p.x, p.y - 50, isHealth ? "HP +200" : "MP +100", isHealth ? "#2ecc71" : "#3498db");
        }
        this.updateInventory(p);
        Game.saveGame();
    };

    UI.updatePlayerStats = function(player) {
        const questBox = document.getElementById('quest-tracker');
        if (!Game.activeQuest) {
            if (questBox) questBox.style.display = 'none';
        } else {
            if (questBox) {
                questBox.style.display = 'block';
                const isComplete = Game.kills >= Game.activeQuest.target;
                questBox.classList.toggle('quest-complete-glow', isComplete);
                
                const qContent = document.getElementById('quest-content');
                if (qContent) {
                    qContent.innerHTML = isComplete ? 
                        `<h4 style="color:#d4af37">[READY] Claim Reward!</h4>` : 
                        `<h4>${Game.activeQuest.title}</h4><p>${Game.activeQuest.obj}: ${Game.kills}/${Game.activeQuest.target}</p>`;
                }
                questBox.onclick = () => isComplete ? UI.claimQuest(player) : UI.startAutoQuest();
            }
        }

        // Update Bars
        const hpFill = document.getElementById('hp-fill');
        const mpFill = document.getElementById('mp-fill');
        if (hpFill) hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
        if (mpFill) mpFill.style.width = `${(player.mp / player.maxMp) * 100}%`;
    };

    UI.claimQuest = function(player) {
        if (!Game.activeQuest) return;
        player.gainXp(Game.activeQuest.xp);
        player.gold += Game.activeQuest.g;
        Game.activeQuest = null;
        Game.kills = 0;
        this.showLootNotification("Quest Complete!", "rarity-legendary");
        this.updateInventory(player);
        Game.saveGame();
    };

    UI.showLootNotification = function(msg, rarity) {
        const container = document.getElementById('loot-notification-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `loot-msg ${rarity}`;
        el.innerText = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    };

    UI.updateXpBar = function(player) {
        const fill = document.getElementById('exp-fill');
        if (fill) fill.style.width = `${(player.xp / player.maxXp) * 100}%`;
    };
}

// Global Launcher
window.addEventListener('load', () => Game.init());

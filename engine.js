const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    WORLD_SIZE: 3000, TILE_SIZE: 100,
    player: null, enemies: [], npcs: [], lootItems: [], projectiles: [], damageTexts: [], 
    kills: 0, images: {},
    
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

        requestAnimationFrame((t) => this.loop(t));
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
        const worldX = (e.clientX - rect.left) + this.camera.x;
        const worldY = (e.clientY - rect.top) + this.camera.y;

        // NEW: Check for NPC clicks first
        for (let npc of this.npcs) {
            if (Math.hypot(npc.x - worldX, npc.y - worldY) < 60) {
                UI.showLootNotification(`${npc.name}: "The ghosts are restless today..."`, "rarity-legendary");
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

    // NEW: Fire Arrow Logic
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

        // Update Projectiles (Fire Arrow)
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
    },

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background
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

        // Draw Loot
        this.lootItems.forEach(item => {
            const sx = item.x - this.camera.x; const sy = item.y - this.camera.y;
            let color = item.rarity === 'legendary' ? "#f1c40f" : item.rarity === 'epic' ? "#9b59b6" : item.rarity === 'rare' ? "#3498db" : "#fff";
            this.ctx.save(); this.ctx.shadowBlur = 15; this.ctx.shadowColor = color;
            this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(sx, sy, 8, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();
        });

        // Draw NPCs
        this.npcs.forEach(n => {
            const sx = n.x - this.camera.x; const sy = n.y - this.camera.y;
            this.ctx.fillStyle = "#f1c40f"; this.ctx.beginPath(); this.ctx.arc(sx, sy, 25, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = "white"; this.ctx.font = "bold 14px sans-serif"; this.ctx.textAlign = "center";
            this.ctx.fillText(n.name, sx, sy - 40);
            this.ctx.fillStyle = "#f1c40f"; this.ctx.font = "bold 30px sans-serif"; this.ctx.fillText("!", sx, sy - 60);
        });

        // Draw Projectiles (Fire Arrow)
        this.projectiles.forEach(p => {
            p.trail.forEach(t => {
                this.ctx.fillStyle = `rgba(255, 69, 0, ${t.alpha})`;
                this.ctx.beginPath(); this.ctx.arc(t.x - this.camera.x, t.y - this.camera.y, 8, 0, Math.PI*2); this.ctx.fill();
            });
            this.ctx.fillStyle = "#ff0000";
            this.ctx.beginPath(); this.ctx.arc(p.x - this.camera.x, p.y - this.camera.y, 12, 0, Math.PI*2); this.ctx.fill();
        });

        // Draw Enemies
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

        // Draw Player
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

        // Draw Damage Text
        this.ctx.font = "bold 20px sans-serif"; this.ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - this.camera.x; const sy = dtxt.y - this.camera.y;
            this.ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`; this.ctx.fillText(dtxt.text, sx+2, sy+2);
            this.ctx.fillStyle = dtxt.color; this.ctx.globalAlpha = dtxt.life;
            this.ctx.fillText(dtxt.text, sx, sy); this.ctx.globalAlpha = 1.0;
        });

        // NEW: Draw Death Overlay
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

// --- PROJECTILE CLASS ---
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
            this.target.takeDamage(this.damage, Game.player);
            this.life = 0;
        }
    }
}

// --- PATCHING THE UI OBJECT ---
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
            slot.onclick = () => this.handleItemClick(item);
            if (item.count > 1) slot.innerHTML += `<span class="count">${item.count}</span>`;
            grid.appendChild(slot);
        });

        let equipAtk = 0;
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            const item = player.equipment[slotName];
            if (el) {
                el.className = `eq-slot ${item ? 'rarity-' + item.rarity : ''}`;
                el.innerHTML = item ? `<div class="item-label">${item.name[0]}</div>` : '';
                if (item) equipAtk += (item.stats.attack || 0);
            }
        });
        
        const cp = Math.floor((player.level * 150) + (equipAtk * 10));
        const cpEl = document.getElementById('combat-power');
        if (cpEl) cpEl.innerText = cp.toLocaleString();
        this.updateStatsModal(player, cp, equipAtk);
    };

    UI.handleItemClick = function(item) {
        if (item.type === 'equipment') {
            const oldItem = Game.player.equipment[item.slot];
            Game.player.equipment[item.slot] = item;
            Game.player.inventory = Game.player.inventory.filter(i => i !== item);
            if (oldItem) Game.player.inventory.push(oldItem);
            this.showLootNotification(`Equipped ${item.name}`, 'rarity-epic');
        } else if (item.name.includes("Health Potion")) {
            Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + 200);
            item.count--;
            if (item.count <= 0) Game.player.inventory = Game.player.inventory.filter(i => i !== item);
        } else if (item.name.includes("Mana Potion")) {
            Game.player.mp = Math.min(Game.player.maxMp, Game.player.mp + 100);
            item.count--;
            if (item.count <= 0) Game.player.inventory = Game.player.inventory.filter(i => i !== item);
        }
        this.updateInventory(Game.player);
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
        const countEl = document.getElementById('quest-count');
        const questBox = document.getElementById('quest-tracker');
        if (countEl && Game.kills < 40) countEl.innerText = Game.kills;

        if (Game.kills >= 40) {
            questBox.classList.add('quest-complete-glow');
            questBox.innerHTML = `<h4 class="quest-title">[DONE] Click to Claim!</h4><p class="quest-obj">Reward: 500 Gold & 1000 XP</p>`;
            questBox.onclick = () => UI.claimQuest(player);
        }

        const hpPot = player.inventory.find(i => i.name === "Health Potion");
        const mpPot = player.inventory.find(i => i.name === "Mana Potion");
        const hpLabel = document.getElementById('hp-potion-count');
        const mpLabel = document.getElementById('mp-potion-count');
        if (hpLabel) hpLabel.innerText = hpPot ? hpPot.count : 0;
        if (mpLabel) mpLabel.innerText = mpPot ? mpPot.count : 0;
        
        // Update Skill Locking at level 5
        const skillBtn = document.getElementById('btn-skill-1');
        if (skillBtn && player.level >= 5) skillBtn.classList.remove('locked');

        // Update Bars
        const hpFill = document.getElementById('hp-fill');
        const mpFill = document.getElementById('mp-fill');
        const hpTxt = document.getElementById('hp-text');
        if (hpFill) hpFill.style.width = (player.hp / player.maxHp * 100) + "%";
        if (mpFill) mpFill.style.width = (player.mp / player.maxMp * 100) + "%";
        if (hpTxt) hpTxt.innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    };

    UI.claimQuest = function(player) {
        player.gainXp(1000);
        player.gold += 500;
        Game.kills = 0; 
        const questBox = document.getElementById('quest-tracker');
        questBox.style.display = 'none';
        this.showLootNotification("Quest Complete!", "rarity-legendary");
        this.updateInventory(player);
    };
}

window.addEventListener('load', () => Game.init());
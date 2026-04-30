const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    WORLD_SIZE: 3000, TILE_SIZE: 100,
    player: null, enemies: [], lootItems: [], damageTexts: [],
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

        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && enemy.distanceTo({x: worldX, y: worldY}) < enemy.radius + 30) {
                clickedEnemy = enemy; break;
            }
        }
        this.player.target = clickedEnemy; 
    },

    spawnDamageText(x, y, text, color) { this.damageTexts.push({ x, y, text, color, life: 1.0 }); },

    update(dt) {
        this.player.update(dt, this.enemies);
        
        this.camera.x = Math.max(0, Math.min(this.player.x - this.camera.width / 2, this.WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.player.y - this.camera.height / 2, this.WORLD_SIZE - this.camera.height));

        this.enemies.forEach(e => e.update(dt, this.player));
        this.enemies = this.enemies.filter(e => !e.isDead);

        this.lootItems.forEach(item => {
            item.life -= dt;
            if (this.player.distanceTo(item) < 50) {
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
        
        // Draw Background
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
            if (sx < -50 || sx > this.camera.width + 50 || sy < -50 || sy > this.camera.height + 50) return;
            let color = item.rarity === 'legendary' ? "#f1c40f" : item.rarity === 'epic' ? "#9b59b6" : item.rarity === 'rare' ? "#3498db" : "#fff";
            this.ctx.save();
            this.ctx.shadowBlur = 15; this.ctx.shadowColor = color;
            this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(sx, sy, 8, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();
        });

        // Draw Enemies
        this.enemies.forEach(e => {
            const sx = e.x - this.camera.x; const sy = e.y - this.camera.y;
            if (sx < -50 || sx > this.camera.width + 50 || sy < -50 || sy > this.camera.height + 50) return;
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
        const pScreenX = Math.round(this.player.x - this.camera.x);
        const pScreenY = Math.round(this.player.y - this.camera.y);
        if (this.player.target) {
            this.ctx.beginPath(); this.ctx.ellipse(this.player.target.x - this.camera.x, this.player.target.y - this.camera.y + 10, 20, 10, 0, 0, Math.PI*2);
            this.ctx.strokeStyle = '#f00'; this.ctx.lineWidth = 2; this.ctx.stroke();
        }
        let pDraw = this.player.getDrawInfo();
        if (pDraw && pDraw.image) {
            this.ctx.save(); this.ctx.translate(pScreenX, pScreenY); 
            if (!this.player.facingRight) this.ctx.scale(-1, 1); 
            this.ctx.drawImage(pDraw.image, -pDraw.drawWidth/2, -pDraw.drawHeight, pDraw.drawWidth, pDraw.drawHeight);
            this.ctx.restore(); 
        }

        // Draw Damage Text
        this.ctx.font = "bold 20px sans-serif"; this.ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - this.camera.x; const sy = dtxt.y - this.camera.y;
            this.ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`; this.ctx.fillText(dtxt.text, sx+2, sy+2);
            this.ctx.fillStyle = dtxt.color; this.ctx.globalAlpha = dtxt.life;
            this.ctx.fillText(dtxt.text, sx, sy); this.ctx.globalAlpha = 1.0;
        });

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

// --- PATCHING THE UI OBJECT ---
if (typeof UI !== 'undefined') {
    UI.currentInvTab = 'equip';

    UI.setInventoryTab = function(tab) {
        this.currentInvTab = tab;
        document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        this.updateInventory(Game.player);
    };

    UI.updateInventory = function(player) {
        const grid = document.getElementById('inv-grid');
        const goldTxt = document.getElementById('inv-gold');
        if (!grid) return;

        grid.innerHTML = '';
        goldTxt.innerText = player.gold.toLocaleString();

        // Filter inventory by current tab
        const items = player.inventory.filter(item => {
            if (this.currentInvTab === 'equip') return item.type === 'equipment';
            return item.type === 'potion' || item.type === 'rune';
        });

        items.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = `inv-slot rarity-${item.rarity}`;
            slot.title = item.name;
            slot.onclick = () => this.handleItemClick(item);
            
            if (item.count > 1) {
                const count = document.createElement('span');
                count.className = 'count';
                count.innerText = item.count;
                slot.appendChild(count);
            }
            grid.appendChild(slot);
        });

        // Update Equipment Slots
        Object.keys(player.equipment).forEach(slotName => {
            const el = document.querySelector(`.eq-slot[data-slot="${slotName}"]`);
            if (el) el.className = `eq-slot ${player.equipment[slotName] ? 'rarity-' + player.equipment[slotName].rarity : ''}`;
        });
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
}

window.addEventListener('load', () => Game.init());

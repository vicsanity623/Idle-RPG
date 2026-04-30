const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    WORLD_SIZE: 3000, TILE_SIZE: 100,
    player: null, enemies: [], lootItems: [], damageTexts: [], // Added lootItems
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

        // LOAD ASSETS
        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('ghost', 'assets/sleepless_ghost.png');
        // Pre-load common icons for loot if needed
        this.loadAsset('gold_icon', 'assets/potion_mp.png'); // Fallback icon

        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.camera.width = this.canvas.width; this.camera.height = this.canvas.height;
    },

    loadAsset(key, src) {
        const img = new Image(); img.src = src; this.images[key] = img;
    },

    // --- NEW: LOOT SPAWNING ---
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

        // --- NEW: LOOT PICKUP LOGIC ---
        this.lootItems.forEach(item => {
            item.life -= dt;
            // Check if player is close enough to "vacuum" the loot
            if (this.player.distanceTo(item) < 40) {
                this.player.pickUpItem(item);
                item.isPickedUp = true;
            }
        });
        // Remove picked up or expired items
        this.lootItems = this.lootItems.filter(item => !item.isPickedUp && item.life > 0);

        this.damageTexts.forEach(dtxt => { dtxt.y -= 30 * dt; dtxt.life -= dt; });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        if (this.enemies.length < 30) this.enemies.push(new Enemy(Math.random()*this.WORLD_SIZE, Math.random()*this.WORLD_SIZE));
        
        UI.updatePlayerStats(this.player);
        UI.updateXpBar(this.player); // Keep XP bar in sync
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
                if (this.images['bg'] && this.images['bg'].complete && this.images['bg'].naturalWidth > 0) {
                    this.ctx.drawImage(this.images['bg'], px, py, this.TILE_SIZE, this.TILE_SIZE);
                } else {
                    this.ctx.fillStyle = (r+c)%2===0 ? '#2a4a2a' : '#1e381e';
                    this.ctx.fillRect(px, py, this.TILE_SIZE, this.TILE_SIZE);
                }
            }
        }

        // --- NEW: DRAW LOOT ON THE GROUND ---
        this.lootItems.forEach(item => {
            const sx = item.x - this.camera.x; const sy = item.y - this.camera.y;
            if (sx < -50 || sx > this.camera.width + 50 || sy < -50 || sy > this.camera.height + 50) return;

            // Draw Rarity Glow
            let color = "#ffffff";
            if (item.rarity === 'rare') color = "#3498db";
            if (item.rarity === 'epic') color = "#9b59b6";
            if (item.rarity === 'legendary') color = "#f1c40f";

            this.ctx.save();
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = color;
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Draw Enemies
        this.enemies.forEach(e => {
            const sx = e.x - this.camera.x; const sy = e.y - this.camera.y;
            if (sx < -50 || sx > this.camera.width + 50 || sy < -50 || sy > this.camera.height + 50) return;
            
            if (this.images['ghost'] && this.images['ghost'].complete && this.images['ghost'].naturalWidth > 0) {
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
            this.ctx.beginPath();
            this.ctx.ellipse(this.player.target.x - this.camera.x, this.player.target.y - this.camera.y + 10, 20, 10, 0, 0, Math.PI*2);
            this.ctx.strokeStyle = '#f00'; this.ctx.lineWidth = 2; this.ctx.stroke();
        }

        let pDraw = this.player.getDrawInfo();
        if (pDraw && pDraw.image) {
            this.ctx.save();
            this.ctx.translate(pScreenX, pScreenY); 
            if (!this.player.facingRight) this.ctx.scale(-1, 1); 
            this.ctx.drawImage(pDraw.image, -pDraw.drawWidth/2, -pDraw.drawHeight, pDraw.drawWidth, pDraw.drawHeight);
            this.ctx.restore(); 
        } else {
            this.ctx.beginPath(); this.ctx.arc(pScreenX, pScreenY, this.player.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#00f'; this.ctx.fill();
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
        this.miniCtx.strokeStyle = 'white';
        this.miniCtx.strokeRect(this.camera.x * scale, this.camera.y * scale, this.camera.width * scale, this.camera.height * scale);
    },

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; 
        this.lastTime = timestamp;
        this.update(dt); this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
};

// --- PATCHING THE UI OBJECT TO HANDLE NEW ELEMENTS ---
// This ensures that the calls from entities.js actually find their targets in index.html
if (typeof UI !== 'undefined') {
    UI.updateXpBar = function(player) {
        const fill = document.getElementById('exp-fill');
        const text = document.getElementById('exp-text');
        const levelBadge = document.getElementById('player-level');
        
        if (fill) {
            const pct = (player.xp / player.maxXp) * 100;
            fill.style.width = pct + "%";
            if (text) text.innerText = `EXP ${pct.toFixed(3)}%`;
        }
        if (levelBadge) levelBadge.innerText = player.level;
    };

    UI.showLootNotification = function(message, rarityClass) {
        const container = document.getElementById('loot-notification-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `loot-msg ${rarityClass}`;
        el.innerText = message;
        container.appendChild(el);

        // Auto-remove the element after the CSS animation ends (3.5s)
        setTimeout(() => el.remove(), 3500);
    };
}

window.addEventListener('load', () => Game.init());

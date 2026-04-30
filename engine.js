const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    WORLD_SIZE: 3000,
    TILE_SIZE: 100,
    player: null,
    enemies: [],
    projectiles: [],
    damageTexts: [],
    kills: 0,
    
    images: {},
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.miniCanvas = document.getElementById('minimapCanvas');
        this.miniCtx = this.miniCanvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Tapping screen is now purely for targeting enemies, movement is joystick-only
        this.canvas.addEventListener('pointerdown', (e) => this.handleScreenTap(e));

        this.player = new Player(this.WORLD_SIZE/2, this.WORLD_SIZE/2);
        
        for(let i=0; i<30; i++) {
            this.enemies.push(new Enemy(Math.random() * this.WORLD_SIZE, Math.random() * this.WORLD_SIZE));
        }

        // LOAD ASSETS
        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('player_spritesheet', 'assets/player_spritesheet.png');
        this.loadAsset('ghost', 'assets/sleepless_ghost.png');
        this.loadAsset('missile', 'assets/magic_missile.png');

        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
    },

    loadAsset(key, src) {
        const img = new Image();
        img.src = src;
        this.images[key] = img;
    },

    handleScreenTap(e) {
        const rect = this.canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left) + this.camera.x;
        const worldY = (e.clientY - rect.top) + this.camera.y;

        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && enemy.distanceTo({x: worldX, y: worldY}) < enemy.radius + 30) {
                clickedEnemy = enemy;
                break;
            }
        }
        // Set target, or clear target if clicking empty ground
        this.player.target = clickedEnemy; 
    },

    fireProjectile(source, target, assetKey) {
        this.projectiles.push(new Projectile(source, target, 600, assetKey));
    },

    spawnDamageText(x, y, text, color) {
        this.damageTexts.push({ x, y, text, color, life: 1.0 });
    },

    update(dt) {
        this.player.update(dt, this.enemies);
        
        // Follow Player
        this.camera.x = this.player.x - this.camera.width / 2;
        this.camera.y = this.player.y - this.camera.height / 2;
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.WORLD_SIZE - this.camera.height));

        this.enemies.forEach(e => e.update(dt, this.player));
        this.enemies = this.enemies.filter(e => !e.isDead);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => !p.isDead);

        this.damageTexts.forEach(dtxt => { dtxt.y -= 30 * dt; dtxt.life -= dt; });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        if (this.enemies.length < 30) {
             this.enemies.push(new Enemy(Math.random() * this.WORLD_SIZE, Math.random() * this.WORLD_SIZE));
        }

        UI.updatePlayerStats(this.player);
    },

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Culling Background
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

        // Standard Sprite Drawer (Enemies/Projectiles)
        const drawStaticSprite = (entity, imgKey, fallbackColor, drawHP = false) => {
            const sx = entity.x - this.camera.x;
            const sy = entity.y - this.camera.y;
            if (sx < -50 || sx > this.camera.width + 50 || sy < -50 || sy > this.camera.height + 50) return;

            if (this.images[imgKey] && this.images[imgKey].complete && this.images[imgKey].naturalWidth > 0) {
                this.ctx.drawImage(this.images[imgKey], sx - entity.radius, sy - entity.radius, entity.radius*2, entity.radius*2);
            } else {
                this.ctx.beginPath(); this.ctx.arc(sx, sy, entity.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = fallbackColor; this.ctx.fill();
            }

            if (drawHP) {
                this.ctx.fillStyle = '#000'; this.ctx.fillRect(sx - 15, sy - entity.radius - 10, 30, 4);
                this.ctx.fillStyle = '#f00'; this.ctx.fillRect(sx - 15, sy - entity.radius - 10, 30 * (entity.hp / entity.maxHp), 4);
            }
        };

        // Advanced Spritesheet Drawer (Player)
        const drawPlayer = () => {
            const px = this.player.x - this.camera.x;
            const py = this.player.y - this.camera.y;
            const sheet = this.images['player_spritesheet'];

            // Target indicator ring under player
            if (this.player.target) {
                this.ctx.beginPath();
                this.ctx.ellipse(this.player.target.x - this.camera.x, this.player.target.y - this.camera.y + 10, 20, 10, 0, 0, Math.PI*2);
                this.ctx.strokeStyle = '#f00'; this.ctx.lineWidth = 2; this.ctx.stroke();
            }

            if (sheet && sheet.complete && sheet.naturalWidth > 0) {
                const sData = this.player.sprite;
                const srcX = sData.frameX * sData.width;
                const srcY = sData.frameY * sData.height;
                
                // Draw slice of spritesheet centered on player coords
                this.ctx.drawImage(
                    sheet, 
                    srcX, srcY, sData.width, sData.height, // Source cut
                    px - sData.width/2, py - sData.height/2, sData.width, sData.height // Dest drawing
                );
            } else {
                // Fallback blue circle
                this.ctx.beginPath(); this.ctx.arc(px, py, this.player.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00f'; this.ctx.fill();
            }
        };

        this.enemies.forEach(e => drawStaticSprite(e, 'ghost', '#888', true));
        drawPlayer();
        this.projectiles.forEach(p => drawStaticSprite(p, p.assetKey, '#ff0'));

        // Draw Damage Text
        this.ctx.font = "bold 20px sans-serif";
        this.ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - this.camera.x;
            const sy = dtxt.y - this.camera.y;
            this.ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`;
            this.ctx.fillText(dtxt.text, sx+2, sy+2);
            this.ctx.fillStyle = dtxt.color;
            this.ctx.globalAlpha = dtxt.life;
            this.ctx.fillText(dtxt.text, sx, sy);
            this.ctx.globalAlpha = 1.0;
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

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
};

window.addEventListener('load', () => Game.init());

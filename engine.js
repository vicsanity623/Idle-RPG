const Game = {
    canvas: null, ctx: null,
    miniCanvas: null, miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    // World Data
    WORLD_SIZE: 3000,
    TILE_SIZE: 100,
    player: null,
    enemies: [],
    projectiles: [],
    damageTexts: [],
    kills: 0,
    
    // Asset Manager
    images: {},
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.miniCanvas = document.getElementById('minimapCanvas');
        this.miniCtx = this.miniCanvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input handling
        this.canvas.addEventListener('pointerdown', (e) => this.handleInput(e));

        this.player = new Player(this.WORLD_SIZE/2, this.WORLD_SIZE/2);
        
        // Spawn AI Enemies
        for(let i=0; i<30; i++) {
            this.enemies.push(new Enemy(
                Math.random() * this.WORLD_SIZE, 
                Math.random() * this.WORLD_SIZE
            ));
        }

        // Preload assets based on requested names
        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('player', 'assets/player.png');
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

    handleInput(e) {
        // Convert screen coordinates to world coordinates
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = mouseX + this.camera.x;
        const worldY = mouseY + this.camera.y;

        // Check if clicked on an enemy
        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && enemy.distanceTo({x: worldX, y: worldY}) < enemy.radius + 20) {
                clickedEnemy = enemy;
                break;
            }
        }

        if (clickedEnemy) {
            this.player.target = clickedEnemy;
        } else {
            this.player.setDestination(worldX, worldY);
            // Spawn click effect here if desired
        }
    },

    fireProjectile(source, target, assetStr) {
        this.projectiles.push(new Projectile(source, target, 500, assetStr));
    },

    spawnDamageText(x, y, text, color) {
        this.damageTexts.push({ x, y, text, color, life: 1.0 });
    },

    update(dt) {
        this.player.update(dt, this.enemies);
        
        // Update Camera to follow player
        this.camera.x = this.player.x - this.camera.width / 2;
        this.camera.y = this.player.y - this.camera.height / 2;

        // Clamp camera to world bounds
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.WORLD_SIZE - this.camera.height));

        this.enemies.forEach(e => e.update(dt, this.player));
        this.enemies = this.enemies.filter(e => !e.isDead);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => !p.isDead);

        this.damageTexts.forEach(dtxt => { dtxt.y -= 30 * dt; dtxt.life -= dt; });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        // Respawn enemies to keep the world populated
        if (this.enemies.length < 30) {
             this.enemies.push(new Enemy(Math.random() * this.WORLD_SIZE, Math.random() * this.WORLD_SIZE));
        }

        UI.updatePlayerStats(this.player);
    },

    draw() {
        // Intelligent Rendering: View Culling
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Map Tiles (Only render what is visible)
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
                    // Fallback checkerboard for missing assets
                    this.ctx.fillStyle = (r+c)%2===0 ? '#2a4a2a' : '#1e381e';
                    this.ctx.fillRect(px, py, this.TILE_SIZE, this.TILE_SIZE);
                }
            }
        }

        // Draw Helper Function
        const drawSprite = (entity, imgKey, fallbackColor) => {
            const screenX = entity.x - this.camera.x;
            const screenY = entity.y - this.camera.y;
            
            // Culling entities outside camera view
            if (screenX < -50 || screenX > this.camera.width + 50 || screenY < -50 || screenY > this.camera.height + 50) return;

            if (this.images[imgKey] && this.images[imgKey].complete && this.images[imgKey].naturalWidth > 0) {
                this.ctx.drawImage(this.images[imgKey], screenX - entity.radius, screenY - entity.radius, entity.radius*2, entity.radius*2);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, entity.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = fallbackColor;
                this.ctx.fill();
            }

            // Draw Health Bar
            if (entity instanceof Enemy || entity instanceof Player) {
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(screenX - 15, screenY - entity.radius - 10, 30, 4);
                this.ctx.fillStyle = entity instanceof Enemy ? '#f00' : '#0f0';
                this.ctx.fillRect(screenX - 15, screenY - entity.radius - 10, 30 * (entity.hp / entity.maxHp), 4);
            }
        };

        // Draw Entities
        this.enemies.forEach(e => drawSprite(e, 'ghost', '#888'));
        drawSprite(this.player, 'player', '#00f');
        this.projectiles.forEach(p => drawSprite(p, 'missile', '#a0f'));

        // Draw Damage Text
        this.ctx.font = "bold 20px sans-serif";
        this.ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - this.camera.x;
            const sy = dtxt.y - this.camera.y;
            this.ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`;
            this.ctx.fillText(dtxt.text, sx+2, sy+2); // shadow
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
        
        // Enemies
        this.miniCtx.fillStyle = 'red';
        this.enemies.forEach(e => {
            this.miniCtx.fillRect(e.x * scale, e.y * scale, 3, 3);
        });
        
        // Player
        this.miniCtx.fillStyle = 'lime';
        this.miniCtx.fillRect(this.player.x * scale, this.player.y * scale, 4, 4);

        // Camera Frustum
        this.miniCtx.strokeStyle = 'white';
        this.miniCtx.strokeRect(this.camera.x * scale, this.camera.y * scale, this.camera.width * scale, this.camera.height * scale);
    },

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; // clamp delta
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
};

window.addEventListener('load', () => Game.init());

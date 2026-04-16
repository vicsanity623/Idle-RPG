document.addEventListener("DOMContentLoaded", () => {
    // --- STATE ---
    let state = {
        mapSize: 60, tileSize: 64, mapData: [], entities: [],
        activeLayer: 'terrain', activeTool: 'draw', activeId: '1', showGrid: true,
        camera: { x: 0, y: 0, zoom: 1 }
    };

    let currentGameInstance = null; // Holds the active playtest

    // --- CANVAS INIT ---
    const canvas = document.getElementById("editor-canvas");
    const ctx = canvas.getContext("2d");
    const wrapper = document.getElementById("canvas-wrapper");

    function resize() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        renderEditor();
    }
    window.addEventListener('resize', resize);

    function initMap() {
        state.mapData = Array(state.mapSize).fill(0).map(() => Array(state.mapSize).fill(1)); // Grass
        state.entities = [];
        state.camera.x = 0; state.camera.y = 0; state.camera.zoom = 1;
        renderEditor();
    }

    // --- DRAWING PROCEDURAL TILES ---
    function drawTile(context, x, y, type, size) {
        context.save();
        context.translate(x * size, y * size);
        if(type === 1) { context.fillStyle = "#4CAF50"; context.fillRect(0,0,size,size); context.fillStyle = "#388E3C"; context.fillRect(size*0.2, size*0.2, size*0.1, size*0.3); } // Grass
        if(type === 2) { context.fillStyle = "#795548"; context.fillRect(0,0,size,size); } // Dirt
        if(type === 3) { context.fillStyle = "#2196F3"; context.fillRect(0,0,size,size); } // Water
        if(type === 4) { context.fillStyle = "#607D8B"; context.fillRect(0,0,size,size); context.fillStyle="#455A64"; context.fillRect(0, size*0.8, size, size*0.2); } // Wall
        context.restore();
    }

    function renderEditor() {
        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Correct panning/zooming order
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.scale(state.camera.zoom, state.camera.zoom);
        ctx.translate(-canvas.width/2 - state.camera.x, -canvas.height/2 - state.camera.y);

        // Draw Map
        let startX = Math.max(0, Math.floor((state.camera.x - canvas.width/state.camera.zoom/2) / state.tileSize));
        let startY = Math.max(0, Math.floor((state.camera.y - canvas.height/state.camera.zoom/2) / state.tileSize));
        let endX = Math.min(state.mapSize, startX + Math.ceil(canvas.width/state.camera.zoom / state.tileSize) + 2);
        let endY = Math.min(state.mapSize, startY + Math.ceil(canvas.height/state.camera.zoom / state.tileSize) + 2);

        for(let y = 0; y < state.mapSize; y++) {
            for(let x = 0; x < state.mapSize; x++) {
                // Only render if roughly visible
                if(x >= startX && x <= endX && y >= startY && y <= endY) {
                    drawTile(ctx, x, y, state.mapData[y][x], state.tileSize);
                    if(state.showGrid) { ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.strokeRect(x * state.tileSize, y * state.tileSize, state.tileSize, state.tileSize); }
                }
            }
        }

        // Draw Entities
        state.entities.forEach(ent => {
            let px = ent.x * state.tileSize + state.tileSize/2;
            let py = ent.y * state.tileSize + state.tileSize/2;
            ctx.beginPath(); ctx.arc(px, py, state.tileSize*0.4, 0, Math.PI*2);
            if(ent.type === 'player') ctx.fillStyle = document.getElementById("cfg-pcolor").value;
            if(ent.type === 'slime') ctx.fillStyle = "#2ecc71";
            if(ent.type === 'orc') ctx.fillStyle = "#e67e22";
            ctx.fill(); ctx.strokeStyle = "#fff"; ctx.stroke();
            
            ctx.fillStyle = "#fff"; ctx.font = "16px FontAwesome"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            if(ent.type === 'player') ctx.fillText("\uf007", px, py);
            if(ent.type === 'slime') ctx.fillText("\uf6e2", px, py);
            if(ent.type === 'orc') ctx.fillText("\uf714", px, py);
        });

        // Bounds
        ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, state.mapSize * state.tileSize, state.mapSize * state.tileSize);
        ctx.restore();
    }

    // --- INTERACTION MATH FIXED ---
    let isDragging = false;
    let lastMouse = {x: 0, y: 0};

    function getTileFromMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Reverse engineer the camera math
        const worldX = (mouseX - canvas.width/2) / state.camera.zoom + canvas.width/2 + state.camera.x;
        const worldY = (mouseY - canvas.height/2) / state.camera.zoom + canvas.height/2 + state.camera.y;
        return { tx: Math.floor(worldX / state.tileSize), ty: Math.floor(worldY / state.tileSize) };
    }

    wrapper.addEventListener("mousedown", (e) => {
        isDragging = true;
        lastMouse = {x: e.clientX, y: e.clientY};
        if(state.activeTool === 'draw' && e.button !== 1) applyTool(e);
    });

    window.addEventListener("mouseup", () => isDragging = false);
    wrapper.addEventListener("mousemove", (e) => {
        if(!isDragging) return;
        if(state.activeTool === 'pan' || e.buttons === 4) { // Pan or middle click
            state.camera.x -= (e.clientX - lastMouse.x) / state.camera.zoom;
            state.camera.y -= (e.clientY - lastMouse.y) / state.camera.zoom;
            lastMouse = {x: e.clientX, y: e.clientY};
            renderEditor();
        } else if(state.activeTool === 'draw' && state.activeLayer === 'terrain') {
            applyTool(e);
        }
    });

    wrapper.addEventListener("wheel", (e) => {
        e.preventDefault();
        state.camera.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
        renderEditor();
    });

    function applyTool(e) {
        const {tx, ty} = getTileFromMouse(e);
        if(tx >= 0 && tx < state.mapSize && ty >= 0 && ty < state.mapSize) {
            if(state.activeLayer === 'terrain') {
                state.mapData[ty][tx] = parseInt(state.activeId);
            } else if(state.activeLayer === 'entity') {
                state.entities = state.entities.filter(ent => ent.x !== tx || ent.y !== ty); // clear tile
                if(state.activeId !== 'erase') {
                    if(state.activeId === 'player') state.entities = state.entities.filter(ent => ent.type !== 'player'); // Only 1 player
                    state.entities.push({type: state.activeId, x: tx, y: ty});
                }
            }
            renderEditor();
        }
    }

    // --- UI BINDINGS ---
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            state.activeLayer = e.currentTarget.dataset.type;
            state.activeId = e.currentTarget.dataset.id;
            state.activeTool = 'draw';
            document.getElementById("tool-pan").classList.remove("active");
            document.getElementById("tool-draw").classList.add("active");
            wrapper.style.cursor = 'crosshair';
        });
    });

    document.getElementById("tool-pan").addEventListener("click", function() {
        state.activeTool = 'pan';
        document.getElementById("tool-draw").classList.remove("active");
        this.classList.add("active");
        wrapper.style.cursor = 'grab';
    });
    
    document.getElementById("tool-draw").addEventListener("click", function() {
        state.activeTool = 'draw';
        document.getElementById("tool-pan").classList.remove("active");
        this.classList.add("active");
        wrapper.style.cursor = 'crosshair';
    });

    document.getElementById("tool-grid").addEventListener("click", function() {
        state.showGrid = !state.showGrid;
        this.classList.toggle("active");
        renderEditor();
    });

    document.getElementById("btn-generate").addEventListener("click", () => {
        for(let y=0; y<state.mapSize; y++) {
            for(let x=0; x<state.mapSize; x++) {
                let r = Math.random();
                if(r < 0.05) state.mapData[y][x] = 4; // wall
                else if(r < 0.15) state.mapData[y][x] = 3; // water
                else if(r < 0.3) state.mapData[y][x] = 2; // dirt
                else state.mapData[y][x] = 1; // grass
            }
        }
        renderEditor();
    });

    document.querySelectorAll(".prop-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".prop-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".prop-pane").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            document.getElementById(e.currentTarget.dataset.target).classList.add("active");
        });
    });

    document.getElementById("cfg-mapsize").addEventListener("change", (e) => {
        state.mapSize = parseInt(e.target.value);
        initMap();
    });

    // Guide Modal
    document.getElementById("btn-help").addEventListener("click", () => document.getElementById("guide-modal").style.display = "flex");
    document.getElementById("btn-close-guide").addEventListener("click", () => document.getElementById("guide-modal").style.display = "none");

    // Init
    resize();
    initMap();


    // =====================================================================
    // --- THE GAME ENGINE (USED FOR PLAYTEST AND EXPORT) ---
    // =====================================================================

    function generateGameConfig() {
        return {
            title: document.getElementById("cfg-title").value,
            tileSize: state.tileSize, mapSize: state.mapSize, mapData: state.mapData, entities: state.entities,
            player: {
                color: document.getElementById("cfg-pcolor").value, weaponColor: document.getElementById("cfg-wcolor").value,
                hp: parseInt(document.getElementById("cfg-php").value), atk: parseInt(document.getElementById("cfg-patk").value),
                speed: parseInt(document.getElementById("cfg-pspeed").value), autoAttack: document.getElementById("cfg-autoattack").checked
            },
            hud: {
                menuBg: document.getElementById("cfg-menubg").value, menuTxt: document.getElementById("cfg-menutxt").value,
                hpColor: document.getElementById("cfg-hpcolor").value, xpColor: document.getElementById("cfg-xpcolor").value,
                joystick: document.getElementById("cfg-joystick").checked
            }
        };
    }

    class RuntimeEngine {
        constructor(config) {
            this.config = config;
            this.canvas = document.getElementById("game-canvas");
            this.ctx = this.canvas.getContext("2d");
            this.lastTime = performance.now();
            this.camera = { x: 0, y: 0 };
            this.keys = {};
            this.joystick = { x: 0, y: 0, active: false };
            this.enemies = [];
            this.particles = [];
            this.isRunning = true;

            // Find Player Spawn
            let pSpawn = this.config.entities.find(e => e.type === 'player');
            let startX = pSpawn ? pSpawn.x * this.config.tileSize : 2 * this.config.tileSize;
            let startY = pSpawn ? pSpawn.y * this.config.tileSize : 2 * this.config.tileSize;

            this.player = {
                x: startX, y: startY, radius: this.config.tileSize * 0.4,
                speed: this.config.player.speed, maxHp: this.config.player.hp, hp: this.config.player.hp,
                atk: this.config.player.atk, range: 100, cooldown: 0, xp: 0, level: 1
            };

            this.config.entities.forEach(ent => {
                if(ent.type !== 'player') {
                    this.enemies.push({
                        x: ent.x * this.config.tileSize, y: ent.y * this.config.tileSize,
                        radius: this.config.tileSize * 0.4, type: ent.type,
                        hp: ent.type === 'orc' ? 50 : 20, maxHp: ent.type === 'orc' ? 50 : 20,
                        speed: ent.type === 'orc' ? 50 : 80, atk: ent.type === 'orc' ? 5 : 2, cooldown: 0
                    });
                }
            });

            this.bindEvents();
            this.resize();
            this.loop(performance.now());
        }

        resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

        bindEvents() {
            this.keydown = e => this.keys[e.key.toLowerCase()] = true;
            this.keyup = e => this.keys[e.key.toLowerCase()] = false;
            this.resizer = () => this.resize();
            window.addEventListener("keydown", this.keydown);
            window.addEventListener("keyup", this.keyup);
            window.addEventListener("resize", this.resizer);

            // Joystick Logic
            const stick = document.getElementById("joystick-stick");
            const base = document.getElementById("joystick-base");
            if(base) {
                this.touchMove = (e) => {
                    if(!this.joystick.active) return;
                    e.preventDefault();
                    let touch = e.touches ? e.touches[0] : e;
                    let rect = base.getBoundingClientRect();
                    let dx = touch.clientX - (rect.left + rect.width/2);
                    let dy = touch.clientY - (rect.top + rect.height/2);
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    let max = rect.width/2 - 25;
                    if(dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; }
                    stick.style.transform = \`translate(\${dx}px, \${dy}px)\`;
                    this.joystick.x = dx / max; this.joystick.y = dy / max;
                };
                this.touchStart = e => { this.joystick.active = true; this.touchMove(e); };
                this.touchEnd = () => { this.joystick.active = false; this.joystick.x = 0; this.joystick.y = 0; stick.style.transform = \`translate(0px, 0px)\`; };
                
                base.addEventListener("touchstart", this.touchStart, {passive: false});
                window.addEventListener("touchmove", this.touchMove, {passive: false});
                window.addEventListener("touchend", this.touchEnd);
            }
        }

        destroy() {
            this.isRunning = false;
            window.removeEventListener("keydown", this.keydown);
            window.removeEventListener("keyup", this.keyup);
            window.removeEventListener("resize", this.resizer);
        }

        spawnText(text, x, y, color) { this.particles.push({ text, x, y, color, life: 1.0 }); }

        update(dt) {
            let dx = 0, dy = 0;
            if(this.keys['w'] || this.keys['arrowup']) dy = -1;
            if(this.keys['s'] || this.keys['arrowdown']) dy = 1;
            if(this.keys['a'] || this.keys['arrowleft']) dx = -1;
            if(this.keys['d'] || this.keys['arrowright']) dx = 1;
            if(this.joystick.active) { dx = this.joystick.x; dy = this.joystick.y; }

            let len = Math.sqrt(dx*dx + dy*dy);
            if(len > 0) { dx /= len; dy /= len; }

            let nx = this.player.x + dx * this.player.speed * dt;
            let ny = this.player.y + dy * this.player.speed * dt;

            // Collision
            let tx = Math.floor(nx / this.config.tileSize); let ty = Math.floor(ny / this.config.tileSize);
            if(tx >= 0 && tx < this.config.mapSize && ty >= 0 && ty < this.config.mapSize) {
                let t = this.config.mapData[ty][tx];
                if(t !== 3 && t !== 4) { this.player.x = nx; this.player.y = ny; }
            }

            this.camera.x = this.player.x - this.canvas.width/2;
            this.camera.y = this.player.y - this.canvas.height/2;

            if(this.player.cooldown > 0) this.player.cooldown -= dt;
            
            // Enemies
            for(let i = this.enemies.length - 1; i >= 0; i--) {
                let e = this.enemies[i];
                let edx = this.player.x - e.x; let edy = this.player.y - e.y;
                let dist = Math.sqrt(edx*edx + edy*edy);

                if(dist < 400 && dist > this.player.radius * 2) {
                    e.x += (edx/dist) * e.speed * dt; e.y += (edy/dist) * e.speed * dt;
                }

                if(e.cooldown > 0) e.cooldown -= dt;
                if(dist <= this.player.radius * 2.5 && e.cooldown <= 0) {
                    this.player.hp -= e.atk;
                    this.spawnText("-" + e.atk, this.player.x, this.player.y - 30, "#ff0000");
                    e.cooldown = 1.5;
                }

                // Player Auto Attack
                if(this.config.player.autoAttack && dist <= this.player.range && this.player.cooldown <= 0) {
                    e.hp -= this.player.atk;
                    this.spawnText("-" + this.player.atk, e.x, e.y - 30, "#fff");
                    this.player.cooldown = 0.8;
                    this.particles.push({ type: 'slash', x: e.x, y: e.y, life: 0.2 });
                }

                if(e.hp <= 0) {
                    this.enemies.splice(i, 1);
                    this.player.xp += 35;
                    this.spawnText("+35 XP", e.x, e.y, "#ffff00");
                    if(this.player.xp >= 100) {
                        this.player.level++; this.player.xp = 0; this.player.maxHp += 20; this.player.hp = this.player.maxHp; this.player.atk += 5;
                        this.spawnText("LEVEL UP!", this.player.x, this.player.y - 40, "#00ff00");
                    }
                }
            }

            for(let i = this.particles.length - 1; i >= 0; i--) {
                let p = this.particles[i]; p.life -= dt;
                if(p.text) p.y -= 50 * dt;
                if(p.life <= 0) this.particles.splice(i, 1);
            }

            // HUD
            document.getElementById("hp-fill").style.width = Math.max(0, (this.player.hp / this.player.maxHp * 100)) + "%";
            document.getElementById("xp-fill").style.width = (this.player.xp / 100 * 100) + "%";
            document.getElementById("lvl-text").innerText = "LVL " + this.player.level;
            
            // Apply HUD colors dynamically
            document.getElementById("hp-fill").style.background = this.config.hud.hpColor;
            document.getElementById("xp-fill").style.background = this.config.hud.xpColor;
            
            if(this.player.hp <= 0) { this.spawnText("YOU DIED", this.player.x, this.player.y, "#ff0000"); this.player.speed = 0; }
        }

        draw() {
            this.ctx.fillStyle = "#000"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save(); this.ctx.translate(-this.camera.x, -this.camera.y);

            let startX = Math.max(0, Math.floor(this.camera.x / this.config.tileSize));
            let startY = Math.max(0, Math.floor(this.camera.y / this.config.tileSize));
            let endX = Math.min(this.config.mapSize, startX + Math.ceil(this.canvas.width / this.config.tileSize) + 1);
            let endY = Math.min(this.config.mapSize, startY + Math.ceil(this.canvas.height / this.config.tileSize) + 1);

            for(let y=startY; y<endY; y++) {
                for(let x=startX; x<endX; x++) {
                    let type = this.config.mapData[y][x]; let s = this.config.tileSize;
                    this.ctx.save(); this.ctx.translate(x*s, y*s);
                    if(type===1){ this.ctx.fillStyle="#4CAF50"; this.ctx.fillRect(0,0,s,s); this.ctx.fillStyle="#388E3C"; this.ctx.fillRect(s*0.2,s*0.2,s*0.1,s*0.3);}
                    if(type===2){ this.ctx.fillStyle="#795548"; this.ctx.fillRect(0,0,s,s); }
                    if(type===3){ this.ctx.fillStyle="#2196F3"; this.ctx.fillRect(0,0,s,s); }
                    if(type===4){ this.ctx.fillStyle="#607D8B"; this.ctx.fillRect(0,0,s,s); this.ctx.fillStyle="#455A64"; this.ctx.fillRect(0, s*0.8, s, s*0.2); }
                    this.ctx.restore();
                }
            }

            // Player
            this.ctx.save(); this.ctx.translate(this.player.x, this.player.y);
            this.ctx.fillStyle = "rgba(0,0,0,0.3)"; this.ctx.beginPath(); this.ctx.ellipse(0, this.player.radius*0.8, this.player.radius, this.player.radius*0.4, 0, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = this.config.player.color; this.ctx.beginPath(); this.ctx.arc(0, 0, this.player.radius, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = this.config.player.weaponColor; this.ctx.fillRect(this.player.radius*0.5, -this.player.radius, 8, this.player.radius*2);
            if(this.config.player.autoAttack) { this.ctx.strokeStyle = "rgba(255,255,255,0.1)"; this.ctx.beginPath(); this.ctx.arc(0, 0, this.player.range, 0, Math.PI*2); this.ctx.stroke(); }
            this.ctx.restore();

            // Enemies
            this.enemies.forEach(e => {
                this.ctx.save(); this.ctx.translate(e.x, e.y);
                this.ctx.fillStyle = "rgba(0,0,0,0.3)"; this.ctx.beginPath(); this.ctx.ellipse(0, e.radius*0.8, e.radius, e.radius*0.4, 0, 0, Math.PI*2); this.ctx.fill();
                this.ctx.fillStyle = e.type === 'slime' ? "#2ecc71" : "#e67e22"; this.ctx.beginPath(); this.ctx.arc(0, 0, e.radius, 0, Math.PI*2); this.ctx.fill();
                this.ctx.fillStyle = "#f00"; this.ctx.fillRect(-20, -e.radius-15, 40, 5);
                this.ctx.fillStyle = "#0f0"; this.ctx.fillRect(-20, -e.radius-15, 40 * (e.hp/e.maxHp), 5);
                this.ctx.restore();
            });

            // Particles
            this.particles.forEach(p => {
                if(p.text) { this.ctx.fillStyle = p.color; this.ctx.font = "bold 20px Arial"; this.ctx.fillText(p.text, p.x-20, p.y); }
                else if (p.type === 'slash') { this.ctx.strokeStyle = "#fff"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 30, 0, Math.PI * (1-p.life)); this.ctx.stroke(); }
            });
            this.ctx.restore();
        }

        loop(time) {
            if(!this.isRunning) return;
            let dt = (time - this.lastTime) / 1000; this.lastTime = time;
            if(dt > 0.1) dt = 0.1;
            this.update(dt); this.draw();
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    // --- PLAYTEST NATIVE HOOKS ---
    document.getElementById("btn-playtest").addEventListener("click", () => {
        let spawn = state.entities.find(e => e.type === 'player');
        if(!spawn) { alert("You must place a Player Spawn (Blue icon) on the map first!"); return; }
        
        document.getElementById("editor-ui").style.display = "none";
        document.getElementById("live-game-ui").style.display = "block";
        document.getElementById("joystick-zone").style.display = document.getElementById("cfg-joystick").checked ? "block" : "none";
        
        currentGameInstance = new RuntimeEngine(generateGameConfig());
    });

    document.getElementById("btn-stop-playtest").addEventListener("click", () => {
        if(currentGameInstance) currentGameInstance.destroy();
        document.getElementById("live-game-ui").style.display = "none";
        document.getElementById("editor-ui").style.display = "flex";
        resize(); // fix editor canvas size
    });

    // --- ZIP EXPORT ---
    document.getElementById("btn-export").addEventListener("click", () => {
        const zip = new JSZip();
        let configJson = JSON.stringify(generateGameConfig());
        let c = JSON.parse(configJson);

        const htmlStr = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${c.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; font-family: sans-serif; }
        body { background: #000; overflow: hidden; }
        #main-menu { position: fixed; width: 100vw; height: 100vh; background: ${c.hud.menuBg}; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; }
        #main-menu h1 { color: ${c.hud.menuTxt}; font-size: 3rem; margin-bottom: 2rem; text-shadow: 2px 2px 5px rgba(0,0,0,0.5); }
        #start-btn { padding: 15px 40px; font-size: 1.5rem; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        #game-ui { display: none; }
        canvas { display: block; width: 100vw; height: 100vh; }
        #hud { position: fixed; top: 20px; left: 20px; width: 250px; z-index: 10; pointer-events: none; }
        #lvl-text { color: white; font-size: 24px; font-weight: bold; margin-bottom: 5px; text-shadow: 2px 2px 0 #000; }
        .bar-wrap { background: rgba(0,0,0,0.7); border: 2px solid #fff; height: 25px; margin-bottom: 10px; border-radius: 12px; overflow: hidden; position: relative; }
        .bar-fill { height: 100%; transition: width 0.2s; }
        #hp-fill { background: ${c.hud.hpColor}; width: 100%; }
        #xp-fill { background: ${c.hud.xpColor}; width: 0%; }
        .bar-text { position: absolute; width: 100%; text-align: center; top: 3px; color: white; font-weight: bold; font-size: 14px; text-shadow: 1px 1px 1px #000; }
        #joystick-zone { position: fixed; bottom: 30px; left: 30px; width: 150px; height: 150px; z-index: 20; display: ${c.hud.joystick ? 'block' : 'none'}; }
        #joystick-base { width: 100%; height: 100%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: flex; justify-content: center; align-items: center; }
        #joystick-stick { width: 60px; height: 60px; background: rgba(255,255,255,0.6); border-radius: 50%; }
    </style>
</head>
<body>
    <div id="main-menu"><h1>${c.title}</h1><button id="start-btn">PLAY GAME</button></div>
    <div id="game-ui">
        <canvas id="game-canvas"></canvas>
        <div id="hud">
            <div id="lvl-text">LVL 1</div>
            <div class="bar-wrap"><div id="hp-fill" class="bar-fill"></div><div class="bar-text">HEALTH</div></div>
            <div class="bar-wrap"><div id="xp-fill" class="bar-fill"></div><div class="bar-text">XP</div></div>
        </div>
        <div id="joystick-zone"><div id="joystick-base"><div id="joystick-stick"></div></div></div>
    </div>
    <script src="engine.js"><\/script>
</body>
</html>`;

        // We pull the exact class we used for playtest and wrap it for export
        const jsStr = `
const GAME_CONFIG = ${configJson};
${RuntimeEngine.toString()}
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("game-ui").style.display = "block";
    new RuntimeEngine(GAME_CONFIG);
});
`;
        zip.file("index.html", htmlStr);
        zip.file("engine.js", jsStr);
        
        zip.generateAsync({ type: "blob" }).then(function(content) {
            saveAs(content, "MyCustomGame.zip");
        });
    });
});

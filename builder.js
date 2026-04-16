document.addEventListener("DOMContentLoaded", () => {
    // --- STUDIO STATE ---
    let state = {
        mapSize: 60,
        tileSize: 64,
        mapData: [],
        entities: [],
        activeLayer: 'terrain', // terrain or entity
        activeTool: 'draw',     // draw, pan, fill
        activeId: '1',          // tile ID or entity ID
        showGrid: true,
        camera: { x: 0, y: 0, zoom: 1 }
    };

    // Initialize Map
    function initMap() {
        state.mapData = Array(state.mapSize).fill(0).map(() => Array(state.mapSize).fill(1)); // Fill with grass
        state.entities = [];
        centerCamera();
        renderEditor();
    }

    // --- CANVAS ENGINE (EDITOR) ---
    const canvas = document.getElementById("editor-canvas");
    const ctx = canvas.getContext("2d");
    const wrapper = document.getElementById("canvas-wrapper");

    function resize() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        renderEditor();
    }
    window.addEventListener('resize', resize);
    
    function centerCamera() {
        state.camera.x = (state.mapSize * state.tileSize) / 2 - canvas.width / 2;
        state.camera.y = (state.mapSize * state.tileSize) / 2 - canvas.height / 2;
    }

    // High-Detail Procedural Drawing (Call of Duty Emblem style composed shapes)
    function drawProceduralTile(x, y, type, size) {
        ctx.save();
        ctx.translate(x * size, y * size);
        
        switch(parseInt(type)) {
            case 1: // Grass
                ctx.fillStyle = "#4CAF50"; ctx.fillRect(0,0,size,size);
                ctx.fillStyle = "#388E3C";
                // Detail lines
                ctx.fillRect(size*0.2, size*0.2, size*0.1, size*0.3);
                ctx.fillRect(size*0.7, size*0.5, size*0.1, size*0.2);
                break;
            case 2: // Dirt
                ctx.fillStyle = "#795548"; ctx.fillRect(0,0,size,size);
                ctx.fillStyle = "#5D4037";
                ctx.beginPath(); ctx.arc(size*0.3, size*0.3, size*0.1, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(size*0.8, size*0.7, size*0.15, 0, Math.PI*2); ctx.fill();
                break;
            case 3: // Water
                ctx.fillStyle = "#2196F3"; ctx.fillRect(0,0,size,size);
                ctx.strokeStyle = "#64B5F6"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(size*0.2, size*0.3); ctx.lineTo(size*0.5, size*0.4); ctx.lineTo(size*0.8, size*0.3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(size*0.1, size*0.7); ctx.lineTo(size*0.4, size*0.8); ctx.lineTo(size*0.7, size*0.7); ctx.stroke();
                break;
            case 4: // Wall
                ctx.fillStyle = "#607D8B"; ctx.fillRect(0,0,size,size);
                ctx.strokeStyle = "#455A64"; ctx.lineWidth = 2;
                // Brick pattern
                ctx.strokeRect(0,0,size,size/2); ctx.strokeRect(0,size/2,size,size/2);
                ctx.beginPath(); ctx.moveTo(size/2,0); ctx.lineTo(size/2,size/2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(size/4,size/2); ctx.lineTo(size/4,size); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(size*0.75,size/2); ctx.lineTo(size*0.75,size); ctx.stroke();
                break;
            case 5: // Sand
                ctx.fillStyle = "#FFC107"; ctx.fillRect(0,0,size,size);
                ctx.fillStyle = "#FFA000";
                for(let i=0; i<5; i++) ctx.fillRect(Math.random()*size, Math.random()*size, 2, 2);
                break;
        }
        ctx.restore();
    }

    function renderEditor() {
        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-state.camera.x, -state.camera.y);
        ctx.scale(state.camera.zoom, state.camera.zoom);

        // Draw Map Terrain
        for(let y=0; y<state.mapSize; y++) {
            for(let x=0; x<state.mapSize; x++) {
                drawProceduralTile(x, y, state.mapData[y][x], state.tileSize);
                if(state.showGrid) {
                    ctx.strokeStyle = "rgba(255,255,255,0.1)";
                    ctx.strokeRect(x * state.tileSize, y * state.tileSize, state.tileSize, state.tileSize);
                }
            }
        }

        // Draw Entities
        state.entities.forEach(ent => {
            let px = ent.x * state.tileSize + state.tileSize/2;
            let py = ent.y * state.tileSize + state.tileSize/2;
            
            ctx.beginPath();
            ctx.arc(px, py, state.tileSize*0.4, 0, Math.PI*2);
            if(ent.type === 'player') ctx.fillStyle = document.getElementById("cfg-pcolor").value;
            if(ent.type === 'slime') ctx.fillStyle = "#2ecc71";
            if(ent.type === 'orc') ctx.fillStyle = "#e67e22";
            ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.stroke();
            
            // Icon
            ctx.fillStyle = "#fff";
            ctx.font = "16px FontAwesome";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if(ent.type === 'player') ctx.fillText("\uf007", px, py); // user icon
            if(ent.type === 'slime') ctx.fillText("\uf6e2", px, py); // ghost icon
            if(ent.type === 'orc') ctx.fillText("\uf714", px, py); // sword icon
        });

        // Map Bounds
        ctx.strokeStyle = "#f00";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, state.mapSize * state.tileSize, state.mapSize * state.tileSize);

        ctx.restore();
    }

    // --- INTERACTION ---
    let isDragging = false;
    let lastMouse = {x: 0, y: 0};

    wrapper.addEventListener("mousedown", (e) => {
        isDragging = true;
        lastMouse = {x: e.clientX, y: e.clientY};
        if(state.activeTool === 'draw') applyTool(e);
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
        const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
        state.camera.zoom *= zoomAmount;
        renderEditor();
    });

    function applyTool(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left + state.camera.x) / state.camera.zoom;
        const mouseY = (e.clientY - rect.top + state.camera.y) / state.camera.zoom;
        
        const tx = Math.floor(mouseX / state.tileSize);
        const ty = Math.floor(mouseY / state.tileSize);

        if(tx >= 0 && tx < state.mapSize && ty >= 0 && ty < state.mapSize) {
            if(state.activeLayer === 'terrain') {
                if(state.activeTool === 'draw') {
                    state.mapData[ty][tx] = parseInt(state.activeId);
                }
            } else if(state.activeLayer === 'entity') {
                // Remove existing entity at this tile
                state.entities = state.entities.filter(ent => ent.x !== tx || ent.y !== ty);
                if(state.activeId !== 'erase') {
                    // Enforce 1 player
                    if(state.activeId === 'player') {
                        state.entities = state.entities.filter(ent => ent.type !== 'player');
                    }
                    state.entities.push({type: state.activeId, x: tx, y: ty});
                }
            }
            renderEditor();
        }
    }

    // --- UI BINDINGS ---
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const target = e.currentTarget;
            document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            target.classList.add("active");
            state.activeLayer = target.dataset.type;
            state.activeId = target.dataset.id;
            state.activeTool = 'draw';
            document.querySelectorAll(".viewport-toolbar button").forEach(b => b.classList.remove("active"));
            document.getElementById("tool-draw").classList.add("active");
        });
    });

    document.getElementById("tool-pan").addEventListener("click", function() {
        state.activeTool = 'pan';
        document.querySelectorAll(".viewport-toolbar button").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
    });
    
    document.getElementById("tool-draw").addEventListener("click", function() {
        state.activeTool = 'draw';
        document.querySelectorAll(".viewport-toolbar button").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
    });

    document.getElementById("tool-grid").addEventListener("click", function() {
        state.showGrid = !state.showGrid;
        this.classList.toggle("active");
        renderEditor();
    });

    document.getElementById("btn-generate").addEventListener("click", () => {
        // Advanced Procedural Terrain Generation (Simplex/Noise approximation via cellular automata)
        for(let y=0; y<state.mapSize; y++) {
            for(let x=0; x<state.mapSize; x++) {
                let r = Math.random();
                if(r < 0.05) state.mapData[y][x] = 4; // wall
                else if(r < 0.15) state.mapData[y][x] = 3; // water
                else if(r < 0.3) state.mapData[y][x] = 2; // dirt
                else state.mapData[y][x] = 1; // grass
            }
        }
        // Place some random enemies
        state.entities = state.entities.filter(e => e.type === 'player'); // Keep player
        for(let i=0; i<state.mapSize/2; i++) {
            state.entities.push({
                type: Math.random() > 0.5 ? 'slime' : 'orc',
                x: Math.floor(Math.random() * state.mapSize),
                y: Math.floor(Math.random() * state.mapSize)
            });
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

    // Run Once
    resize();
    initMap();


    // =====================================================================
    // --- COMPILER / EXPORTER ENGINE ---
    // =====================================================================

    function generateGameConfig() {
        return {
            title: document.getElementById("cfg-title").value,
            cameraMode: document.getElementById("cfg-camera").value,
            tileSize: parseInt(document.getElementById("cfg-tilesize").value),
            mapSize: state.mapSize,
            mapData: state.mapData,
            entities: state.entities,
            player: {
                color: document.getElementById("cfg-pcolor").value,
                weaponColor: document.getElementById("cfg-wcolor").value,
                hp: parseInt(document.getElementById("cfg-php").value),
                atk: parseInt(document.getElementById("cfg-patk").value),
                speed: parseInt(document.getElementById("cfg-pspeed").value),
                range: parseInt(document.getElementById("cfg-prange").value),
                autoAttack: document.getElementById("cfg-autoattack").checked
            },
            hud: {
                menuBg: document.getElementById("cfg-menubg").value,
                menuTxt: document.getElementById("cfg-menutxt").value,
                hpColor: document.getElementById("cfg-hpcolor").value,
                xpColor: document.getElementById("cfg-xpcolor").value,
                style: document.getElementById("cfg-uistyle").value,
                joystick: document.getElementById("cfg-joystick").checked
            }
        };
    }

    // This string contains the Full Runtime Engine logic exported to the player
    const getEngineCode = (configJson) => `
const CONFIG = ${configJson};

class RuntimeEngine {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d");
        this.lastTime = performance.now();
        
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.joystick = { x: 0, y: 0, active: false };
        
        this.player = null;
        this.enemies = [];
        this.particles = [];

        this.initEntities();
        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        requestAnimationFrame((t) => this.loop(t));
    }

    initEntities() {
        // Find Player Spawn
        let pSpawn = CONFIG.entities.find(e => e.type === 'player');
        let startX = pSpawn ? pSpawn.x * CONFIG.tileSize : 2 * CONFIG.tileSize;
        let startY = pSpawn ? pSpawn.y * CONFIG.tileSize : 2 * CONFIG.tileSize;

        this.player = {
            x: startX, y: startY,
            radius: CONFIG.tileSize * 0.4,
            speed: CONFIG.player.speed,
            maxHp: CONFIG.player.hp,
            hp: CONFIG.player.hp,
            atk: CONFIG.player.atk,
            range: CONFIG.player.range,
            cooldown: 0,
            xp: 0,
            level: 1
        };

        CONFIG.entities.forEach(ent => {
            if(ent.type !== 'player') {
                this.enemies.push({
                    x: ent.x * CONFIG.tileSize,
                    y: ent.y * CONFIG.tileSize,
                    radius: CONFIG.tileSize * 0.4,
                    type: ent.type,
                    hp: ent.type === 'orc' ? 50 : 20,
                    maxHp: ent.type === 'orc' ? 50 : 20,
                    speed: ent.type === 'orc' ? 50 : 80,
                    atk: ent.type === 'orc' ? 5 : 2
                });
            }
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initEvents() {
        window.addEventListener("keydown", e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener("keyup", e => this.keys[e.key.toLowerCase()] = false);

        if(CONFIG.hud.joystick) {
            const stick = document.getElementById("joystick-stick");
            const base = document.getElementById("joystick-base");
            if(!base) return;
            
            const moveStick = (e) => {
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
                this.joystick.x = dx / max;
                this.joystick.y = dy / max;
            };

            base.addEventListener("touchstart", e => { this.joystick.active = true; moveStick(e); }, {passive: false});
            window.addEventListener("touchmove", moveStick, {passive: false});
            window.addEventListener("touchend", () => {
                this.joystick.active = false;
                this.joystick.x = 0; this.joystick.y = 0;
                stick.style.transform = \`translate(0px, 0px)\`;
            });
        }
    }

    spawnText(text, x, y, color) {
        this.particles.push({ text, x, y, color, life: 1.0 });
    }

    update(dt) {
        // Player Movement
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

        // Collision logic
        let tx = Math.floor(nx / CONFIG.tileSize);
        let ty = Math.floor(ny / CONFIG.tileSize);
        if(tx >= 0 && tx < CONFIG.mapSize && ty >= 0 && ty < CONFIG.mapSize) {
            let t = CONFIG.mapData[ty][tx];
            if(t !== 3 && t !== 4) { // 3=Water, 4=Wall
                this.player.x = nx;
                this.player.y = ny;
            }
        }

        // Camera Follow
        this.camera.x = this.player.x - this.canvas.width/2;
        this.camera.y = this.player.y - this.canvas.height/2;

        // Auto Attack Logic
        if(this.player.cooldown > 0) this.player.cooldown -= dt;
        
        // Enemy AI & Combat
        for(let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            let edx = this.player.x - e.x;
            let edy = this.player.y - e.y;
            let dist = Math.sqrt(edx*edx + edy*edy);

            // Chase
            if(dist < 400 && dist > this.player.radius * 2) {
                e.x += (edx/dist) * e.speed * dt;
                e.y += (edy/dist) * e.speed * dt;
            }

            // Player attacks enemy
            if(CONFIG.player.autoAttack && dist <= CONFIG.player.range && this.player.cooldown <= 0) {
                e.hp -= this.player.atk;
                this.spawnText("-" + this.player.atk, e.x, e.y - 30, "#ff0000");
                this.player.cooldown = 1.0; // 1 second cooldown
                
                // Draw a quick attack slash (handled in render via timeout trick or particles, kept simple here)
                this.particles.push({ type: 'slash', x: e.x, y: e.y, life: 0.2 });
            }

            if(e.hp <= 0) {
                this.enemies.splice(i, 1);
                this.player.xp += 20;
                this.spawnText("+20 XP", e.x, e.y, "#ffff00");
                if(this.player.xp >= 100) {
                    this.player.level++;
                    this.player.xp = 0;
                    this.player.maxHp += 20;
                    this.player.hp = this.player.maxHp;
                    this.player.atk += 5;
                    this.spawnText("LEVEL UP!", this.player.x, this.player.y - 40, "#00ff00");
                }
            }
        }

        // Particles
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= dt;
            if(p.text) p.y -= 50 * dt;
            if(p.life <= 0) this.particles.splice(i, 1);
        }

        // Update HUD
        document.getElementById("hp-fill").style.width = (this.player.hp / this.player.maxHp * 100) + "%";
        document.getElementById("xp-fill").style.width = (this.player.xp / 100 * 100) + "%";
        document.getElementById("lvl-text").innerText = "LVL " + this.player.level;
    }

    drawTile(x, y, type, size) {
        this.ctx.save();
        this.ctx.translate(x * size, y * size);
        if(type === 1) { this.ctx.fillStyle = "#4CAF50"; this.ctx.fillRect(0,0,size,size); this.ctx.fillStyle = "#388E3C"; this.ctx.fillRect(size*0.2, size*0.2, size*0.1, size*0.3); }
        if(type === 2) { this.ctx.fillStyle = "#795548"; this.ctx.fillRect(0,0,size,size); }
        if(type === 3) { this.ctx.fillStyle = "#2196F3"; this.ctx.fillRect(0,0,size,size); }
        if(type === 4) { 
            this.ctx.fillStyle = "#607D8B"; this.ctx.fillRect(0,0,size,size); 
            if(CONFIG.cameraMode === 'iso') {
                this.ctx.fillStyle = "#37474F";
                this.ctx.fillRect(0, size, size, size*0.5); // fake 3D wall height
            }
        }
        if(type === 5) { this.ctx.fillStyle = "#FFC107"; this.ctx.fillRect(0,0,size,size); }
        this.ctx.restore();
    }

    draw() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Cull map (only draw visible tiles)
        let startX = Math.max(0, Math.floor(this.camera.x / CONFIG.tileSize));
        let startY = Math.max(0, Math.floor(this.camera.y / CONFIG.tileSize));
        let endX = Math.min(CONFIG.mapSize, startX + Math.ceil(this.canvas.width / CONFIG.tileSize) + 1);
        let endY = Math.min(CONFIG.mapSize, startY + Math.ceil(this.canvas.height / CONFIG.tileSize) + 2); // +2 for iso walls

        for(let y=startY; y<endY; y++) {
            for(let x=startX; x<endX; x++) {
                this.drawTile(x, y, CONFIG.mapData[y][x], CONFIG.tileSize);
            }
        }

        // Draw Player Composite Shape (COD Emblem Style)
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        
        // Shadow
        this.ctx.fillStyle = "rgba(0,0,0,0.3)";
        this.ctx.beginPath(); this.ctx.ellipse(0, this.player.radius*0.8, this.player.radius, this.player.radius*0.4, 0, 0, Math.PI*2); this.ctx.fill();
        
        // Body
        this.ctx.fillStyle = CONFIG.player.color;
        this.ctx.beginPath(); this.ctx.arc(0, 0, this.player.radius, 0, Math.PI*2); this.ctx.fill();
        
        // Weapon
        this.ctx.fillStyle = CONFIG.player.weaponColor;
        this.ctx.fillRect(this.player.radius*0.5, -this.player.radius, 8, this.player.radius*2);
        
        // Range Indicator
        if(CONFIG.player.autoAttack) {
            this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
            this.ctx.beginPath(); this.ctx.arc(0, 0, this.player.range, 0, Math.PI*2); this.ctx.stroke();
        }
        this.ctx.restore();

        // Draw Enemies
        this.enemies.forEach(e => {
            this.ctx.save();
            this.ctx.translate(e.x, e.y);
            this.ctx.fillStyle = "rgba(0,0,0,0.3)";
            this.ctx.beginPath(); this.ctx.ellipse(0, e.radius*0.8, e.radius, e.radius*0.4, 0, 0, Math.PI*2); this.ctx.fill();
            
            this.ctx.fillStyle = e.type === 'slime' ? "#2ecc71" : "#e67e22";
            this.ctx.beginPath(); this.ctx.arc(0, 0, e.radius, 0, Math.PI*2); this.ctx.fill();
            
            // HP Bar
            this.ctx.fillStyle = "#f00"; this.ctx.fillRect(-20, -e.radius-15, 40, 5);
            this.ctx.fillStyle = "#0f0"; this.ctx.fillRect(-20, -e.radius-15, 40 * (e.hp/e.maxHp), 5);
            
            this.ctx.restore();
        });

        // Particles
        this.particles.forEach(p => {
            if(p.text) {
                this.ctx.fillStyle = p.color;
                this.ctx.font = "bold 20px Arial";
                this.ctx.fillText(p.text, p.x, p.y);
            } else if (p.type === 'slash') {
                this.ctx.strokeStyle = "#fff";
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 30, 0, Math.PI * (1-p.life));
                this.ctx.stroke();
            }
        });

        this.ctx.restore();
    }

    loop(time) {
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if(dt > 0.1) dt = 0.1; // cap dt

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("game-ui").style.display = "block";
    new RuntimeEngine();
});
`;

    function getHTMLCode(configJson) {
        let c = JSON.parse(configJson);
        let hudClass = c.hud.style === 'mmo' ? 'mmo-style' : 'classic-style';
        
        return `<!DOCTYPE html>
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
        
        #hud { position: fixed; z-index: 10; pointer-events: none; }
        .classic-style { top: 20px; left: 20px; width: 300px; }
        .mmo-style { bottom: 20px; left: 50%; transform: translateX(-50%); width: 400px; text-align: center; }
        
        .bar-wrap { background: rgba(0,0,0,0.7); border: 2px solid #555; height: 25px; margin-bottom: 10px; border-radius: 15px; overflow: hidden; position: relative; }
        .bar-fill { height: 100%; width: 100%; transition: width 0.2s; }
        #hp-fill { background: ${c.hud.hpColor}; }
        #xp-fill { background: ${c.hud.xpColor}; }
        .bar-text { position: absolute; width: 100%; text-align: center; top: 3px; color: white; font-weight: bold; font-size: 14px; text-shadow: 1px 1px 1px #000; }
        
        #joystick-zone { position: fixed; bottom: 30px; left: 30px; width: 150px; height: 150px; z-index: 20; display: ${c.hud.joystick ? 'block' : 'none'}; }
        #joystick-base { width: 100%; height: 100%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: flex; justify-content: center; align-items: center; }
        #joystick-stick { width: 60px; height: 60px; background: rgba(255,255,255,0.5); border-radius: 50%; }
    </style>
</head>
<body>
    <div id="main-menu">
        <h1>${c.title}</h1>
        <button id="start-btn">PLAY GAME</button>
    </div>
    
    <div id="game-ui">
        <canvas id="game-canvas"></canvas>
        <div id="hud" class="${hudClass}">
            <div id="lvl-text" style="color:white; font-size: 20px; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px #000;">LVL 1</div>
            <div class="bar-wrap"><div id="hp-fill" class="bar-fill"></div><div class="bar-text">HEALTH</div></div>
            <div class="bar-wrap"><div id="xp-fill" class="bar-fill" style="width: 0%;"></div><div class="bar-text">XP</div></div>
        </div>
        
        <div id="joystick-zone">
            <div id="joystick-base"><div id="joystick-stick"></div></div>
        </div>
    </div>
    
    <script src="engine.js"><\/script>
</body>
</html>`;
    }

    // --- PLAYTEST FEATURE ---
    document.getElementById("btn-playtest").addEventListener("click", () => {
        let configStr = JSON.stringify(generateGameConfig());
        let htmlStr = getHTMLCode(configStr);
        let jsStr = getEngineCode(configStr);
        
        // Inject JS directly into HTML for single-file iframe execution
        let finalHtml = htmlStr.replace('<script src="engine.js"><\/script>', `<script>${jsStr}<\/script>`);
        
        const blob = new Blob([finalHtml], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        
        document.getElementById("playtest-frame").src = url;
        document.getElementById("playtest-modal").style.display = "flex";
    });

    document.getElementById("close-playtest").addEventListener("click", () => {
        document.getElementById("playtest-modal").style.display = "none";
        document.getElementById("playtest-frame").src = "";
    });

    // --- EXPORT FEATURE ---
    document.getElementById("btn-export").addEventListener("click", () => {
        const zip = new JSZip();
        let configStr = JSON.stringify(generateGameConfig());
        
        zip.file("index.html", getHTMLCode(configStr));
        zip.file("engine.js", getEngineCode(configStr));
        
        zip.generateAsync({ type: "blob" }).then(function(content) {
            saveAs(content, "MyRPG_Export.zip");
        });
    });
});

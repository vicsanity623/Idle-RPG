document.addEventListener("DOMContentLoaded", () => {
    // --- STATE MANAGEMENT ---
    const config = {
        title: "My Epic RPG",
        viewMode: "topdown",
        camFollow: true,
        menuBg: "#222222",
        menuBtn: "#4CAF50",
        menuText: "#ffffff",
        hudHp: "#ff3333",
        hudXp: "#33ccff",
        hudAction: true,
        mapSize: 20,
        playerSpeed: 4,
        playerColor: "#ffeb3b",
        controls: "joystick",
        autoAttack: true,
        mapData: []
    };

    // --- UI LOGIC ---
    const tabs = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.tab).classList.add("active");
        });
    });

    // --- MAP EDITOR LOGIC ---
    const canvas = document.getElementById("map-canvas");
    const ctx = canvas.getContext("2d");
    let currentBrush = 1; // 1:Grass, 2:Dirt, 3:Water, 4:Wall
    const tileSize = 30;

    function initMap() {
        config.mapData = Array(config.mapSize).fill(0).map(() => Array(config.mapSize).fill(1));
        drawMap();
    }

    function drawMap() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const colors = {1: "#4CAF50", 2: "#795548", 3: "#2196F3", 4: "#607D8B"};
        for(let y=0; y<config.mapSize; y++) {
            for(let x=0; x<config.mapSize; x++) {
                ctx.fillStyle = colors[config.mapData[y][x]];
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                ctx.strokeStyle = "rgba(0,0,0,0.1)";
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }

    document.querySelectorAll(".brush").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".brush").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentBrush = parseInt(e.target.dataset.type);
        });
    });

    let isDrawing = false;
    canvas.addEventListener("mousedown", () => isDrawing = true);
    canvas.addEventListener("mouseup", () => isDrawing = false);
    canvas.addEventListener("mouseleave", () => isDrawing = false);
    canvas.addEventListener("mousemove", (e) => {
        if(!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / tileSize);
        const y = Math.floor((e.clientY - rect.top) / tileSize);
        if(x >= 0 && x < config.mapSize && y >= 0 && y < config.mapSize) {
            config.mapData[y][x] = currentBrush;
            drawMap();
        }
    });

    document.getElementById("btn-generate-map").addEventListener("click", () => {
        // Procedural Generation (Cellular Automata basic implementation)
        for(let y=0; y<config.mapSize; y++) {
            for(let x=0; x<config.mapSize; x++) {
                let rand = Math.random();
                if(rand < 0.6) config.mapData[y][x] = 1; // Grass
                else if(rand < 0.8) config.mapData[y][x] = 2; // Dirt
                else if(rand < 0.95) config.mapData[y][x] = 3; // Water
                else config.mapData[y][x] = 4; // Wall
            }
        }
        drawMap();
    });

    document.getElementById("map-size").addEventListener("change", (e) => {
        config.mapSize = parseInt(e.target.value);
        canvas.width = config.mapSize * tileSize;
        canvas.height = config.mapSize * tileSize;
        initMap();
    });

    initMap();

    // --- GAME EXPORT COMPILER ---
    document.getElementById("btn-export").addEventListener("click", () => {
        // Update config from UI inputs
        config.title = document.getElementById("game-title").value;
        config.viewMode = document.getElementById("game-view").value;
        config.camFollow = document.getElementById("cam-follow").checked;
        config.menuBg = document.getElementById("menu-bg").value;
        config.menuBtn = document.getElementById("menu-btn").value;
        config.menuText = document.getElementById("menu-text").value;
        config.hudHp = document.getElementById("hud-hp").value;
        config.hudXp = document.getElementById("hud-xp").value;
        config.hudAction = document.getElementById("hud-action").checked;
        config.playerSpeed = parseFloat(document.getElementById("player-speed").value);
        config.playerColor = document.getElementById("player-color").value;
        config.controls = document.getElementById("player-controls").value;
        config.autoAttack = document.getElementById("auto-attack").checked;

        const zip = new JSZip();

        // 1. Generate HTML
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${config.title}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="main-menu" style="background-color: ${config.menuBg};">
        <h1 style="color: ${config.menuText};">${config.title}</h1>
        <button id="start-btn" style="background-color: ${config.menuBtn}; color: ${config.menuText};">Start Game</button>
    </div>
    
    <div id="game-container" style="display: none;">
        <canvas id="game-canvas"></canvas>
        <div id="hud">
            <div class="bar-container"><div id="hp-bar" style="background-color: ${config.hudHp}; width: 100%;"></div></div>
            <div class="bar-container"><div id="xp-bar" style="background-color: ${config.hudXp}; width: 10%;"></div></div>
        </div>
        ${config.controls === 'joystick' ? `
        <div id="joystick-zone">
            <div id="joystick-base"><div id="joystick-stick"></div></div>
        </div>` : ''}
        ${config.hudAction ? '<button id="action-btn">Action</button>' : ''}
    </div>
    
    <script>const GAME_CONFIG = ${JSON.stringify(config)};</script>
    <script src="engine.js"></script>
</body>
</html>`;

        // 2. Generate CSS
        const cssContent = `
* { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
body, html { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: sans-serif; }
#main-menu { position: absolute; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; }
#main-menu h1 { font-size: 4rem; margin-bottom: 2rem; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
#start-btn { padding: 15px 40px; font-size: 1.5rem; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: transform 0.1s; }
#start-btn:active { transform: scale(0.95); }
#game-container { position: relative; width: 100%; height: 100%; }
canvas { display: block; width: 100%; height: 100%; }
#hud { position: absolute; top: 20px; left: 20px; width: 250px; z-index: 10; }
.bar-container { width: 100%; height: 20px; background: rgba(0,0,0,0.5); border: 2px solid #fff; border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
.bar-container div { height: 100%; transition: width 0.2s; }
#action-btn { position: absolute; bottom: 40px; right: 40px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid #fff; color: #fff; font-weight: bold; z-index: 10; cursor: pointer; }
#joystick-zone { position: absolute; bottom: 20px; left: 20px; width: 150px; height: 150px; z-index: 10; }
#joystick-base { position: absolute; bottom: 0; left: 0; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); display: flex; justify-content: center; align-items: center; }
#joystick-stick { width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.5); position: absolute; }
`;

        // 3. Generate Runtime Engine (The Game logic)
        const jsContent = `
class GameEngine {
    constructor(config) {
        this.config = config;
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d");
        this.tileSize = 64; // Scaled up for gameplay
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.joystick = { x: 0, y: 0, active: false };
        
        this.player = {
            x: this.tileSize * 2,
            y: this.tileSize * 2,
            width: this.tileSize * 0.6,
            height: this.tileSize * 0.8,
            speed: this.config.playerSpeed,
            color: this.config.playerColor
        };

        this.initEvents();
        this.resize();
        window.addEventListener("resize", () => this.resize());
        
        // Start loop
        requestAnimationFrame(() => this.loop());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initEvents() {
        window.addEventListener("keydown", (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener("keyup", (e) => this.keys[e.key.toLowerCase()] = false);

        if(this.config.controls === 'joystick') {
            const stick = document.getElementById("joystick-stick");
            const base = document.getElementById("joystick-base");
            let baseRect;

            const moveStick = (e) => {
                if(!this.joystick.active) return;
                e.preventDefault();
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                let dx = clientX - (baseRect.left + baseRect.width/2);
                let dy = clientY - (baseRect.top + baseRect.height/2);
                let dist = Math.sqrt(dx*dx + dy*dy);
                let maxDist = baseRect.width/2 - 25;
                
                if(dist > maxDist) {
                    dx = (dx/dist) * maxDist;
                    dy = (dy/dist) * maxDist;
                }
                
                stick.style.transform = \`translate(\${dx}px, \${dy}px)\`;
                this.joystick.x = dx / maxDist;
                this.joystick.y = dy / maxDist;
            };

            const startStick = (e) => {
                this.joystick.active = true;
                baseRect = base.getBoundingClientRect();
                moveStick(e);
            };

            const endStick = () => {
                this.joystick.active = false;
                this.joystick.x = 0; this.joystick.y = 0;
                stick.style.transform = \`translate(0px, 0px)\`;
            };

            base.addEventListener("touchstart", startStick, {passive: false});
            window.addEventListener("touchmove", moveStick, {passive: false});
            window.addEventListener("touchend", endStick);
        }
    }

    update() {
        let dx = 0, dy = 0;

        // Input
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        if (this.config.controls === 'joystick') {
            dx = this.joystick.x;
            dy = this.joystick.y;
        }

        // Normalize
        let length = Math.sqrt(dx*dx + dy*dy);
        if(length > 0) { dx /= length; dy /= length; }

        // Proposed new position
        let newX = this.player.x + dx * this.player.speed;
        let newY = this.player.y + dy * this.player.speed;

        // Basic Tile Collision (3=Water, 4=Wall are solid)
        let tileX = Math.floor(newX / this.tileSize);
        let tileY = Math.floor(newY / this.tileSize);
        
        if(tileX >= 0 && tileX < this.config.mapSize && tileY >= 0 && tileY < this.config.mapSize) {
            let tileType = this.config.mapData[tileY][tileX];
            if(tileType !== 3 && tileType !== 4) {
                this.player.x = newX;
                this.player.y = newY;
            }
        }

        // Camera Logic
        if (this.config.camFollow) {
            this.camera.x = this.player.x - this.canvas.width / 2 + this.player.width / 2;
            this.camera.y = this.player.y - this.canvas.height / 2 + this.player.height / 2;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw Map
        const colors = {1: "#4CAF50", 2: "#795548", 3: "#2196F3", 4: "#607D8B"};
        for(let y=0; y<this.config.mapSize; y++) {
            for(let x=0; x<this.config.mapSize; x++) {
                this.ctx.fillStyle = colors[this.config.mapData[y][x]];
                this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize + 1, this.tileSize + 1);
                
                // 2.5D Layered illusion if selected
                if(this.config.viewMode === 'sideview' && this.config.mapData[y][x] === 4) {
                    this.ctx.fillStyle = "rgba(0,0,0,0.3)";
                    this.ctx.fillRect(x * this.tileSize, y * this.tileSize + this.tileSize, this.tileSize, 10);
                }
            }
        }

        // Draw Player (Using shapes/colors as requested)
        this.ctx.fillStyle = this.player.color;
        
        // Z-index simulated rendering
        if (this.config.viewMode === 'sideview') {
            // Shadow
            this.ctx.fillStyle = "rgba(0,0,0,0.4)";
            this.ctx.beginPath();
            this.ctx.ellipse(this.player.x, this.player.y + this.player.height, this.player.width/2, this.player.height/4, 0, 0, Math.PI*2);
            this.ctx.fill();
            // Body
            this.ctx.fillStyle = this.player.color;
            this.ctx.fillRect(this.player.x - this.player.width/2, this.player.y - this.player.height/2, this.player.width, this.player.height);
            // Details
            this.ctx.fillStyle = "#fff"; // Eyes
            this.ctx.fillRect(this.player.x - 10, this.player.y - 10, 5, 5);
            this.ctx.fillRect(this.player.x + 5, this.player.y - 10, 5, 5);
        } else {
            // Top Down rendering
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, this.player.y, this.player.width/2, 0, Math.PI*2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Bootstrapper
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("game-container").style.display = "block";
    new GameEngine(GAME_CONFIG);
});
`;

        // Package and Download ZIP
        zip.file("index.html", htmlContent);
        zip.file("style.css", cssContent);
        zip.file("engine.js", jsContent);
        
        zip.generateAsync({ type: "blob" }).then(function(content) {
            saveAs(content, "MyCustomRPG.zip");
        });
    });
});

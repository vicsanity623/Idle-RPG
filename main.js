/**
 * Endless Dungeons of Fate - Engine
 * SOTA Implementation - Vanilla JS Canvas
 */

// --- CONFIG & GLOBALS ---
const TILE_SIZE = 64;
const MAP_SIZE = 40; // 40x40 tiles
const GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'];

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Utility: RNG
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// --- GAME STATE ---
const GameState = {
    state: 'BOOT', // BOOT, MENU, PLAYING, DEAD
    level: 1,
    camera: { x: 0, y: 0 },
    lastTime: 0,
    deltaTime: 0,
    frame: 0
};

// Persistent Data
let PlayerData = {
    gold: 0,
    shards: 0,
    level: 1,
    xp: 0,
    maxXp: 100,
    gear: {}
};

// Initialize Gear
GEAR_TYPES.forEach(type => {
    PlayerData.gear[type] = { level: 1, stat: 5 }; // Base stat
});

// Entities
let mapGrid = [];
let exploredGrid = [];
let entities = [];
let particles = [];
let floatingTexts = [];
let portal = null;

// --- MAP GENERATION (Cellular Automata / Drunkard's Walk) ---
function generateMap() {
    mapGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(1)); // 1 = wall, 0 = floor
    exploredGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(false));
    
    let x = Math.floor(MAP_SIZE / 2);
    let y = Math.floor(MAP_SIZE / 2);
    let floorCount = 0;
    const maxFloors = (MAP_SIZE * MAP_SIZE) * 0.4;
    
    // Start area
    for(let i=-2; i<=2; i++) {
        for(let j=-2; j<=2; j++) {
            mapGrid[y+i][x+j] = 0;
        }
    }

    // Drunkard's walk
    while (floorCount < maxFloors) {
        const dir = randomInt(0, 3);
        if (dir === 0 && y > 2) y--;
        else if (dir === 1 && y < MAP_SIZE - 3) y++;
        else if (dir === 2 && x > 2) x--;
        else if (dir === 3 && x < MAP_SIZE - 3) x++;

        if (mapGrid[y][x] === 1) {
            mapGrid[y][x] = 0;
            // Carve thicker paths
            if(Math.random() > 0.5) mapGrid[y+1][x] = 0;
            if(Math.random() > 0.5) mapGrid[y][x+1] = 0;
            floorCount++;
        }
    }

    // Place portal at the last walker position
    portal = { x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, radius: 30 };
}

// Map Collision Helper
function isWall(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= MAP_SIZE || col < 0 || col >= MAP_SIZE) return true;
    return mapGrid[row][col] === 1;
}

// --- CLASSES ---

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.vx = 0;
        this.vy = 0;
        this.speed = 250; // pixels per sec
        this.color = '#bb86fc';
        
        this.hp = this.getMaxHp();
        this.attackCooldown = 0;
        this.potionCooldown = 0;
        this.auraCooldown = 0;

        // Auto Attack skills
        this.skills = [
            { id: 'pot', cdMax: 10, current: 0 },
            { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 } // Dash adds evasion/speed buff
        ];
    }

    getMaxHp() { return 100 + (PlayerData.level * 20) + (PlayerData.gear.Armor.stat * 5); }
    getDamage() { return 10 + (PlayerData.level * 2) + PlayerData.gear.Weapon.stat; }

    update(dt) {
        // Apply Joystick Input
        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        // Move with collision
        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;
        
        // Slide on walls
        if (!isWall(nextX, this.y)) this.x = nextX;
        if (!isWall(this.x, nextY)) this.y = nextY;

        // Auto Attack Logic
        this.handleSkills(dt);

        // Update Fog of War
        const col = Math.floor(this.x / TILE_SIZE);
        const row = Math.floor(this.y / TILE_SIZE);
        const vision = 4;
        for(let r = row-vision; r <= row+vision; r++) {
            for(let c = col-vision; c <= col+vision; c++) {
                if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
            }
        }

        // Check Portal
        if (Math.hypot(this.x - portal.x, this.y - portal.y) < this.radius + portal.radius) {
            levelUpDungeon();
        }

        UI.updateStats();
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });

        // 1. Basic Auto Attack (nearest enemy)
        if (this.skills[1].current <= 0) {
            let target = this.getNearestEnemy(150);
            if (target) {
                target.takeDamage(this.getDamage());
                spawnProjectile(this.x, this.y, target.x, target.y);
                this.skills[1].current = this.skills[1].cdMax;
            }
        }

        // 2. Aura Attack (AoE)
        if (this.skills[2].current <= 0) {
            let hits = 0;
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 120) {
                    e.takeDamage(this.getDamage() * 0.5);
                    hits++;
                }
            });
            if(hits > 0) {
                spawnAura(this.x, this.y);
                this.skills[2].current = this.skills[2].cdMax;
            }
        }

        // 3. Auto Potion
        if (this.hp < this.getMaxHp() * 0.5 && this.skills[0].current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * 0.3);
            spawnFloatingText(this.x, this.y, "+Heal", '#0f0');
            this.skills[0].current = this.skills[0].cdMax;
        }

        UI.updateHotbar(this.skills);
    }

    getNearestEnemy(range) {
        let nearest = null;
        let minDist = range;
        entities.forEach(e => {
            if (e instanceof Enemy) {
                const dist = Math.hypot(this.x - e.x, this.y - e.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = e;
                }
            }
        });
        return nearest;
    }

    takeDamage(amt) {
        // Mitigate with armor/legs
        let def = PlayerData.gear.Legs.stat + PlayerData.gear.Head.stat;
        let actualDamage = Math.max(1, amt - def * 0.2);
        this.hp -= actualDamage;
        spawnFloatingText(this.x, this.y - 20, `-${Math.floor(actualDamage)}`, '#f00');
        if (this.hp <= 0) die();
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Hive Mind AI: Adapts dynamically
const HiveMind = {
    flankWeight: 0,
    packSize: 0,
    update: function() {
        this.packSize = entities.filter(e => e instanceof Enemy).length;
        // If too many enemies, spread them out to flank
        this.flankWeight = Math.min(1.0, this.packSize / 20); 
    }
};

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.speed = randomFloat(80, 130) * Math.pow(1.02, GameState.level); // gets faster
        
        const hpMultiplier = Math.pow(1.1, GameState.level);
        this.hp = 30 * hpMultiplier;
        this.maxHp = this.hp;
        this.damage = 5 * hpMultiplier;
        
        this.id = Math.random(); // Unique ID for flank offsetting
        this.attackCooldown = 0;
    }

    update(dt) {
        if (!player) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < player.radius + this.radius + 5) {
            // Attack
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                player.takeDamage(this.damage);
                this.attackCooldown = 1.0;
            }
        } else if (dist < 600) {
            // Pathfind / HiveMind Flank
            // Add perpendicular vector based on HiveMind flankWeight and enemy ID
            const angleToPlayer = Math.atan2(dy, dx);
            const flankOffset = (this.id > 0.5 ? 1 : -1) * (Math.PI / 2) * HiveMind.flankWeight;
            
            const targetAngle = angleToPlayer + flankOffset;
            
            let vx = Math.cos(targetAngle) * this.speed;
            let vy = Math.sin(targetAngle) * this.speed;

            // Move & Collide
            const nextX = this.x + vx * dt;
            const nextY = this.y + vy * dt;

            if (!isWall(nextX, this.y)) this.x = nextX;
            if (!isWall(this.x, nextY)) this.y = nextY;
        }
    }

    takeDamage(amt) {
        this.hp -= amt;
        spawnFloatingText(this.x, this.y, Math.floor(amt), '#fff');
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        entities.splice(entities.indexOf(this), 1);
        gainXp(10 * GameState.level);
        
        // Loot drops
        if (Math.random() < 0.6) spawnLoot(this.x, this.y, 'gold');
        if (Math.random() < 0.2) spawnLoot(this.x, this.y, 'shard');
        if (Math.random() < 0.05) spawnLoot(this.x, this.y, 'gear'); // 5% chance for gear drop
    }

    draw(ctx) {
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // HP Bar
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp/this.maxHp), 4);
    }
}

class Loot {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 8;
        this.life = 15; // disappears after 15s
        this.floatY = 0;
        this.time = Math.random() * 10;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) entities.splice(entities.indexOf(this), 1);

        this.time += dt * 5;
        this.floatY = Math.sin(this.time) * 5;

        // Pickup
        if (player && Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius + 10) {
            this.pickup();
            entities.splice(entities.indexOf(this), 1);
        }
    }

    pickup() {
        if (this.type === 'gold') {
            const amt = randomInt(5, 15) * GameState.level;
            PlayerData.gold += amt;
            spawnFloatingText(this.x, this.y, `+${amt} Gold`, '#ffd700');
        } else if (this.type === 'shard') {
            PlayerData.shards += 1;
            spawnFloatingText(this.x, this.y, `+1 Shard`, '#00e5ff');
        } else if (this.type === 'gear') {
            // Gear doesn't go straight to inv in simple version, we grant raw shards or auto-upgrade
            // For full SOTA implementation: grant random shards and occasionally level up a random gear instantly if inventory isn't full
            const slot = GEAR_TYPES[randomInt(0, GEAR_TYPES.length - 1)];
            PlayerData.shards += 5; // Gear melts into shards automatically for endless idle ease
            spawnFloatingText(this.x, this.y, `+5 Shards (Melted ${slot})`, '#bb86fc');
        }
        UI.updateCurrencies();
        saveGame();
    }

    draw(ctx) {
        ctx.fillStyle = this.type === 'gold' ? '#ffd700' : this.type === 'shard' ? '#00e5ff' : '#bb86fc';
        ctx.beginPath();
        if(this.type === 'shard') {
            ctx.moveTo(this.x, this.y - 10 + this.floatY);
            ctx.lineTo(this.x + 8, this.y + this.floatY);
            ctx.lineTo(this.x, this.y + 10 + this.floatY);
            ctx.lineTo(this.x - 8, this.y + this.floatY);
        } else {
            ctx.arc(this.x, this.y + this.floatY, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -30;
    }
    update(dt) {
        this.life -= dt;
        this.y += this.vy * dt;
        if(this.life <= 0) floatingTexts.splice(floatingTexts.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.5;
        this.size = randomFloat(2, 5);
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if(this.life <= 0) particles.splice(particles.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life * 2);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- ENGINE FUNCTIONS ---

let player = null;

function spawnFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(x, y, text, color));
}

function spawnLoot(x, y, type) {
    entities.push(new Loot(x, y, type));
}

function spawnProjectile(x1, y1, x2, y2) {
    // Simple visual line via particles
    for(let i=0; i<5; i++) {
        particles.push(new Particle(x2, y2, '#fff'));
    }
}

function spawnAura(x, y) {
    for(let i=0; i<20; i++) particles.push(new Particle(x, y, '#ff9800'));
}

function gainXp(amt) {
    PlayerData.xp += amt;
    if (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        PlayerData.level++;
        PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.5);
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
    }
    UI.updateStats();
    saveGame();
}

function die() {
    GameState.state = 'DEAD';
    // Lose half loot
    PlayerData.gold = Math.floor(PlayerData.gold / 2);
    PlayerData.shards = Math.floor(PlayerData.shards / 2);
    UI.notify("YOU DIED. Lost 50% Wealth.");
    saveGame();
    
    setTimeout(() => {
        GameState.level = 1;
        initLevel();
        GameState.state = 'PLAYING';
    }, 2000);
}

function levelUpDungeon() {
    GameState.level++;
    UI.notify(`Entering Depth ${GameState.level}`);
    initLevel();
}

function spawnEnemies() {
    const numEnemies = 5 + Math.floor(GameState.level * 1.5);
    for(let i=0; i<numEnemies; i++) {
        let ex, ey;
        do {
            ex = randomInt(2, MAP_SIZE-3) * TILE_SIZE;
            ey = randomInt(2, MAP_SIZE-3) * TILE_SIZE;
        } while (isWall(ex, ey) || Math.hypot(ex - player.x, ey - player.y) < 300);
        entities.push(new Enemy(ex, ey));
    }
}

function initLevel() {
    generateMap();
    entities = [];
    particles = [];
    floatingTexts = [];
    
    const startX = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    const startY = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    
    if(!player) player = new Player(startX, startY);
    else { player.x = startX; player.y = startY; }
    
    entities.push(player);
    spawnEnemies();
    
    document.getElementById('d-level').innerText = GameState.level;
    UI.updateMinimap();
}

// --- INPUT (Virtual Joystick) ---
const Input = {
    joystick: { active: false, angle: 0, x:0, y:0 }
};

const jZone = document.getElementById('joystick-zone');
const jBase = document.getElementById('j-base');
const jStick = document.getElementById('j-stick');

jZone.addEventListener('touchstart', (e) => {
    if(GameState.state !== 'PLAYING') return;
    const touch = e.changedTouches[0];
    Input.joystick.active = true;
    Input.joystick.x = touch.clientX;
    Input.joystick.y = touch.clientY;
    
    jBase.style.display = 'block';
    jBase.style.left = touch.clientX + 'px';
    jBase.style.top = touch.clientY + 'px';
    jStick.style.transform = `translate(-50%, -50%)`;
});

jZone.addEventListener('touchmove', (e) => {
    if(!Input.joystick.active) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - Input.joystick.x;
    const dy = touch.clientY - Input.joystick.y;
    Input.joystick.angle = Math.atan2(dy, dx);
    
    const dist = Math.min(50, Math.hypot(dx, dy));
    const sx = Math.cos(Input.joystick.angle) * dist;
    const sy = Math.sin(Input.joystick.angle) * dist;
    
    jStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
});

const endJoystick = () => {
    Input.joystick.active = false;
    jBase.style.display = 'none';
};
jZone.addEventListener('touchend', endJoystick);
jZone.addEventListener('touchcancel', endJoystick);


// --- UI MANAGER ---
const UI = {
    updateStats: () => {
        document.getElementById('p-level').innerText = PlayerData.level;
        document.getElementById('hp-fill').style.width = `${Math.max(0, (player.hp / player.getMaxHp()) * 100)}%`;
        document.getElementById('hp-text').innerText = `${Math.floor(player.hp)} / ${Math.floor(player.getMaxHp())}`;
        document.getElementById('xp-fill').style.width = `${(PlayerData.xp / PlayerData.maxXp) * 100}%`;
        document.getElementById('xp-text').innerText = `${Math.floor(PlayerData.xp)} / ${PlayerData.maxXp}`;
    },
    updateCurrencies: () => {
        document.getElementById('c-gold').innerText = PlayerData.gold;
        document.getElementById('c-shard').innerText = PlayerData.shards;
    },
    updateHotbar: (skills) => {
        skills.forEach((s, i) => {
            const overlay = document.getElementById(`cd-${i}`);
            const pct = (s.current / s.cdMax) * 100;
            overlay.style.height = `${pct}%`;
        });
    },
    updateMinimap: () => {
        const mmCanvas = document.getElementById('minimap');
        const mmCtx = mmCanvas.getContext('2d');
        mmCtx.clearRect(0,0,100,100);
        const cellW = 100 / MAP_SIZE;
        
        for(let r=0; r<MAP_SIZE; r++){
            for(let c=0; c<MAP_SIZE; c++){
                if(exploredGrid[r][c]) {
                    mmCtx.fillStyle = mapGrid[r][c] === 1 ? '#333' : '#777';
                    mmCtx.fillRect(c*cellW, r*cellW, cellW, cellW);
                }
            }
        }
        // Draw Player
        mmCtx.fillStyle = '#bb86fc';
        mmCtx.fillRect((player.x/TILE_SIZE)*cellW, (player.y/TILE_SIZE)*cellW, cellW, cellW);
        // Draw Portal if explored
        if(exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) {
            mmCtx.fillStyle = '#00e5ff';
            mmCtx.fillRect((portal.x/TILE_SIZE)*cellW, (portal.y/TILE_SIZE)*cellW, cellW, cellW);
        }
    },
    toggleInventory: () => {
        const modal = document.getElementById('inventory-modal');
        if(modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            UI.renderInventory();
        }
    },
    renderInventory: () => {
        const grid = document.getElementById('gear-grid');
        grid.innerHTML = '';
        GEAR_TYPES.forEach(type => {
            const gear = PlayerData.gear[type];
            const cost = gear.level * 10;
            const div = document.createElement('div');
            div.className = 'gear-item';
            div.innerHTML = `
                <h4>${type}</h4>
                <p>Lv: ${gear.level}</p>
                <p>Stat: +${gear.stat}</p>
                <button class="upgrade-btn" ${PlayerData.shards < cost ? 'disabled' : ''} onclick="UI.upgradeGear('${type}')">
                    Up: ${cost} 💎
                </button>
            `;
            grid.appendChild(div);
        });
        UI.updateCurrencies();
    },
    upgradeGear: (type) => {
        const gear = PlayerData.gear[type];
        const cost = gear.level * 10;
        if(PlayerData.shards >= cost) {
            PlayerData.shards -= cost;
            gear.level++;
            // RNG stat boost
            gear.stat += randomInt(2, 6);
            UI.renderInventory();
            saveGame();
            UI.notify(`${type} Upgraded!`);
        }
    },
    notify: (msg) => {
        const el = document.getElementById('notification');
        el.innerText = msg;
        el.style.opacity = 1;
        setTimeout(() => el.style.opacity = 0, 2000);
    },
    checkDailyLogin: () => {
        const lastLogin = localStorage.getItem('dof_lastLogin');
        const today = new Date().toDateString();
        if(lastLogin !== today) {
            document.getElementById('daily-login').style.display = 'block';
        }
    },
    claimDaily: () => {
        PlayerData.gold += 500;
        PlayerData.shards += 50;
        localStorage.setItem('dof_lastLogin', new Date().toDateString());
        document.getElementById('daily-login').style.display = 'none';
        UI.updateCurrencies();
        saveGame();
    }
};

// --- SAVE / LOAD ---
function saveGame() {
    localStorage.setItem('dof_save', JSON.stringify(PlayerData));
}

function loadGame() {
    const save = localStorage.getItem('dof_save');
    if(save) {
        const data = JSON.parse(save);
        PlayerData = { ...PlayerData, ...data };
    }
}

// --- RENDERING ---
function drawMap(camX, camY) {
    const startCol = Math.floor(camX / TILE_SIZE);
    const endCol = startCol + (canvas.width / TILE_SIZE) + 1;
    const startRow = Math.floor(camY / TILE_SIZE);
    const endRow = startRow + (canvas.height / TILE_SIZE) + 1;

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (r >= 0 && r < MAP_SIZE && c >= 0 && c < MAP_SIZE) {
                const isExplored = exploredGrid[r][c];
                if (!isExplored) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
                    continue;
                }

                if (mapGrid[r][c] === 1) {
                    // Wall
                    ctx.fillStyle = '#1e1e1e';
                    ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
                } else {
                    // Floor
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
                    // Floor pattern
                    ctx.fillStyle = '#252525';
                    ctx.fillRect(c * TILE_SIZE - camX + 10, r * TILE_SIZE - camY + 10, TILE_SIZE - 20, TILE_SIZE - 20);
                }
            }
        }
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (GameState.state !== 'PLAYING' && GameState.state !== 'DEAD') return;

    // Camera logic
    let camX = player.x - canvas.width / 2;
    let camY = player.y - canvas.height / 2;
    
    // Clamp camera
    camX = Math.max(0, Math.min(camX, MAP_SIZE * TILE_SIZE - canvas.width));
    camY = Math.max(0, Math.min(camY, MAP_SIZE * TILE_SIZE - canvas.height));

    ctx.save();
    
    drawMap(camX, camY);

    ctx.translate(-camX, -camY);

    // Portal
    if(portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00e5ff';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Entities (sort by Y for pseudo-3D overlap)
    entities.sort((a,b) => a.y - b.y).forEach(e => {
        if(e.draw) e.draw(ctx);
    });

    particles.forEach(p => p.draw(ctx));
    floatingTexts.forEach(ft => ft.draw(ctx));

    // Dead overlay
    if (GameState.state === 'DEAD') {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(camX, camY, canvas.width, canvas.height);
    }

    ctx.restore();
}

// --- MAIN LOOP ---
function loop(timestamp) {
    if (!GameState.lastTime) GameState.lastTime = timestamp;
    const dt = (timestamp - GameState.lastTime) / 1000; // seconds
    GameState.lastTime = timestamp;

    if (GameState.state === 'PLAYING') {
        HiveMind.update();
        
        entities.forEach(e => {
            if(e.update) e.update(dt);
        });

        particles.forEach(p => p.update(dt));
        floatingTexts.forEach(ft => ft.update(dt));

        // Periodically spawn enemies if count is low
        if (Math.random() < 0.01 && entities.filter(e => e instanceof Enemy).length < 10) {
            spawnEnemies(); // spawns a batch
        }

        // Periodically update minimap (don't do every frame for performance)
        if(GameState.frame % 30 === 0) UI.updateMinimap();
    }

    draw();
    GameState.frame++;
    requestAnimationFrame(loop);
}

// --- BOOT SEQUENCE ---
window.onload = () => {
    loadGame();
    
    const fill = document.getElementById('loading-fill');
    let pct = 0;
    const bootInterval = setInterval(() => {
        pct += Math.random() * 20;
        if(pct >= 100) {
            pct = 100;
            clearInterval(bootInterval);
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('main-menu').classList.remove('hidden');
                GameState.state = 'MENU';
            }, 500);
        }
        fill.style.width = pct + '%';
    }, 100);
};

document.getElementById('play-btn').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    UI.updateCurrencies();
    UI.checkDailyLogin();
    initLevel();
    GameState.state = 'PLAYING';
    GameState.lastTime = performance.now();
    requestAnimationFrame(loop);
});
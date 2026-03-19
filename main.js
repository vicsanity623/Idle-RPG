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
    gear: {
        'Weapon':   { level: 1, atk: 10, critMult: 0.05 },
        'Armor':    { level: 1, hp: 50, def: 5 },
        'Legs':     { level: 1, def: 8, hp: 20 },
        'Fists':    { level: 1, critChance: 2, atk: 5 },
        'Head':     { level: 1, hp: 30, def: 5 },
        'Robe':     { level: 1, regen: 0.5, hp: 20 },
        'Ring':     { level: 1, atk: 8, critChance: 1.5 },
        'Earrings': { level: 1, critMult: 0.1, regen: 0.2 },
        'Necklace': { level: 1, regen: 1.0, hp: 10 },
        'Boots':    { level: 1, def: 5, atkSpeed: 0.02 } // atkSpeed is a CD reduction factor
    }
};

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
        this.speed = 250; 
        this.color = '#bb86fc';
        
        this.hp = this.getMaxHp();
        this.skills = [
            { id: 'pot', cdMax: 10, current: 0 },
            { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 }
        ];
    }

    // --- DERIVED STATS CALCULATION ---
    // --- SAFE DERIVED STATS CALCULATION ---
    getMaxHp() { 
        const g = PlayerData.gear;
        return Math.floor(100 + (PlayerData.level * 20) + 
            (g.Armor.hp || 0) + (g.Head.hp || 0) + 
            (g.Legs.hp || 0) + (g.Robe.hp || 0) + 
            (g.Necklace.hp || 0)); 
    }

    getAttackPower() { 
        const g = PlayerData.gear;
        return Math.floor(10 + (PlayerData.level * 2) + 
            (g.Weapon.atk || 0) + (g.Fists.atk || 0) + 
            (g.Ring.atk || 0)); 
    }

    getDefense() { 
        const g = PlayerData.gear;
        return Math.floor((g.Armor.def || 0) + (g.Head.def || 0) + 
            (g.Legs.def || 0) + (g.Boots.def || 0)); 
    }

    getRegen() { 
        const g = PlayerData.gear;
        return (g.Robe.regen || 0) + (g.Necklace.regen || 0) + 
            (g.Earrings.regen || 0); 
    }

    getCritChance() { 
        const g = PlayerData.gear;
        let base = 5 + (g.Fists.critChance || 0) + (g.Ring.critChance || 0);
        return Math.min(75, base); 
    }

    getCritMultiplier() { 
        const g = PlayerData.gear;
        return 1.5 + (g.Weapon.critMult || 0) + (g.Earrings.critMult || 0); 
    }

    getAttackSpeedFactor() {
        const g = PlayerData.gear;
        return Math.max(0.3, 1.0 - (g.Boots.atkSpeed || 0));
    }

    // --- LOGIC ---

    update(dt) {
        // Handle Regen
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        // Standard Movement
        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
        } else {
            this.vx = 0; this.vy = 0;
        }

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;
        if (!isWall(nextX, this.y)) this.x = nextX;
        if (!isWall(this.x, nextY)) this.y = nextY;

        this.handleSkills(dt);
        this.updateFog();

        if (Math.hypot(this.x - portal.x, this.y - portal.y) < this.radius + portal.radius) {
            levelUpDungeon();
        }
        UI.updateStats();
    }

    updateFog() {
        const col = Math.floor(this.x / TILE_SIZE);
        const row = Math.floor(this.y / TILE_SIZE);
        for(let r = row-4; r <= row+4; r++) {
            for(let c = col-4; c <= col+4; c++) {
                if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
            }
        }
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });

        // Basic Attack with CRIT Logic
        if (this.skills[1].current <= 0) {
            let target = this.getNearestEnemy(200);
            if (target) {
                let damage = this.getAttackPower();
                let isCrit = Math.random() * 100 < this.getCritChance();
                
                if (isCrit) {
                    damage *= this.getCritMultiplier();
                }

                target.takeDamage(damage, isCrit);
                spawnProjectile(this.x, this.y, target.x, target.y);
                this.skills[1].current = this.skills[1].cdMax * this.getAttackSpeedFactor(); 
            }
        }

        // Aura
        if (this.skills[2].current <= 0) {
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 120) {
                    e.takeDamage(this.getAttackPower() * 0.4, false);
                }
            });
            spawnAura(this.x, this.y);
            this.skills[2].current = this.skills[2].cdMax;
        }

        // Potion
        if (this.hp < this.getMaxHp() * 0.4 && this.skills[0].current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * 0.4);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0');
            this.skills[0].current = this.skills[0].cdMax;
        }

        UI.updateHotbar(this.skills);
    }

    getNearestEnemy(range) {
        let nearest = null; let minDist = range;
        entities.forEach(e => {
            if (e instanceof Enemy) {
                const d = Math.hypot(this.x - e.x, this.y - e.y);
                if (d < minDist) { minDist = d; nearest = e; }
            }
        });
        return nearest;
    }

    takeDamage(amt) {
        // Defense reduces damage by a flat amount (capped at 80% reduction to prevent invincibility)
        const reduction = Math.min(amt * 0.8, this.getDefense());
        const finalDamage = Math.max(1, amt - reduction);
        
        this.hp -= finalDamage;
        spawnFloatingText(this.x, this.y - 20, `-${Math.floor(finalDamage)}`, '#f00');
        if (this.hp <= 0) die();
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
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

    takeDamage(amt, isCrit) {
        this.hp -= amt;
        const color = isCrit ? '#ff0' : '#fff';
        const text = isCrit ? `CRIT ${Math.floor(amt)}` : Math.floor(amt);
        spawnFloatingText(this.x, this.y, text, color);
        if (this.hp <= 0) this.die();
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
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            UI.renderInventory();
        }
    },
    renderInventory: () => {
        // 1. Stats Sheet remains same...
        const sheet = document.getElementById('stats-sheet');
        if (sheet && player) {
            sheet.innerHTML = `
                <div class="stat-line"><span>Max HP</span><span class="stat-val">${Math.floor(player.getMaxHp())}</span></div>
                <div class="stat-line"><span>Attack</span><span class="stat-val">${Math.floor(player.getAttackPower())}</span></div>
                <div class="stat-line"><span>Defense</span><span class="stat-val">${Math.floor(player.getDefense())}</span></div>
                <div class="stat-line"><span>Regen</span><span class="stat-val">${player.getRegen().toFixed(1)}/s</span></div>
                <div class="stat-line"><span>Crit %</span><span class="stat-val">${player.getCritChance().toFixed(1)}%</span></div>
                <div class="stat-line"><span>Crit X</span><span class="stat-val">${player.getCritMultiplier().toFixed(2)}x</span></div>
            `;
        }

        // 2. Specialized Gear Rendering
        const grid = document.getElementById('gear-grid');
        grid.innerHTML = '';
        GEAR_TYPES.forEach(type => {
            const gear = PlayerData.gear[type];
            const cost = gear.level * 10;
            
            // Generate a string describing the bonuses
            let bonusText = "";
            if (gear.atk) bonusText += `Atk: +${Math.floor(gear.atk)} `;
            if (gear.hp) bonusText += `HP: +${Math.floor(gear.hp)} `;
            if (gear.def) bonusText += `Def: +${Math.floor(gear.def)} `;
            if (gear.regen) bonusText += `Reg: +${gear.regen.toFixed(1)} `;
            if (gear.critChance) bonusText += `Crit%: +${gear.critChance.toFixed(1)} `;
            if (gear.critMult) bonusText += `CritX: +${gear.critMult.toFixed(2)} `;
            if (gear.atkSpeed) bonusText += `Spd: +${(gear.atkSpeed * 100).toFixed(0)}% `;

            const div = document.createElement('div');
            div.className = 'gear-item';
            div.innerHTML = `
                <h4 style="color:var(--primary)">${type}</h4>
                <p>Lv. ${gear.level}</p>
                <p style="font-size:0.7rem; color:#03dac6; min-height:20px;">${bonusText}</p>
                <button class="upgrade-btn" ${PlayerData.shards < cost ? 'disabled' : ''} onclick="UI.upgradeGear('${type}')">
                    Upgrade (${cost} 💎)
                </button>
            `;
            grid.appendChild(div);
        });
        UI.updateCurrencies();
    },

    upgradeGear: (type) => {
        const gear = PlayerData.gear[type];
        const cost = gear.level * 10;
        if (PlayerData.shards >= cost) {
            PlayerData.shards -= cost;
            gear.level++;

            // Apply logic-based specialized scaling
            if (gear.atk !== undefined) gear.atk += randomInt(3, 7);
            if (gear.hp !== undefined) gear.hp += randomInt(15, 30);
            if (gear.def !== undefined) gear.def += randomInt(2, 5);
            if (gear.regen !== undefined) gear.regen += 0.2;
            if (gear.critChance !== undefined) gear.critChance += 0.4;
            if (gear.critMult !== undefined) gear.critMult += 0.03;
            if (gear.atkSpeed !== undefined) gear.atkSpeed = Math.min(0.6, gear.atkSpeed + 0.01); // Cap speed boost

            UI.renderInventory();
            UI.updateStats();
            saveGame();
            UI.notify(`${type} specialized!`);
        }
    },
    notify: (msg) => {
        const el = document.getElementById('notification');
        el.innerText = msg;
        el.style.opacity = 1;
        // Clean restart of the fade animation
        if (UI._notifTimeout) clearTimeout(UI._notifTimeout);
        UI._notifTimeout = setTimeout(() => el.style.opacity = 0, 2000);
    },
    checkDailyLogin: () => {
        const lastLogin = localStorage.getItem('dof_lastLogin');
        const today = new Date().toDateString();
        if (lastLogin !== today) {
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
        UI.notify("Daily Rewards Claimed!");
    }
};

// --- SAVE / LOAD ---
function saveGame() {
    localStorage.setItem('dof_save', JSON.stringify(PlayerData));
}

function loadGame() {
    const save = localStorage.getItem('dof_save');
    if (save) {
        try {
            const data = JSON.parse(save);
            // Deep merge gear to handle potential version updates
            PlayerData = { ...PlayerData, ...data };
            if (data.gear) PlayerData.gear = { ...PlayerData.gear, ...data.gear };
        } catch(e) { console.error("Save Corrupted", e); }
    }
}

// --- RENDERING ---
function drawMap(camX, camY) {
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(MAP_SIZE - 1, startCol + Math.ceil(canvas.width / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(MAP_SIZE - 1, startRow + Math.ceil(canvas.height / TILE_SIZE) + 1);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            const isExplored = exploredGrid[r][c];
            const screenX = c * TILE_SIZE - camX;
            const screenY = r * TILE_SIZE - camY;

            if (!isExplored) {
                ctx.fillStyle = '#000';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                continue;
            }

            if (mapGrid[r][c] === 1) {
                ctx.fillStyle = '#1e1e1e'; // Wall
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#2a2a2a';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#161616'; // Floor
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                // Subtle floor detail
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(screenX + TILE_SIZE/4, screenY + TILE_SIZE/4, TILE_SIZE/2, TILE_SIZE/2);
            }
        }
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (GameState.state !== 'PLAYING' && GameState.state !== 'DEAD') return;

    // Camera follow player
    let camX = player.x - canvas.width / 2;
    let camY = player.y - canvas.height / 2;
    
    // Clamp camera to map bounds
    camX = Math.max(0, Math.min(camX, MAP_SIZE * TILE_SIZE - canvas.width));
    camY = Math.max(0, Math.min(camY, MAP_SIZE * TILE_SIZE - canvas.height));

    ctx.save();
    drawMap(camX, camY);
    ctx.translate(-camX, -camY);

    // Render Portal
    const pRow = Math.floor(portal.y/TILE_SIZE);
    const pCol = Math.floor(portal.x/TILE_SIZE);
    if (exploredGrid[pRow] && exploredGrid[pRow][pCol]) {
        const glow = Math.abs(Math.sin(Date.now()/500)) * 20;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Entities (Loot, Enemies, Player) sorted by Y for depth
    entities.sort((a, b) => a.y - b.y).forEach(e => {
        if (e.draw) e.draw(ctx);
    });

    particles.forEach(p => p.draw(ctx));
    floatingTexts.forEach(ft => ft.draw(ctx));

    ctx.restore();

    if (GameState.state === 'DEAD') {
        ctx.fillStyle = 'rgba(100, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("YOU HAVE FALLEN", canvas.width/2, canvas.height/2);
    }
}

// --- MAIN LOOP ---
function loop(timestamp) {
    const dt = Math.min(0.1, (timestamp - GameState.lastTime) / 1000); 
    GameState.lastTime = timestamp;

    if (GameState.state === 'PLAYING') {
        HiveMind.update();
        
        // Use a reverse loop for safe removal during iteration
        for (let i = entities.length - 1; i >= 0; i--) {
            entities[i].update(dt);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
        }

        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update(dt);
        }

        // Auto-spawn logic
        if (GameState.frame % 120 === 0) {
            const enemyCount = entities.filter(e => e instanceof Enemy).length;
            if (enemyCount < 10 + GameState.level) {
                spawnEnemies();
            }
        }

        if (GameState.frame % 30 === 0) UI.updateMinimap();
    }

    draw();
    GameState.frame++;
    requestAnimationFrame(loop);
}

// --- BOOT SEQUENCE ---
window.onload = () => {
    loadGame();
    
    const fill = document.getElementById('loading-fill');
    let progress = 0;
    const bootInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(bootInterval);
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('main-menu').classList.remove('hidden');
                GameState.state = 'MENU';
            }, 400);
        }
        fill.style.width = progress + '%';
    }, 80);
};

document.getElementById('play-btn').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    initLevel();
    UI.updateCurrencies();
    UI.checkDailyLogin();
    
    GameState.state = 'PLAYING';
    GameState.lastTime = performance.now();
    requestAnimationFrame(loop);
});

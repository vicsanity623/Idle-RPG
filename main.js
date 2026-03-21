/**
 * main.js
 * Core engine and system managers.
 */

// Import the Player class
import { Player } from './player.js';

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
    frame: 0,
    pendingLevelUp: false // FIX: Track if we need to change levels safely
};

// Persistent Data
let PlayerData = {
    gold: 0,
    shards: 0,
    level: 1,
    dungeonLevel: 1,
    xp: 0,
    maxXp: 100,
    talentPoints: 0, // NEW: Talent points for skill tree
    unlockedTalents: {}, // NEW: Object to store unlocked talent IDs
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

// --- SKILL TREE DATA & LOGIC (NEW) ---
const SKILL_TREE_NODES = [
    {
        id: 'atk_1',
        name: 'Basic Attack Boost',
        description: '+5 Attack Power',
        cost: 1,
        prerequisites: [],
        effect: { stat: 'atk', value: 5 }
    },
    {
        id: 'hp_1',
        name: 'Health Boost',
        description: '+25 Max HP',
        cost: 1,
        prerequisites: [],
        effect: { stat: 'hp', value: 25 }
    },
    {
        id: 'crit_chance_1',
        name: 'Critical Eye',
        description: '+1.0% Critical Chance',
        cost: 1,
        prerequisites: [],
        effect: { stat: 'critChance', value: 1.0 }
    },
    {
        id: 'gold_find_1',
        name: 'Greedy Touch',
        description: '+5% Gold Find',
        cost: 1,
        prerequisites: [],
        effect: { stat: 'goldFind', value: 0.05 } // Multiplier
    },
    {
        id: 'atk_2',
        name: 'Advanced Attack Boost',
        description: '+10 Attack Power',
        cost: 2,
        prerequisites: ['atk_1'],
        effect: { stat: 'atk', value: 10 }
    },
    {
        id: 'hp_2',
        name: 'Vitality Boost',
        description: '+50 Max HP',
        cost: 2,
        prerequisites: ['hp_1'],
        effect: { stat: 'hp', value: 50 }
    },
    {
        id: 'crit_mult_1',
        name: 'Lethal Strikes',
        description: '+0.1x Critical Multiplier',
        cost: 2,
        prerequisites: ['crit_chance_1'],
        effect: { stat: 'critMult', value: 0.1 }
    },
    {
        id: 'xp_gain_1',
        name: 'Focused Learning',
        description: '+10% XP Gain',
        cost: 2,
        prerequisites: [],
        effect: { stat: 'xpGain', value: 0.10 } // Multiplier
    }
    // Add more nodes as the game evolves
];

/**
 * Aggregates all active talent effects from unlocked talents.
 * This function is globally available for Player class to use.
 * @param {Object.<string, boolean>} unlockedTalents - Map of talent IDs to true if unlocked.
 * @returns {Object} An object containing aggregated stat bonuses.
 */
function getAggregatedTalentEffects(unlockedTalents) {
    const effects = {
        atk: 0,
        hp: 0,
        def: 0,
        regen: 0,
        critChance: 0,
        critMult: 0,
        atkSpeed: 0, // Reduction factor
        goldFind: 0, // Percentage bonus
        xpGain: 0 // Percentage bonus
    };

    SKILL_TREE_NODES.forEach(node => {
        if (unlockedTalents[node.id]) {
            if (node.effect.stat === 'atk') effects.atk += node.effect.value;
            else if (node.effect.stat === 'hp') effects.hp += node.effect.value;
            else if (node.effect.stat === 'def') effects.def += node.effect.value;
            else if (node.effect.stat === 'regen') effects.regen += node.effect.value;
            else if (node.effect.stat === 'critChance') effects.critChance += node.effect.value;
            else if (node.effect.stat === 'critMult') effects.critMult += node.effect.value;
            else if (node.effect.stat === 'atkSpeed') effects.atkSpeed += node.effect.value;
            else if (node.effect.stat === 'goldFind') effects.goldFind += node.effect.value;
            else if (node.effect.stat === 'xpGain') effects.xpGain += node.effect.value;
        }
    });

    return effects;
}

// Entities
let mapGrid = [];
let exploredGrid = [];
let entities = [];
let particles = [];
let floatingTexts = [];
let portal = null;
let player = null;

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

// --- ENGINE FUNCTIONS ---

function spawnFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(x, y, text, color));
}

function spawnLoot(x, y, type) {
    entities.push(new Loot(x, y, type));
}

class Projectile {
    /**
     * @param {number} x - Starting X coordinate.
     * @param {number} y - Starting Y coordinate.
     * @param {number} targetX - Target X coordinate.
     * @param {number} targetY - Target Y coordinate.
     * @param {number} speed - Speed of the projectile in pixels/second.
     * @param {number} damage - Damage dealt by the projectile.
     * @param {string} color - Color of the projectile.
     */
    constructor(x, y, targetX, targetY, speed, damage, color = '#bb86fc') {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.damage = damage;
        this.color = color;
        this.radius = 5;
        this.lifetime = 1.5; // seconds
        this.currentLifetime = 0;
        this.isAlive = true; // For cleanup in main loop

        const angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        if (!this.isAlive) return;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.currentLifetime += dt;

        // Check for collision with enemies (simplified for now)
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            // Assuming Enemy class exists and has x, y, radius, takeDamage
            if (entity instanceof Enemy && entity.isAlive) {
                const dist = Math.hypot(this.x - entity.x, this.y - entity.y);
                if (dist < this.radius + entity.radius) {
                    entity.takeDamage(this.damage);
                    this.isAlive = false; // Mark projectile for removal
                    spawnAura(this.x, this.y); // Burst effect
                    break; // Projectile hits one target
                }
            }
        }

        if (this.currentLifetime >= this.lifetime) {
            this.isAlive = false; // Mark for removal
        }
    }

    draw(ctx) {
        if (!this.isAlive) return;
        ctx.save();
        ctx.shadowBlur = 15; // SOTA rendering technique
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalCompositeOperation = 'lighter'; // SOTA rendering technique for glowing effect
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Spawns a projectile from a starting point to a target point.
 * @param {number} x1 - Starting X coordinate.
 * @param {number} y1 - Starting Y coordinate.
 * @param {number} x2 - Target X coordinate.
 * @param {number} y2 - Target Y coordinate.
 */
function spawnProjectile(x1, y1, x2, y2) {
    const projectileSpeed = 500; // pixels per second
    // Assuming player exists and has getAttackPower method
    const projectileDamage = player.getAttackPower(); 
    entities.push(new Projectile(x1, y1, x2, y2, projectileSpeed, projectileDamage));
}

function spawnAura(x, y) {
    for(let i=0; i<20; i++) particles.push(new Particle(x, y, '#ff9800'));
}

function gainXp(amt) {
    // Apply XP gain bonus from talents
    const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
    const actualAmt = amt * (1 + talentEffects.xpGain);

    PlayerData.xp += actualAmt;
    if (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        PlayerData.level++;
        PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.5);
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');

        // NEW: Award talent point every 5 levels
        if (PlayerData.level % 5 === 0) {
            PlayerData.talentPoints++;
            spawnFloatingText(player.x, player.y - 60, "TALENT POINT!", '#ffeb3b');
        }
    }
    UI.updateStats();
    saveGame();
}

function die() {
    GameState.state = 'DEAD'
    PlayerData.gold = Math.floor(PlayerData.gold / 2);
    PlayerData.shards = Math.floor(PlayerData.shards / 2);
    UI.notify("YOU DIED. Lost 50% Wealth.");
    
    GameState.level = 1;
    saveGame();
    
    setTimeout(() => {
        initLevel();
        GameState.state = 'PLAYING';
    }, 2000);
}

function levelUpDungeon() {
    GameState.pendingLevelUp = true;
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
        document.getElementById('talent-points').innerText = PlayerData.talentPoints; // NEW: Update talent points display
    },
    updateCurrencies: () => {
        // Apply gold find bonus from talents
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        const goldDisplay = Math.floor(PlayerData.gold * (1 + talentEffects.goldFind));
        document.getElementById('c-gold').innerText = goldDisplay;
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
        if(portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) {
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
            // Close other modals if open
            document.getElementById('skill-tree-modal').style.display = 'none';
        }
    },
    renderInventory: () => {
        // 1. Stats Sheet
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
    // NEW: Skill Tree UI functions
    toggleSkillTree: () => {
        const modal = document.getElementById('skill-tree-modal');
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            UI.renderSkillTree();
            // Close other modals if open
            document.getElementById('inventory-modal').style.display = 'none';
        }
    },
    renderSkillTree: () => {
        const treeContainer = document.getElementById('skill-tree-grid');
        treeContainer.innerHTML = ''; // Clear previous rendering

        SKILL_TREE_NODES.forEach(node => {
            const isUnlocked = PlayerData.unlockedTalents[node.id];
            const canUnlock = PlayerData.talentPoints >= node.cost &&
                              node.prerequisites.every(prereq => PlayerData.unlockedTalents[prereq]);

            const nodeDiv = document.createElement('div');
            nodeDiv.className = `skill-node ${isUnlocked ? 'unlocked' : ''} ${canUnlock && !isUnlocked ? 'available' : ''}`;
            nodeDiv.innerHTML = `
                <h4>${node.name}</h4>
                <p>${node.description}</p>
                <p>Cost: ${node.cost} TP</p>
            `;
            if (!isUnlocked && canUnlock) {
                nodeDiv.onclick = () => UI.unlockTalent(node.id);
            } else if (isUnlocked) {
                nodeDiv.title = "Already unlocked";
            } else {
                nodeDiv.title = "Prerequisites not met or not enough TP";
            }
            treeContainer.appendChild(nodeDiv);
        });
        document.getElementById('talent-points').innerText = PlayerData.talentPoints;
    },
    unlockTalent: (talentId) => {
        const node = SKILL_TREE_NODES.find(n => n.id === talentId);
        if (!node) return;

        const isUnlocked = PlayerData.unlockedTalents[node.id];
        const canUnlock = PlayerData.talentPoints >= node.cost &&
                          node.prerequisites.every(prereq => PlayerData.unlockedTalents[prereq]);

        if (!isUnlocked && canUnlock) {
            PlayerData.talentPoints -= node.cost;
            PlayerData.unlockedTalents[node.id] = true;
            UI.notify(`Talent "${node.name}" unlocked!`);
            UI.renderSkillTree();
            UI.updateStats(); // Stats might change
            saveGame();
        } else if (isUnlocked) {
            UI.notify("Talent already unlocked.");
        } else {
            UI.notify("Cannot unlock talent: insufficient points or prerequisites not met.");
        }
    },
    notify: (msg) => {
        const el = document.getElementById('notification');
        el.innerText = msg;
        el.style.opacity = 1;
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
    PlayerData.dungeonLevel = GameState.level; 
    localStorage.setItem('dof_save', JSON.stringify(PlayerData));
}

function loadGame() {
    const save = localStorage.getItem('dof_save');
    if (save) {
        try {
            const data = JSON.parse(save);
            PlayerData = { ...PlayerData, ...data };
            if (data.gear) PlayerData.gear = { ...PlayerData.gear, ...data.gear };
            if (PlayerData.dungeonLevel) {
                GameState.level = PlayerData.dungeonLevel;
            }
            // Ensure new properties are initialized if not in old save
            if (PlayerData.talentPoints === undefined) PlayerData.talentPoints = 0;
            if (PlayerData.unlockedTalents === undefined) PlayerData.unlockedTalents = {};
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
    if (portal) {
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
        if (GameState.pendingLevelUp) {
            GameState.level++;
            UI.notify(`Entering Depth ${GameState.level}`);
            initLevel();
            GameState.pendingLevelUp = false;
            saveGame();
        }

        HiveMind.update();
        
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
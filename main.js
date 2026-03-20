/**
 * main.js
 * Core engine and system managers.
 */

// --- CONFIG & GLOBALS ---
const TILE_SIZE = 64;
const MAP_SIZE = 40; // 40x40 tiles
const GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'];

// Import skill management functions
import { renderSkills, upgradeSkill } from './skills.js';

// Define Skill Tree structure
const SKILLS = {
    'HP_BOOST_1': {
        id: 'HP_BOOST_1',
        name: 'Vitality Training',
        description: 'Increases maximum HP by 20 per level.',
        maxLevel: 5,
        cost: (level) => 1 + level, // Cost in skill points
        effect: (level) => ({ hp: level * 20 }),
        prerequisites: [],
        position: { x: 0, y: 0 } // For potential visual tree layout
    },
    'ATK_BOOST_1': {
        id: 'ATK_BOOST_1',
        name: 'Combat Prowess',
        description: 'Increases base attack power by 5 per level.',
        maxLevel: 5,
        cost: (level) => 1 + level,
        effect: (level) => ({ atk: level * 5 }),
        prerequisites: [],
        position: { x: 1, y: 0 }
    },
    'CRIT_CHANCE_1': {
        id: 'CRIT_CHANCE_1',
        name: 'Precision Strike',
        description: 'Increases critical hit chance by 1% per level.',
        maxLevel: 3,
        cost: (level) => 2 + level,
        effect: (level) => ({ critChance: level * 1 }),
        prerequisites: ['ATK_BOOST_1'], // Requires ATK_BOOST_1 at any level
        position: { x: 2, y: 0 }
    },
    'REGEN_BOOST_1': {
        id: 'REGEN_BOOST_1',
        name: 'Rapid Recovery',
        description: 'Increases HP regeneration by 0.2 per second per level.',
        maxLevel: 3,
        cost: (level) => 2 + level,
        effect: (level) => ({ regen: level * 0.2 }),
        prerequisites: ['HP_BOOST_1'],
        position: { x: 0, y: 1 }
    }
    // Add more skills here
};

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
    frame: 0,
    pendingLevelUp: false // FIX: Track if we need to change levels safely
};

// Persistent Data
let PlayerData = {
    gold: 0,
    shards: 0,
    level: 1,
    xp: 0,
    maxXp: 100,
    skillPoints: 0, // NEW: Skill points for talent system
    learnedSkills: {}, // NEW: Object to store learned skills and their levels { skillId: level }
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
        PlayerData.skillPoints += 1; // NEW: Award 1 skill point on level up
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
        // UI.updateSkillPointsDisplay() is now handled by renderSkills
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
    // FIX: Don't call initLevel immediately. Set a flag.
    // This prevents clearing the entities array while the loop is still using it.
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
    },
    updateCurrencies: () => {
        document.getElementById('c-gold').innerText = PlayerData.gold;
        document.getElementById('c-shard').innerText = PlayerData.shards;
    },
    updateSkillPointsDisplay: () => { // NEW: Update skill points display
        const spEl = document.getElementById('skill-points-display');
        if (spEl) spEl.innerText = PlayerData.skillPoints;
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
    toggleInventory: (tab = 'gear') => { // MODIFIED: Added tab parameter
        const modal = document.getElementById('inventory-modal');
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            if (tab === 'skills') {
                UI.showSkillsTab();
            } else {
                UI.showGearTab();
            }
        }
    },
    showGearTab: () => { // NEW: Function to show gear tab
        document.getElementById('gear-tab-btn').classList.add('active');
        document.getElementById('skills-tab-btn').classList.remove('active');
        document.getElementById('gear-content').style.display = 'flex';
        document.getElementById('skills-content').style.display = 'none';
        UI.renderInventory();
    },
    showSkillsTab: () => { // NEW: Function to show skills tab
        document.getElementById('gear-tab-btn').classList.remove('active');
        document.getElementById('skills-tab-btn').classList.add('active');
        document.getElementById('gear-content').style.display = 'none';
        document.getElementById('skills-content').style.display = 'flex';
        UI.renderSkills(player); // Pass player instance
        // UI.updateSkillPointsDisplay() is now handled by renderSkills
    },
    renderInventory: () => {
        // 1. Stats Sheet
        const sheet = document.getElementById('stats-sheet');
        if (sheet && player) {
            // Ensure player stats are updated before rendering
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

    renderSkills: () => { // NEW: Method to render the skill tree
        const skillTreeContainer = document.getElementById('skills-grid');
        skillTreeContainer.innerHTML = ''; // Clear previous skills

        const skillPointsDisplay = document.getElementById('skill-points-display');
        if (skillPointsDisplay) skillPointsDisplay.innerText = PlayerData.skillPoints;

        Object.values(SKILLS).forEach(skill => {
            const currentLevel = PlayerData.learnedSkills[skill.id] || 0;
            const nextLevel = currentLevel + 1;
            const cost = skill.cost(currentLevel);
            const canAfford = PlayerData.skillPoints >= cost;
            const isMaxLevel = currentLevel >= skill.maxLevel;

            // Check prerequisites
            const hasPrerequisites = skill.prerequisites.every(prereqId => PlayerData.learnedSkills[prereqId] > 0);
            const canUpgrade = canAfford && !isMaxLevel && hasPrerequisites;

            let effectText = '';
            if (skill.effect) {
                const nextEffect = skill.effect(nextLevel);
                for (const key in nextEffect) {
                    effectText += `${key.toUpperCase()}: +${nextEffect[key]} `;
                }
            }

            const skillDiv = document.createElement('div');
            skillDiv.className = 'skill-node';
            if (isMaxLevel) skillDiv.classList.add('max-level');
            else if (currentLevel > 0) skillDiv.classList.add('learned');
            if (!hasPrerequisites) skillDiv.classList.add('locked');

            skillDiv.innerHTML = `
                <h4 style="color:var(--primary)">${skill.name}</h4>
                <p>${skill.description}</p>
                <p>Level: ${currentLevel} / ${skill.maxLevel}</p>
                <p style="font-size:0.7rem; color:#03dac6; min-height:20px;">${effectText}</p>
                <button class="upgrade-btn" ${!canUpgrade ? 'disabled' : ''} onclick="UI.upgradeSkill('${skill.id}')">
                    ${isMaxLevel ? 'MAX LEVEL' : `Upgrade (${cost} SP)`}
                </button>
                ${!hasPrerequisites && !isMaxLevel ? `<p class="prereq-text">Requires: ${skill.prerequisites.map(id => SKILLS[id].name).join(', ')}</p>` : ''}
            `;
            skillTreeContainer.appendChild(skillDiv);
        });
    },

    upgradeSkill: (skillId) => { // NEW: Method to handle skill upgrades
        const skill = SKILLS[skillId];
        if (!skill) {
            UI.notify("Skill not found!");
            return;
        }

        const currentLevel = PlayerData.learnedSkills[skillId] || 0;
        const nextLevel = currentLevel + 1;
        const cost = skill.cost(currentLevel);

        // Check prerequisites
        const hasPrerequisites = skill.prerequisites.every(prereqId => PlayerData.learnedSkills[prereqId] > 0);

        if (currentLevel >= skill.maxLevel) {
            UI.notify(`${skill.name} is already at max level!`);
            return;
        }
        if (PlayerData.skillPoints < cost) {
            UI.notify("Not enough Skill Points!");
            return;
        }
        if (!hasPrerequisites) {
            UI.notify(`Requires: ${skill.prerequisites.map(id => SKILLS[id].name).join(', ')}`);
            return;
        }

        PlayerData.skillPoints -= cost;
        PlayerData.learnedSkills[skillId] = nextLevel;

        player.applySkillEffects(); // NEW: Re-apply all skill effects to update player stats
        UI.renderSkills(); // Re-render the skill tree to update button states
        UI.updateStats(); // Update player stats display
        UI.updateSkillPointsDisplay(); // Update skill points display
        saveGame();
        UI.notify(`${skill.name} upgraded to Level ${nextLevel}!`);
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
            player.applySkillEffects(); // Apply gear effects to update player stats
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

// Add to UI object (overwriting existing methods)
UI.renderSkills = (player) => renderSkills(player);

UI.upgradeSkill = (skillId) => {
    const player = Player; // Make sure to pass the player instance
    upgradeSkill(skillId, player, PlayerData, saveGame, UI.notify);
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
            // NEW: Ensure learnedSkills is initialized if not present in old save
            if (!PlayerData.learnedSkills) PlayerData.learnedSkills = {};
            if (player) player.applySkillEffects(); // Apply skill effects on load
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
    GameState.deltaTime = dt; // Assign the calculated delta time

    if (GameState.state === 'PLAYING') {
        // FIX: SAFE LEVEL TRANSITION
        // Check for the level-up flag here, before we iterate through the entities.
        if (GameState.pendingLevelUp) {
            GameState.level++;
            UI.notify(`Entering Depth ${GameState.level}`);
            initLevel();
            player.applySkillEffects(); // Apply skill effects after level init
            GameState.pendingLevelUp = false;
        }

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
    player.applySkillEffects(); // Apply skill effects after initializing player
    UI.renderSkills(player); // Ensure skills are rendered in UI
    UI.updateCurrencies();
    UI.checkDailyLogin();
    // UI.updateSkillPointsDisplay() is now handled by renderSkills

    GameState.state = 'PLAYING';
    GameState.lastTime = performance.now();
    requestAnimationFrame(loop);
});

// NEW: Add event listeners for inventory tab switching
document.getElementById('gear-tab-btn').addEventListener('click', () => UI.showGearTab());
document.getElementById('skills-tab-btn').addEventListener('click', () => UI.showSkillsTab());

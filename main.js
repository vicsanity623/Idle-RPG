/**
 * main.js
 * Core engine and system managers.
 */

// --- GLOBAL CONSTANTS & CONFIG & UI SYSTEM ---
const TILE_SIZE = 64,
      MAP_SIZE = 40, // 40x40 tiles
      GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'],
      canvas = document.getElementById('game-canvas'),
      ctx = canvas.getContext('2d'),
      randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      randomFloat = (min, max) => Math.random() * (max - min) + min,
      GameState = {
          state: 'BOOT', // BOOT, MENU, PLAYING, DEAD
          level: 1,
          camera: { x: 0, y: 0 },
          lastTime: 0,
          frame: 0,
          pendingLevelUp: false 
      },
      Input = {
          joystick: { active: false, angle: 0, x:0, y:0 }
      },
      jZone = document.getElementById('joystick-zone'),
      jBase = document.getElementById('j-base'),
      jStick = document.getElementById('j-stick'),
      endJoystick = () => {
          Input.joystick.active = false;
          jBase.style.display = 'none';
      },
      UI = {
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
                  let overlay = document.getElementById(`cd-${i}`);
                  let pct = (s.current / s.cdMax) * 100;
                  overlay.style.height = `${pct}%`;
              });
          },
          updateMinimap: () => {
              let mmCanvas = document.getElementById('minimap');
              let mmCtx = mmCanvas.getContext('2d');
              mmCtx.clearRect(0,0,100,100);
              let cellW = 100 / MAP_SIZE;
              
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
              let modal = document.getElementById('inventory-modal');
              if (modal.style.display === 'flex') {
                  modal.style.display = 'none';
              } else {
                  modal.style.display = 'flex';
                  UI.renderInventory();
              }
          },
          renderInventory: () => {
              // 1. Stats Sheet
              let sheet = document.getElementById('stats-sheet');
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

              // 2. Equipped Gear Grid
              let grid = document.getElementById('gear-grid');
              if (grid) {
                  grid.innerHTML = '';
                  GEAR_TYPES.forEach(type => {
                      let gear = PlayerData.gear[type];
                      if (!gear) return;
                      let itemLevel = gear.level || 1;
                      let cost = itemLevel * 10;
                      let stats = gear.stats || gear; 
                      
                      let bonusText = "";
                      if (stats.atk) bonusText += `Atk: +${Math.floor(stats.atk)} `;
                      if (stats.hp) bonusText += `HP: +${Math.floor(stats.hp)} `;
                      if (stats.def) bonusText += `Def: +${Math.floor(stats.def)} `;
                      if (stats.regen) bonusText += `Reg: +${stats.regen.toFixed(1)} `;
                      if (stats.critChance) bonusText += `Crit%: +${stats.critChance.toFixed(1)} `;
                      if (stats.critMult) bonusText += `CritX: +${stats.critMult.toFixed(2)} `;
                      if (stats.atkSpeed) bonusText += `Spd: +${(stats.atkSpeed * 100).toFixed(0)}% `;

                      let div = document.createElement('div');
                      div.className = 'gear-item';
                      div.innerHTML = `
                          <h4 style="color:var(--primary)">${gear.name || type}</h4>
                          <p>Lv. ${itemLevel}</p>
                          <p style="font-size:0.7rem; color:#03dac6; min-height:20px;">${bonusText}</p>
                          <button class="upgrade-btn" ${PlayerData.shards < cost ? 'disabled' : ''} onclick="UI.upgradeGear('${type}')">
                              Upgrade (${cost} 💎)
                          </button>
                      `;
                      grid.appendChild(div);
                  });
              }

              // 3. Inventory Bag Grid
              let bagGrid = document.getElementById('bag-grid');
              if (bagGrid) {
                  bagGrid.innerHTML = '';
                  if (PlayerData.inventory && PlayerData.inventory.length > 0) {
                      PlayerData.inventory.forEach((item, index) => {
                          let stats = item.stats || item;
                          let bonusText = "";
                          if (stats.atk) bonusText += `Atk: +${Math.floor(stats.atk)} `;
                          if (stats.hp) bonusText += `HP: +${Math.floor(stats.hp)} `;
                          if (stats.def) bonusText += `Def: +${Math.floor(stats.def)} `;
                          if (stats.regen) bonusText += `Reg: +${stats.regen.toFixed(1)} `;
                          if (stats.critChance) bonusText += `Crit%: +${stats.critChance.toFixed(1)} `;
                          if (stats.critMult) bonusText += `CritX: +${stats.critMult.toFixed(2)} `;
                          if (stats.atkSpeed) bonusText += `Spd: +${(stats.atkSpeed * 100).toFixed(0)}% `;

                          let div = document.createElement('div');
                          div.className = 'gear-item';
                          div.innerHTML = `
                              <h4 style="color:#00e5ff">${item.name || item.slot}</h4>
                              <p style="font-size:0.7rem; color:#aaa; margin-top:5px; min-height:20px;">${bonusText}</p>
                              <button class="upgrade-btn" style="background:#00e5ff; color:#000; margin-top:auto;" onclick="UI.equipItem(${index})">
                                  Equip
                              </button>
                          `;
                          bagGrid.appendChild(div);
                      });
                  } else {
                      bagGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #777; font-size: 0.9rem;">Your bag is empty. Slay enemies to find gear!</p>`;
                  }
              }
              UI.updateCurrencies();
          },

          equipItem: (index) => {
              if (!PlayerData.inventory || !PlayerData.inventory[index]) return;
              
              let itemToEquip = PlayerData.inventory[index];
              let slot = itemToEquip.slot;
              
              PlayerData.inventory.splice(index, 1);
              let currentlyEquipped = PlayerData.gear[slot];
              
              if (currentlyEquipped && currentlyEquipped.id) {
                  PlayerData.inventory.push(currentlyEquipped);
              }
              
              PlayerData.gear[slot] = itemToEquip;
              
              UI.renderInventory();
              UI.updateStats();
              if (typeof player !== 'undefined' && player) {
                  player.hp = Math.min(player.hp, player.getMaxHp());
              }
              saveGame();
              UI.notify(`Equipped ${itemToEquip.name || slot}`);
          },

          upgradeGear: (type) => {
              let gear = PlayerData.gear[type];
              if (!gear) return;
              
              let stats = gear.stats || gear; 
              gear.level = gear.level || 1;
              let cost = gear.level * 10;
              
              if (PlayerData.shards >= cost) {
                  PlayerData.shards -= cost;
                  gear.level++;

                  if (stats.atk !== undefined) stats.atk += randomInt(3, 7);
                  if (stats.hp !== undefined) stats.hp += randomInt(15, 30);
                  if (stats.def !== undefined) stats.def += randomInt(2, 5);
                  if (stats.regen !== undefined) stats.regen += 0.2;
                  if (stats.critChance !== undefined) stats.critChance += 0.4;
                  if (stats.critMult !== undefined) stats.critMult += 0.03;
                  if (stats.atkSpeed !== undefined) stats.atkSpeed = Math.min(0.6, stats.atkSpeed + 0.01); 

                  UI.renderInventory();
                  UI.updateStats();
                  saveGame();
                  UI.notify(`${type} specialized!`);
              }
          },
          notify: (msg) => {
              let el = document.getElementById('notification');
              el.innerText = msg;
              el.style.opacity = 1;
              if (UI._notifTimeout) clearTimeout(UI._notifTimeout);
              UI._notifTimeout = setTimeout(() => el.style.opacity = 0, 2000);
          },
          checkDailyLogin: () => {
              let lastLogin = localStorage.getItem('dof_lastLogin');
              let today = new Date().toDateString();
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


canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Persistent Data
let PlayerData = {
    gold: 0,
    shards: 0,
    level: 1,
    dungeonLevel: 1,
    xp: 0,
    maxXp: 100,
    inventory: [], // Added fallback empty array initialization
    gear: {
        'Weapon':   { level: 1, atk: 10, critMult: 0.05, rarity: 'Common' },
        'Armor':    { level: 1, hp: 50, def: 5, rarity: 'Common' },
        'Legs':     { level: 1, def: 8, hp: 20, rarity: 'Common' },
        'Fists':    { level: 1, critChance: 2, atk: 5, rarity: 'Common' },
        'Head':     { level: 1, hp: 30, def: 5, rarity: 'Common' },
        'Robe':     { level: 1, regen: 0.5, hp: 20, rarity: 'Common' },
        'Ring':     { level: 1, atk: 8, critChance: 1.5, rarity: 'Common' },
        'Earrings': { level: 1, critMult: 0.1, regen: 0.2, rarity: 'Common' },
        'Necklace': { level: 1, regen: 1.0, hp: 10, rarity: 'Common' },
        'Boots':    { level: 1, def: 5, atkSpeed: 0.02, rarity: 'Common' } 
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
    let maxFloors = (MAP_SIZE * MAP_SIZE) * 0.4;
    
    // Start area
    for(let i=-2; i<=2; i++) {
        for(let j=-2; j<=2; j++) {
            mapGrid[y+i][x+j] = 0;
        }
    }

    // Drunkard's walk
    while (floorCount < maxFloors) {
        let dir = randomInt(0, 3);
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
    let col = Math.floor(x / TILE_SIZE);
    let row = Math.floor(y / TILE_SIZE);
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
    constructor(x, y, targetX, targetY, speed, damage, color = '#bb86fc') {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.damage = damage;
        this.color = color;
        this.radius = 5;
        this.lifetime = 1.5; // seconds
        this.currentLifetime = 0;
        this.isAlive = true; 

        let angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        if (!this.isAlive) return;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.currentLifetime += dt;

        for (let i = 0; i < entities.length; i++) {
            let entity = entities[i];
            if (entity instanceof Enemy && entity.hp > 0) {
                let dist = Math.hypot(this.x - entity.x, this.y - entity.y);
                if (dist < this.radius + entity.radius) {
                    entity.takeDamage(this.damage, false); // Projectile hits don't inherently crit here unless passed down
                    this.isAlive = false; 
                    spawnAura(this.x, this.y); 
                    break; 
                }
            }
        }

        if (this.currentLifetime >= this.lifetime) {
            this.isAlive = false; 
        }
    }

    draw(ctx) {
        if (!this.isAlive) return;
        ctx.save();
        ctx.shadowBlur = 15; 
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalCompositeOperation = 'lighter'; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnProjectile(x1, y1, x2, y2) {
    if (!player) return; 
    let projectileSpeed = 500; 
    let projectileDamage = player.getAttackPower(); 
    entities.push(new Projectile(x1, y1, x2, y2, projectileSpeed, projectileDamage));
}

function spawnAura(x, y) {
    for(let i=0; i<20; i++) particles.push(new Particle(x, y, '#ff9800'));
}

function gainXp(amt) {
    PlayerData.xp += amt;
    if (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        PlayerData.level++;
        PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.1);
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
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
    let numEnemies = 5 + Math.floor(GameState.level * 1.5);
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
    
    let startX = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    let startY = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    
    if(!player) player = new Player(startX, startY);
    else { player.x = startX; player.y = startY; }
    
    entities.push(player);
    spawnEnemies();
    
    document.getElementById('d-level').innerText = GameState.level;
    UI.updateMinimap();
}

// --- INPUT (Virtual Joystick) ---

jZone.addEventListener('touchstart', (e) => {
    if(GameState.state !== 'PLAYING') return;
    let touch = e.changedTouches[0];
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
    let touch = e.changedTouches[0];
    let dx = touch.clientX - Input.joystick.x;
    let dy = touch.clientY - Input.joystick.y;
    Input.joystick.angle = Math.atan2(dy, dx);
    
    let dist = Math.min(50, Math.hypot(dx, dy));
    let sx = Math.cos(Input.joystick.angle) * dist;
    let sy = Math.sin(Input.joystick.angle) * dist;
    
    jStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
});

jZone.addEventListener('touchend', endJoystick);
jZone.addEventListener('touchcancel', endJoystick);


// --- SAVE / LOAD ---
function saveGame() {
    PlayerData.dungeonLevel = GameState.level; 
    localStorage.setItem('dof_save', JSON.stringify(PlayerData));
}

function loadGame() {
    let save = localStorage.getItem('dof_save');
    if (save) {
        try {
            let data = JSON.parse(save);
            PlayerData = { ...PlayerData, ...data };
            if (data.gear) PlayerData.gear = { ...PlayerData.gear, ...data.gear };
            if (data.inventory) PlayerData.inventory = data.inventory; 
            if (PlayerData.dungeonLevel) {
                GameState.level = PlayerData.dungeonLevel;
            }
        } catch(e) { console.error("Save Corrupted", e); }
    }
}

// --- RENDERING ---
function drawMap(camX, camY) {
    let startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    let endCol = Math.min(MAP_SIZE - 1, startCol + Math.ceil(canvas.width / TILE_SIZE) + 1);
    let startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    let endRow = Math.min(MAP_SIZE - 1, startRow + Math.ceil(canvas.height / TILE_SIZE) + 1);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            let isExplored = exploredGrid[r][c];
            let screenX = c * TILE_SIZE - camX;
            let screenY = r * TILE_SIZE - camY;

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
        let pRow = Math.floor(portal.y/TILE_SIZE);
        let pCol = Math.floor(portal.x/TILE_SIZE);
        if (exploredGrid[pRow] && exploredGrid[pRow][pCol]) {
            let glow = Math.abs(Math.sin(Date.now()/500)) * 20;
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
    let dt = Math.min(0.1, (timestamp - GameState.lastTime) / 1000); 
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
            let enemyCount = entities.filter(e => e instanceof Enemy).length;
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
    
    let fill = document.getElementById('loading-fill');
    let progress = 0;
    let bootInterval = setInterval(() => {
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

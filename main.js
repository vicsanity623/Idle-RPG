/**
 * main.js
 * Core engine and system managers.
 */

// --- GLOBAL CONSTANTS, DOM REGISTRY & CONFIG ---
const TILE_SIZE = 64,
      MAP_SIZE = 40, 
      GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'],
      
      REFS = {
          canvas:           document.getElementById('game-canvas'),
          pLevel:           document.getElementById('p-level'),
          hpFill:           document.getElementById('hp-fill'),
          hpText:           document.getElementById('hp-text'),
          xpFill:           document.getElementById('xp-fill'),
          xpText:           document.getElementById('xp-text'),
          cGold:            document.getElementById('c-gold'),
          cShard:           document.getElementById('c-shard'),
          invModal:         document.getElementById('inventory-modal'),
          statsSheet:       document.getElementById('stats-sheet'),
          gearGrid:         document.getElementById('gear-grid'),
          bagGrid:          document.getElementById('bag-grid'),
          notification:     document.getElementById('notification'),
          dailyLogin:       document.getElementById('daily-login'),
          deltaPopup:       document.getElementById('stat-delta-popup'),
          deltaTitle:       document.getElementById('delta-title'),
          deltaContent:     document.getElementById('delta-content'),
          depthLevel:       document.getElementById('d-level'),
          loadingFill:      document.getElementById('loading-fill'),
          loadingScreen:    document.getElementById('loading-screen'),
          mainMenu:         document.getElementById('main-menu'),
          uiLayer:          document.getElementById('ui-layer'),
          playBtn:          document.getElementById('play-btn'),
          itemDetailPanel:  document.getElementById('item-detail-panel'),
          detailName:       document.getElementById('detail-item-name'),
          detailRarity:     document.getElementById('detail-rarity-text'),
          selectedStats:    document.getElementById('selected-stats-list'),
          equippedStats:    document.getElementById('equipped-stats-list'),
          equipBtn:         document.getElementById('equip-unequip-btn'),
          discardBtn:       document.getElementById('discard-btn'),
          portalUI:         document.getElementById('portal-ui'),
          portalCost:       document.getElementById('portal-cost-text'),
          unlockBtn:        document.getElementById('unlock-portal-btn'),
          cooldowns:        [0, 1, 2, 3].map(i => document.getElementById(`cd-${i}`))
      },

      ctx = REFS.canvas ? REFS.canvas.getContext('2d') : null,
      randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      randomFloat = (min, max) => Math.random() * (max - min) + min,
      
      GameState = {
          state: 'BOOT', 
          level: 1,
          camera: { x: 0, y: 0 },
          lastTime: 0,
          frame: 0,
          pendingLevelUp: false,
          utick: 0
      },
      
      Input = {
          joystick: { active: false, angle: 0, x:0, y:0 }
      },

      endJoystick = () => {
          Input.joystick.active = false;
          let jBase = document.getElementById('j-base');
          if (jBase) jBase.style.display = 'none';
      },

      UI = {
          updateStats: () => {
              REFS.pLevel.innerText = PlayerData.level;
              REFS.hpFill.style.width = `${Math.max(0, (player.hp / player.getMaxHp()) * 100)}%`;
              REFS.hpText.innerText = `${Math.floor(player.hp)} / ${Math.floor(player.getMaxHp())}`;
              REFS.xpFill.style.width = `${(PlayerData.xp / PlayerData.maxXp) * 100}%`;
              REFS.xpText.innerText = `${Math.floor(PlayerData.xp)} / ${PlayerData.maxXp}`;
          },
          
          updateCurrencies: () => {
              REFS.cGold.innerText = PlayerData.gold;
              REFS.cShard.innerText = PlayerData.shards;
          },
          
          updateHotbar: (skills) => {
              skills.forEach((s, i) => {
                  let overlay = REFS.cooldowns[i];
                  if (overlay) overlay.style.height = `${(s.current / s.cdMax) * 100}%`;
              });
          },
          
          updateMinimap: () => {
              let mmCanvas = document.getElementById('minimap'); // Local reference for drawing
              if (!mmCanvas) return;
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
              mmCtx.fillStyle = '#bb86fc';
              mmCtx.fillRect((player.x/TILE_SIZE)*cellW, (player.y/TILE_SIZE)*cellW, cellW, cellW);
              if(portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) {
                  mmCtx.fillStyle = '#00e5ff';
                  mmCtx.fillRect((portal.x/TILE_SIZE)*cellW, (portal.y/TILE_SIZE)*cellW, cellW, cellW);
              }
          },
          
          toggleInventory: () => {
              if (REFS.invModal.style.display === 'flex') {
                  REFS.invModal.style.display = 'none';
              } else {
                  REFS.invModal.style.display = 'flex';
                  UI.renderInventory();
              }
          },
          
          renderInventory: () => {
              if (REFS.itemDetailPanel) REFS.itemDetailPanel.style.display = 'none';

              if (REFS.statsSheet && player) {
                  REFS.statsSheet.innerHTML = `
                      <div class="stat-line"><span>Max HP</span><span class="stat-val">${Math.floor(player.getMaxHp())}</span></div>
                      <div class="stat-line"><span>Attack</span><span class="stat-val">${Math.floor(player.getAttackPower())}</span></div>
                      <div class="stat-line"><span>Defense</span><span class="stat-val">${Math.floor(player.getDefense())}</span></div>
                      <div class="stat-line"><span>Regen</span><span class="stat-val">${player.getRegen().toFixed(1)}/s</span></div>
                      <div class="stat-line"><span>Crit %</span><span class="stat-val">${player.getCritChance().toFixed(1)}%</span></div>
                      <div class="stat-line"><span>Crit X</span><span class="stat-val">${player.getCritMultiplier().toFixed(2)}x</span></div>
                  `;
              }

              if (REFS.gearGrid) {
                  REFS.gearGrid.innerHTML = '';
                  GEAR_TYPES.forEach(type => {
                      let gear = PlayerData.gear[type];
                      if (!gear) return;
                      
                      let stats = gear.stats || gear; 
                      let itemLevel = gear.level || 1;
                      let shardCost = itemLevel * 10;
                      let goldCost = itemLevel * 500;
                      let canAfford = PlayerData.shards >= shardCost && PlayerData.gold >= goldCost;

                      let bonusText = "";
                      if (stats.atk) bonusText += `Atk: +${Math.floor(stats.atk)} `;
                      if (stats.hp) bonusText += `HP: +${Math.floor(stats.hp)} `;
                      if (stats.def) bonusText += `Def: +${Math.floor(stats.def)} `;

                      let div = document.createElement('div');
                      div.className = 'gear-item';
                      div.style.cursor = "pointer";
                      div.onclick = (e) => {
                          if (e.target.tagName !== 'BUTTON') UI.inspectItem(type, false);
                      };

                      div.innerHTML = `
                          <h4 style="color:${gear.color || 'var(--primary)'}">${gear.name || type}</h4>
                          <p style="font-size:0.7rem; color:#03dac6; min-height:15px;">${bonusText}</p>
                          <button class="upgrade-btn" ${canAfford ? '' : 'disabled'} onclick="UI.upgradeGear('${type}')">
                              Upgrade (${shardCost}💎 / ${goldCost}🪙)
                          </button>
                      `;
                      REFS.gearGrid.appendChild(div);
                  });
              }

              if (REFS.bagGrid) {
                  REFS.bagGrid.innerHTML = '';
                  if (PlayerData.inventory.length > 0) {
                      PlayerData.inventory.forEach((item, index) => {
                          let div = document.createElement('div');
                          div.className = 'gear-item';
                          div.innerHTML = `
                              <h4 style="color:${item.color || '#00e5ff'}">${item.name || item.slot}</h4>
                              <button class="upgrade-btn" style="background:#00e5ff; color:#000;" onclick="UI.inspectItem(${index}, true)">Inspect</button>
                          `;
                          REFS.bagGrid.appendChild(div);
                      });
                  } else {
                      REFS.bagGrid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#777;">Bag is empty.</p>`;
                  }
              }
              UI.updateCurrencies();
          },

          inspectItem: (slotOrIndex, isBagItem) => {
              let item, equippedItem;
              if (isBagItem) {
                  item = PlayerData.inventory[slotOrIndex];
                  equippedItem = PlayerData.gear[item.slot];
              } else {
                  item = PlayerData.gear[slotOrIndex]; 
                  equippedItem = item; 
              }
              if (!item) return;

              REFS.itemDetailPanel.style.display = 'block';
              REFS.detailName.innerText = item.name || slotOrIndex;
              REFS.detailName.style.color = item.color || 'var(--primary)';
              REFS.detailRarity.innerText = item.rarity || 'Common';
              REFS.detailRarity.style.color = item.color || '#fff';

              let statKeys = ['atk', 'hp', 'def', 'regen', 'critChance', 'critMult', 'atkSpeed'],
                  selectedHtml = '', equippedHtml = '',
                  itemStats = item.stats || item,
                  eqStats = equippedItem ? (equippedItem.stats || equippedItem) : {};

              statKeys.forEach(stat => {
                  let val1 = itemStats[stat] || 0, val2 = eqStats[stat] || 0;
                  if (val1 === 0 && val2 === 0) return;
                  let diff = val1 - val2, diffHtml = '';
                  if (diff > 0) diffHtml = `<small style="color:#0f0">(+${diff % 1 !== 0 ? diff.toFixed(2) : diff})</small>`;
                  else if (diff < 0) diffHtml = `<small style="color:#f00">(${diff % 1 !== 0 ? diff.toFixed(2) : diff})</small>`;
                  let formatVal = (v) => {
                      if (v === 0) return "0";
                      return (v < 1 && v > 0) ? v.toFixed(2) : Math.floor(v);
                  };

                  selectedHtml += `<p>${stat.toUpperCase()}: <span style="color:var(--shard)">${formatVal(val1)}</span></p>`;
                  equippedHtml += `<p>${stat.toUpperCase()}: <span style="color:#aaa">${formatVal(val2)}</span> ${diffHtml}</p>`;
              });

              REFS.selectedStats.innerHTML = selectedHtml || '<p>No Stats</p>';
              REFS.equippedStats.innerHTML = equippedHtml || '<p>None</p>';

              if (isBagItem) {
                  REFS.equipBtn.innerText = "Equip";
                  REFS.equipBtn.onclick = () => { UI.equipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; };
                  REFS.discardBtn.style.display = 'block';
                  REFS.discardBtn.onclick = () => { UI.discardItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; };
              } else {
                  REFS.equipBtn.innerText = "Unequip";
                  REFS.equipBtn.onclick = () => { UI.unequipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; };
                  REFS.discardBtn.style.display = 'none'; 
              }
          },

          equipItem: (index) => {
              if (!PlayerData.inventory[index]) return;
              let itemToEquip = PlayerData.inventory[index],
                  slot = itemToEquip.slot,
                  oldStats = { 
                      hp: player.getMaxHp(), atk: player.getAttackPower(), 
                      def: player.getDefense(), regen: player.getRegen(), 
                      critChance: player.getCritChance(), critMult: player.getCritMultiplier(),
                      atkSpeed: player.getAttackSpeedFactor()
                  };

              PlayerData.inventory.splice(index, 1);
              let currentlyEquipped = PlayerData.gear[slot];
              if (currentlyEquipped && currentlyEquipped.id) PlayerData.inventory.push(currentlyEquipped);
              PlayerData.gear[slot] = itemToEquip;
              
              UI.renderInventory();
              UI.updateStats();
              player.hp = Math.min(player.hp, player.getMaxHp());
              saveGame();

              let newStats = { 
                  hp: player.getMaxHp(), atk: player.getAttackPower(), 
                  def: player.getDefense(), regen: player.getRegen(), 
                  critChance: player.getCritChance(), critMult: player.getCritMultiplier(),
                  atkSpeed: player.getAttackSpeedFactor()
              };
              
              let deltaLines = [];
              let statCheck = [
                  { k: 'hp', l: 'Max HP' }, { k: 'atk', l: 'Attack' }, 
                  { k: 'def', l: 'Defense' }, { k: 'regen', l: 'Regen' },
                  { k: 'critChance', l: 'Crit %' }, { k: 'critMult', l: 'Crit X' },
                  { k: 'atkSpeed', l: 'Atk Spd' }
              ];

              statCheck.forEach(s => {
                  let d = newStats[s.k] - oldStats[s.k];
                  if (Math.abs(d) > 0.001) {
                      deltaLines.push({ label: s.l, oldVal: oldStats[s.k], newVal: newStats[s.k], diff: d });
                  }
              });
              
              if (deltaLines.length > 0) UI.showDelta(`Equipped: ${itemToEquip.name}`, deltaLines);
          },
      
          discardItem: (index) => {
              if (!PlayerData.inventory || !PlayerData.inventory[index]) return;

              let item = PlayerData.inventory[index];
              
              let shardReward = 5;
              if (item.rarity === 'Legendary') shardReward = 50;
              else if (item.rarity === 'Epic') shardReward = 20;
              else if (item.rarity === 'Rare') shardReward = 10;

              PlayerData.inventory.splice(index, 1);
              PlayerData.shards += shardReward;

              UI.renderInventory();
              UI.updateCurrencies();
              UI.notify(`Discarded ${item.name} (+${shardReward} 💎)`);

              if (REFS.itemDetailPanel) REFS.itemDetailPanel.style.display = 'none';

              saveGame();
          },

          upgradeGear: (type) => {
              let gear = PlayerData.gear[type];
              if (!gear) return;
              
              let stats = gear.stats || gear; 
              let itemLevel = gear.level || 1;
              let shardCost = itemLevel * 10;
              let goldCost = itemLevel * 500; // NEW: Gold cost scales with level
              
              if (PlayerData.shards >= shardCost && PlayerData.gold >= goldCost) {
                  PlayerData.shards -= shardCost;
                  PlayerData.gold -= goldCost; // NEW: Spend Gold
                  gear.level = itemLevel + 1;

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
              } else {
                  UI.notify("Not enough Gold or Shards!");
              }
          },

          showDelta: (title, lines) => {
              const iconMap = { 'Max HP': '❤️', 'Attack': '⚔️', 'Defense': '🛡️', 'Regen': '🍏', 'Crit %': '🎯', 'Crit X': '💥', 'Atk Spd': '⚡' };
              let badgeText = title.toLowerCase().includes("level") ? "PROMOTED" : "EQUIPMENT",
                  badgeColor = title.toLowerCase().includes("level") ? "var(--primary)" : "var(--shard)";

              REFS.deltaTitle.innerHTML = `<div class="level-badge" style="background:${badgeColor}">${badgeText}</div> ${title}`;
              let html = '';
              lines.forEach(line => {
                  let diffValue = line.diff % 1 !== 0 ? line.diff.toFixed(2) : line.diff,
                      changeColor = line.diff > 0 ? '#4caf50' : '#ff5252',
                      symbol = line.diff > 0 ? '+' : '';
                  html += `<div class="delta-row"><span class="delta-icon">${iconMap[line.label] || '✨'}</span><span class="delta-label">${line.label}</span><span class="delta-values">${line.oldVal.toFixed(1)} ➔ ${line.newVal.toFixed(1)}</span><span class="delta-change" style="color:${changeColor}">${symbol}${diffValue}</span></div>`;
              });
              REFS.deltaContent.innerHTML = html;
              REFS.deltaPopup.style.display = 'block';
              setTimeout(() => { REFS.deltaPopup.style.opacity = 1; REFS.deltaPopup.style.transform = "translate(-50%, 0) scale(1)"; }, 10);
              if (UI._deltaTimeout) clearTimeout(UI._deltaTimeout);
              UI._deltaTimeout = setTimeout(() => { REFS.deltaPopup.style.opacity = 0; }, 5000);
          },

          notify: (msg) => {
              REFS.notification.innerText = msg;
              REFS.notification.style.opacity = 1;
              if (UI._notifTimeout) clearTimeout(UI._notifTimeout);
              UI._notifTimeout = setTimeout(() => REFS.notification.style.opacity = 0, 2000);
          },
          
          checkDailyLogin: () => {
              if (localStorage.getItem('dof_lastLogin') !== new Date().toDateString()) REFS.dailyLogin.style.display = 'block';
          },
          
          claimDaily: () => {
              PlayerData.gold += 500; PlayerData.shards += 50;
              localStorage.setItem('dof_lastLogin', new Date().toDateString());
              REFS.dailyLogin.style.display = 'none';
              UI.updateCurrencies(); saveGame(); UI.notify("Daily Claimed!");
          }
      };

// --- STARTUP VALIDATION ---
Object.entries(REFS).forEach(([key, el]) => { if (!el && key !== 'cooldowns') console.error(`CRITICAL: DOM Reference '${key}' is null. Check index.html IDs.`); });

REFS.canvas.width = window.innerWidth;
REFS.canvas.height = window.innerHeight;
window.addEventListener('resize', () => { REFS.canvas.width = window.innerWidth; REFS.canvas.height = window.innerHeight; });

// Persistent Data
let PlayerData = {
    gold: 0, shards: 0, level: 1, dungeonLevel: 1, xp: 0, maxXp: 100, inventory: [],
    gear: {
        'Weapon':   { level: 1, atk: 2, critMult: 0.05, rarity: 'Common' },
        'Armor':    { level: 1, hp: 1, def: 1, rarity: 'Common' },
        'Legs':     { level: 1, def: 2, hp: 2, rarity: 'Common' },
        'Fists':    { level: 1, critChance: 0.5, atk: 5, rarity: 'Common' },
        'Head':     { level: 1, hp: 3, def: 2, rarity: 'Common' },
        'Robe':     { level: 1, regen: 0.01, hp: 2, rarity: 'Common' },
        'Ring':     { level: 1, atk: 1, critChance: 1.5, rarity: 'Common' },
        'Earrings': { level: 1, critMult: 0.02, regen: 0.02, rarity: 'Common' },
        'Necklace': { level: 1, regen: 0.5, hp: 2, rarity: 'Common' },
        'Boots':    { level: 1, def: 1, atkSpeed: 0.01, rarity: 'Common' } 
    }
};

let mapGrid = [], exploredGrid = [], entities = [], particles = [], floatingTexts = [], portal = null, player = null;

function generateMap() {
    mapGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(1));
    exploredGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(false));
    let x = Math.floor(MAP_SIZE/2), y = Math.floor(MAP_SIZE/2), floorCount = 0, maxFloors = (MAP_SIZE*MAP_SIZE)*0.4;
    for(let i=-2; i<=2; i++) for(let j=-2; j<=2; j++) mapGrid[y+i][x+j] = 0;
    while (floorCount < maxFloors) {
        let dir = randomInt(0, 3);
        if (dir === 0 && y > 2) y--; else if (dir === 1 && y < MAP_SIZE-3) y++; else if (dir === 2 && x > 2) x--; else if (dir === 3 && x < MAP_SIZE-3) x++;
        if (mapGrid[y][x] === 1) { mapGrid[y][x] = 0; if(Math.random() > 0.5) mapGrid[y+1][x] = 0; floorCount++; }
    }
    portal = { x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, radius: 30 };
}

function isWall(x, y) {
    let col = Math.floor(x / TILE_SIZE), row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= MAP_SIZE || col < 0 || col >= MAP_SIZE) return true;
    return mapGrid[row][col] === 1;
}

function spawnFloatingText(x, y, text, color) { floatingTexts.push(new FloatingText(x, y, text, color)); }
function spawnLoot(x, y, type) { entities.push(new Loot(x, y, type)); }

class Projectile {
    constructor(x, y, target, speed, damage, isCrit) {
        this.x = x; this.y = y; this.target = target; this.speed = speed; this.damage = damage; this.isCrit = isCrit;
        this.color = isCrit ? '#ffeb3b' : '#bb86fc'; this.radius = isCrit ? 8 : 5; this.lifetime = 3.0; this.currentLifetime = 0; this.isAlive = true; 
    }
    update(dt) {
        if (!this.isAlive) return;
        this.currentLifetime += dt;
        if (this.currentLifetime >= this.lifetime) { this.isAlive = false; return; }
        if (this.target && this.target.hp > 0) {
            let dx = this.target.x - this.x, dy = this.target.y - this.y, angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed * dt; this.y += Math.sin(angle) * this.speed * dt;
            if (Math.hypot(dx, dy) < this.radius + this.target.radius) { this.target.takeDamage(this.damage, this.isCrit); this.isAlive = false; spawnAura(this.x, this.y); }
        } else { this.isAlive = false; }
    }
    draw(ctx) {
        if (!this.isAlive) return;
        ctx.save(); ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

function spawnProjectile(x1, y1, target, damage, isCrit) {
    if (!player) return;
    entities.push(new Projectile(x1, y1, target, 600, damage, isCrit));
}

function spawnAura(x, y) { for(let i=0; i<20; i++) particles.push(new Particle(x, y, '#ff9800')); }

function gainXp(amt) {
    PlayerData.xp += amt;
    if (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        let oldStats = { hp: player.getMaxHp(), atk: player.getAttackPower(), def: player.getDefense(), regen: player.getRegen(), critChance: player.getCritChance(), critMult: player.getCritMultiplier(), atkSpeed: player.getAttackSpeedFactor() },
            oldLevel = PlayerData.level;
        PlayerData.level++; PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.5);
        let newStats = { hp: player.getMaxHp(), atk: player.getAttackPower(), def: player.getDefense(), regen: player.getRegen(), critChance: player.getCritChance(), critMult: player.getCritMultiplier(), atkSpeed: player.getAttackSpeedFactor() };
        player.hp = newStats.hp;
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
        let deltaLines = [];
        if (Math.floor(oldStats.hp) !== Math.floor(newStats.hp)) deltaLines.push({ label: 'Max HP', oldVal: oldStats.hp, newVal: newStats.hp, diff: newStats.hp - oldStats.hp });
        if (Math.floor(oldStats.atk) !== Math.floor(newStats.atk)) deltaLines.push({ label: 'Attack', oldVal: oldStats.atk, newVal: newStats.atk, diff: newStats.atk - oldStats.atk });
        UI.showDelta(`Level Up! (${oldLevel} ➔ ${PlayerData.level})`, deltaLines);
    }
    UI.updateStats(); saveGame();
}

function die() {
    GameState.state = 'DEAD'; PlayerData.gold = Math.floor(PlayerData.gold / 2); PlayerData.shards = Math.floor(PlayerData.shards / 2);
    UI.notify("YOU DIED. Wealth halved."); GameState.level = 1; saveGame();
    setTimeout(() => { initLevel(); GameState.state = 'PLAYING'; }, 2000);
}

function levelUpDungeon() { GameState.pendingLevelUp = true; }

function spawnEnemies() {
    let numEnemies = 5 + Math.floor(GameState.level * 1.5);
    for(let i=0; i<numEnemies; i++) {
        let ex, ey;
        do { ex = randomInt(2, MAP_SIZE-3) * TILE_SIZE; ey = randomInt(2, MAP_SIZE-3) * TILE_SIZE; } while (isWall(ex, ey) || Math.hypot(ex - player.x, ey - player.y) < 300);
        entities.push(new Enemy(ex, ey));
    }
}

function initLevel() {
    generateMap(); entities = []; particles = []; floatingTexts = [];
    let startX = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2, startY = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    if(!player) player = new Player(startX, startY); else { player.x = startX; player.y = startY; }
    entities.push(player); spawnEnemies(); REFS.depthLevel.innerText = GameState.level; UI.updateMinimap();
}

// --- INPUT BINDINGS ---
let jZoneRef = document.getElementById('joystick-zone');
if (jZoneRef) {
    jZoneRef.addEventListener('touchstart', (e) => {
        if(GameState.state !== 'PLAYING') return;
        let touch = e.changedTouches[0], jBase = document.getElementById('j-base');
        Input.joystick.active = true; Input.joystick.x = touch.clientX; Input.joystick.y = touch.clientY;
        if (jBase) { jBase.style.display = 'block'; jBase.style.left = touch.clientX + 'px'; jBase.style.top = touch.clientY + 'px'; }
    });
    jZoneRef.addEventListener('touchmove', (e) => {
        if(!Input.joystick.active) return;
        let touch = e.changedTouches[0], dx = touch.clientX - Input.joystick.x, dy = touch.clientY - Input.joystick.y;
        Input.joystick.angle = Math.atan2(dy, dx);
        let dist = Math.min(50, Math.hypot(dx, dy)), sx = Math.cos(Input.joystick.angle) * dist, sy = Math.sin(Input.joystick.angle) * dist, jStick = document.getElementById('j-stick');
        if (jStick) jStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
    });
    jZoneRef.addEventListener('touchend', endJoystick);
}

function saveGame() { PlayerData.dungeonLevel = GameState.level; localStorage.setItem('dof_save', JSON.stringify(PlayerData)); }

function loadGame() {
    let save = localStorage.getItem('dof_save');
    if (save) {
        try {
            let data = JSON.parse(save); PlayerData = { ...PlayerData, ...data };
            if (data.gear) PlayerData.gear = { ...PlayerData.gear, ...data.gear };
            if (data.inventory) PlayerData.inventory = data.inventory;
            if (PlayerData.dungeonLevel) GameState.level = PlayerData.dungeonLevel;
        } catch(e) { console.error("Save Corrupted", e); }
    }
}

function drawMap(camX, camY) {
    let startCol = Math.max(0, Math.floor(camX / TILE_SIZE)),
        endCol = Math.min(MAP_SIZE - 1, startCol + Math.ceil(REFS.canvas.width / TILE_SIZE) + 1),
        startRow = Math.max(0, Math.floor(camY / TILE_SIZE)),
        endRow = Math.min(MAP_SIZE - 1, startRow + Math.ceil(REFS.canvas.height / TILE_SIZE) + 1);
    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            let isExplored = exploredGrid[r][c], screenX = c * TILE_SIZE - camX, screenY = r * TILE_SIZE - camY;
            if (!isExplored) { ctx.fillStyle = '#000'; ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE); continue; }
            if (mapGrid[r][c] === 1) { ctx.fillStyle = '#1e1e1e'; ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = '#2a2a2a'; ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE); }
            else { ctx.fillStyle = '#161616'; ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(screenX + TILE_SIZE/4, screenY + TILE_SIZE/4, TILE_SIZE/2, TILE_SIZE/2); }
        }
    }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height);
    if (GameState.state !== 'PLAYING' && GameState.state !== 'DEAD') return;
    let camX = Math.max(0, Math.min(player.x - REFS.canvas.width / 2, MAP_SIZE * TILE_SIZE - REFS.canvas.width)),
        camY = Math.max(0, Math.min(player.y - REFS.canvas.height / 2, MAP_SIZE * TILE_SIZE - REFS.canvas.height));
    ctx.save(); drawMap(camX, camY); ctx.translate(-camX, -camY);
    if (portal) {
        let pRow = Math.floor(portal.y/TILE_SIZE), pCol = Math.floor(portal.x/TILE_SIZE);
        if (exploredGrid[pRow] && exploredGrid[pRow][pCol]) {
            ctx.shadowBlur = Math.abs(Math.sin(Date.now()/500)) * 20; ctx.shadowColor = '#00e5ff'; ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
    }
    entities.sort((a, b) => a.y - b.y).forEach(e => { if (e.draw) e.draw(ctx); });
    particles.forEach(p => p.draw(ctx)); floatingTexts.forEach(ft => ft.draw(ctx));
    ctx.restore();
    if (GameState.state === 'DEAD') { ctx.fillStyle = 'rgba(100, 0, 0, 0.4)'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("YOU HAVE FALLEN", REFS.canvas.width/2, REFS.canvas.height/2); }
}

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

        if (GameState.frame % 10 === 0) {
            UI.updateStats();
        }

        if (GameState.frame % 120 === 0) {
            let enemyCount = 0;
            for (let i = 0; i < entities.length; i++) {
                if (entities[i] instanceof Enemy) enemyCount++;
            }
            
            if (enemyCount < 10 + GameState.level) {
                spawnEnemies();
            }
        }

        if (GameState.frame % 30 === 0) {
            UI.updateMinimap();
        }

        if (portal) {
            let distToPortal = Math.hypot(player.x - portal.x, player.y - portal.y);
            let unlockCost = GameState.level * 1000;

            if (distToPortal < 50) {
                REFS.portalUI.style.display = 'block';
                REFS.portalCost.innerText = `Unlock Cost: ${unlockCost} Gold`;
                REFS.unlockBtn.onclick = () => {
                    if (PlayerData.gold >= unlockCost) {
                        PlayerData.gold -= unlockCost;
                        UI.notify("Seal Broken! Descending...");
                        levelUpDungeon(); 
                        REFS.portalUI.style.display = 'none';
                    } else {
                        UI.notify("Need more gold to break the seal!");
                    }
                };
            } else {
                REFS.portalUI.style.display = 'none';
            }
        }
    }

    draw();
    GameState.frame++;
    requestAnimationFrame(loop);
}

window.onload = () => {
    loadGame(); let progress = 0;
    let bootInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100; clearInterval(bootInterval);
            setTimeout(() => { REFS.loadingScreen.classList.add('hidden'); REFS.mainMenu.classList.remove('hidden'); GameState.state = 'MENU'; }, 400);
        }
        REFS.loadingFill.style.width = progress + '%';
    }, 80);
};

REFS.playBtn.addEventListener('click', () => {
    REFS.mainMenu.classList.add('hidden'); REFS.uiLayer.classList.remove('hidden');
    initLevel(); UI.updateCurrencies(); UI.checkDailyLogin();
    GameState.state = 'PLAYING'; GameState.lastTime = performance.now(); requestAnimationFrame(loop);
});

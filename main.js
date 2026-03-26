/**
 * main.js
 * Core engine and system managers.
 */

// --- 1. CORE CONFIGURATION ---
const TILE_SIZE = 64;
const MAP_SIZE = 42;
const GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'];

// --- 2. THE REGISTRY (Centralized DOM references) ---
const REFS = {
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
};

// --- 3. ENGINE GLOBALS (Attached to window for E2E testing) ---
const ctx = REFS.canvas ? REFS.canvas.getContext('2d') : null;

window.GameState = {
    state: 'BOOT', 
    level: 1,
    camera: { x: 0, y: 0 },
    lastTime: 0,
    frame: 0,
    pendingLevelUp: false
};

window.Input = {
    joystick: { active: false, angle: 0, x:0, y:0 },
    dashPressed: false
};

// --- In main.js ---
window.PlayerData = {
    gold: 750, shards: 100, level: 1, dungeonLevel: 1, xp: 0, maxXp: 100, inventory: [],
    gear: {
        'Weapon':   { level: 1, atk: 25, critMult: 0.20, rarity: 'Common' },
        'Armor':    { level: 1, hp: 60, def: 15, rarity: 'Common' },
        'Legs':     { level: 1, def: 12, hp: 40, rarity: 'Common' },
        'Fists':    { level: 1, critChance: 5.0, atk: 15, rarity: 'Common' },
        'Head':     { level: 1, hp: 30, def: 10, rarity: 'Common' },
        'Robe':     { level: 1, regen: 1.5, hp: 20, rarity: 'Common' },
        'Ring':     { level: 1, atk: 12, critChance: 4.5, rarity: 'Common' },
        'Earrings': { level: 1, critMult: 0.15, regen: 0.8, rarity: 'Common' },
        'Necklace': { level: 1, regen: 2.0, hp: 25, rarity: 'Common' },
        'Boots':    { level: 1, def: 10, atkSpeed: 0.15, rarity: 'Common' } 
    }
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min);

const endJoystick = () => {
    Input.joystick.active = false;
    let jBase = document.getElementById('j-base');
    if (jBase) jBase.style.display = 'none';
};

// --- 4. UI SYSTEM ---
const UI = {
    updateStats: () => {
        if (!player) return;
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
        let mmCanvas = document.getElementById('minimap');
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
            // Call the globally accessible skill tree refresh function as per recent edits
            if (typeof refreshSkillTreeUI === 'function') {
                refreshSkillTreeUI();
            }
        }
    },
    
    renderInventory: () => {
        if (REFS.itemDetailPanel) REFS.itemDetailPanel.style.display = 'none';

        // 1. Stats Sheet
        if (REFS.statsSheet && player) {
            let html = `
                <div class="stat-line"><span>Max HP</span><span class="stat-val">${Math.floor(player.getMaxHp())}</span></div>
                <div class="stat-line"><span>Attack</span><span class="stat-val">${Math.floor(player.getAttackPower())}</span></div>
                <div class="stat-line"><span>Defense</span><span class="stat-val">${Math.floor(player.getDefense())}</span></div>
                <div class="stat-line"><span>Regen</span><span class="stat-val">${player.getRegen().toFixed(1)}/s</span></div>
                <div class="stat-line"><span>Atk Spd</span><span class="stat-val">${(1 / player.getAttackSpeedFactor()).toFixed(2)}/s</span></div>
                <div class="stat-line"><span>Crit %</span><span class="stat-val">${player.getCritChance().toFixed(1)}%</span></div>
                <div class="stat-line"><span>Crit X</span><span class="stat-val">${player.getCritMultiplier().toFixed(2)}x</span></div>
            `;
            // Dynamic Special Affixes
            let mag = player.getAffixValue('magnet'); if (mag > 0) html += `<div class="stat-line"><span>Magnet</span><span class="stat-val">+${mag}px</span></div>`;
            let grd = player.getAffixValue('greed'); if (grd > 0) html += `<div class="stat-line"><span>Gold Farmer</span><span class="stat-val">+${grd}%</span></div>`;
            let wis = player.getAffixValue('wisdom'); if (wis > 0) html += `<div class="stat-line"><span>XP Fiend</span><span class="stat-val">+${wis}%</span></div>`;
            let fear = player.getFearValue(); if (fear > 0) html += `<div class="stat-line"><span>Fear Aura</span><span class="stat-val">-${fear}% Enemy Def</span></div>`;
            REFS.statsSheet.innerHTML = html;
        }

        // 2. Equipped Gear Grid
        if (REFS.gearGrid) {
            REFS.gearGrid.innerHTML = '';
            GEAR_TYPES.forEach(type => {
                let gear = PlayerData.gear[type];
                if (!gear) return;
                let stats = gear.stats || gear, lvl = gear.level || 1, sCost = lvl * 10, gCost = lvl * 20;
                let canAfford = PlayerData.shards >= sCost && PlayerData.gold >= gCost;
                let statLines = [];
                let statMap = { atk:'Atk', hp:'HP', def:'Def', regen:'Reg', critChance:'Crit%', critMult:'CritX', atkSpeed:'Spd' };
                for (let [key, label] of Object.entries(statMap)) {
                    if (stats[key]) {
                        let val = stats[key], formattedVal = (val < 1 && val > 0) ? val.toFixed(2) : Math.floor(val);
                        statLines.push(`<span style="color:#03dac6">+${formattedVal}${label}</span>`);
                    }
                }
                if (gear.affix) statLines.push(`<span style="color:var(--rarity-legendary)">${gear.affix.label}</span>`);
                let div = document.createElement('div');
                div.className = 'gear-item';
                div.style.cssText = "cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; min-height:140px; padding:8px;";
                div.onclick = (e) => { if (e.target.tagName !== 'BUTTON') UI.inspectItem(type, false); };
                div.innerHTML = `
                    <div>
                        <h4 style="color:${gear.color || 'var(--primary)'}; font-size:0.8rem; line-height:1; margin-bottom:4px;">${gear.name || type}</h4>
                        <div style="font-size:0.65rem; display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-bottom:5px;">${statLines.join(' ')}</div>
                    </div>
                    <button class="upgrade-btn" ${canAfford ? '' : 'disabled'} style="font-size:0.65rem; padding:6px 2px; margin-top:auto;" onclick="UI.upgradeGear('${type}')">
                        Lv.${lvl} UP (${sCost}💎 / ${gCost}🪙)
                    </button>`;
                REFS.gearGrid.appendChild(div);
            });
        }

        // 3. Inventory Bag Grid
        if (REFS.bagGrid) {
            REFS.bagGrid.innerHTML = '';
            PlayerData.inventory.forEach((item, index) => {
                let div = document.createElement('div');
                div.className = 'gear-item';
                div.innerHTML = `<h4 style="color:${item.color || '#00e5ff'}; font-size:0.8rem;">${item.name || item.slot}</h4>
                                 <button class="upgrade-btn" style="background:#00e5ff; color:#000;" onclick="UI.inspectItem(${index}, true)">Inspect</button>`;
                REFS.bagGrid.appendChild(div);
            });
            if (PlayerData.inventory.length === 0) REFS.bagGrid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#777; font-size:0.8rem;">Bag is empty.</p>`;
        }
        UI.updateCurrencies();
    },

    inspectItem: (slotOrIndex, isBagItem) => {
        let item = isBagItem ? PlayerData.inventory[slotOrIndex] : PlayerData.gear[slotOrIndex];
        let equippedItem = isBagItem ? PlayerData.gear[item.slot] : item;
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
            
            // FIX: Restored the precision check so 0.04 doesn't round down to 0.0
            if (diff > 0) diffHtml = `<small style="color:#0f0">(+${diff % 1 !== 0 ? diff.toFixed(2) : diff})</small>`;
            else if (diff < 0) diffHtml = `<small style="color:#f00">(${diff % 1 !== 0 ? diff.toFixed(2) : diff})</small>`;
            
            let formatVal = (v) => v < 1 && v > 0 ? v.toFixed(2) : Math.floor(v);
            selectedHtml += `<p>${stat.toUpperCase()}: <span style="color:var(--shard)">${formatVal(val1)}</span></p>`;
            equippedHtml += `<p>${stat.toUpperCase()}: <span style="color:#aaa">${formatVal(val2)}</span> ${diffHtml}</p>`;
        });
        
        if (item.affix) selectedHtml += `<p style="color:var(--rarity-legendary); font-weight:bold; margin-top:5px;">★ ${item.affix.label}: +${item.affix.value}${item.affix.type === 'magnet' ? 'px' : '%'}</p>`;

        REFS.selectedStats.innerHTML = selectedHtml || '<p>No Stats</p>';
        REFS.equippedStats.innerHTML = equippedHtml || '<p>None</p>';

        if (isBagItem) {
            REFS.equipBtn.innerText = "Equip";
            REFS.equipBtn.onclick = () => { UI.equipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; };
            REFS.discardBtn.style.display = 'block';
            REFS.discardBtn.onclick = () => UI.discardItem(slotOrIndex);
        } else {
            REFS.equipBtn.innerText = "Unequip";
            REFS.equipBtn.onclick = () => { UI.unequipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; };
            REFS.discardBtn.style.display = 'none'; 
        }
    },

    equipItem: (index) => {
        if (!PlayerData.inventory[index]) return;
        let itemToEquip = PlayerData.inventory[index], slot = itemToEquip.slot;
        
        let oldStats = { 
            hp: player.getMaxHp(), atk: player.getAttackPower(), def: player.getDefense(), 
            regen: player.getRegen(), crit: player.getCritChance(), cx: player.getCritMultiplier(), 
            sp: 1 / player.getAttackSpeedFactor(), mag: player.getAffixValue('magnet'),
            grd: player.getAffixValue('greed'), wis: player.getAffixValue('wisdom'), fear: player.getFearValue()
        };
        
        PlayerData.inventory.splice(index, 1);
        let currentlyEquipped = PlayerData.gear[slot];
        if (currentlyEquipped && currentlyEquipped.id) PlayerData.inventory.push(currentlyEquipped);
        PlayerData.gear[slot] = itemToEquip;
        
        UI.renderInventory(); UI.updateStats();
        player.hp = Math.min(player.hp, player.getMaxHp());
        saveGame();

        let newStats = { 
            hp: player.getMaxHp(), atk: player.getAttackPower(), def: player.getDefense(), 
            regen: player.getRegen(), crit: player.getCritChance(), cx: player.getCritMultiplier(), 
            sp: 1 / player.getAttackSpeedFactor(), mag: player.getAffixValue('magnet'),
            grd: player.getAffixValue('greed'), wis: player.getAffixValue('wisdom'), fear: player.getFearValue()
        };

        let deltas = [], keys = [
            {k:'hp',l:'Max HP'},{k:'atk',l:'Attack'},{k:'def',l:'Defense'},{k:'regen',l:'Regen'},
            {k:'crit',l:'Crit %'},{k:'cx',l:'Crit X'},{k:'sp',l:'Atk Spd'},
            {k:'mag',l:'Magnet'},{k:'grd',l:'Gold Farmer'},{k:'wis',l:'XP Fiend'},{k:'fear',l:'Fear Aura'}
        ];
        keys.forEach(s => { 
            let d = newStats[s.k]-oldStats[s.k]; 
            if(Math.abs(d)>0.001) deltas.push({label:s.l, oldVal:oldStats[s.k], newVal:newStats[s.k], diff:d}); 
        });
        if (deltas.length > 0) UI.showDelta(`Equipped: ${itemToEquip.name}`, deltas);
    },

    discardItem: (index) => {
        if (!PlayerData.inventory[index]) return;
        let item = PlayerData.inventory[index], reward = 5;
        if (item.rarity === 'Legendary') reward = 50; else if (item.rarity === 'Epic') reward = 20; else if (item.rarity === 'Rare') reward = 10;
        PlayerData.inventory.splice(index, 1); PlayerData.shards += reward;
        UI.renderInventory(); UI.updateCurrencies(); UI.notify(`Discarded ${item.name} (+${reward} 💎)`);
        REFS.itemDetailPanel.style.display = 'none'; saveGame();
    },

    upgradeGear: (type) => {
        let gear = PlayerData.gear[type]; if (!gear) return;
        let stats = gear.stats || gear, lvl = gear.level || 1, sCost = lvl * 10, gCost = lvl * 20;
        if (PlayerData.shards >= sCost && PlayerData.gold >= gCost) {
            PlayerData.shards -= sCost; PlayerData.gold -= gCost; gear.level = lvl + 1;
            if (stats.atk !== undefined) stats.atk += randomInt(3, 7);
            if (stats.hp !== undefined) stats.hp += randomInt(15, 30);
            if (stats.def !== undefined) stats.def += randomInt(2, 5);
            if (stats.regen !== undefined) stats.regen += 0.2;
            if (stats.critChance !== undefined) stats.critChance += 0.4;
            if (stats.critMult !== undefined) stats.critMult += 0.03;
            if (stats.atkSpeed !== undefined) stats.atkSpeed = Math.min(0.6, stats.atkSpeed + 0.01); 
            UI.renderInventory(); UI.updateStats(); saveGame(); UI.notify(`${type} Specialized!`);
        } else UI.notify("Need more Gold or Shards!");
    },

    showDelta: (title, lines) => {
        const iconMap = { 
            'Max HP': '•', 'Attack': '•', 'Defense': '•', 'Regen': '•', 
            'Crit %': '•', 'Crit X': '•', 'Atk Spd': '•',
            'Magnet': '•', 'Gold Farmer': '•', 'XP Fiend': '•', 'Fear Aura': '•'
        };
        let isLevel = title.toLowerCase().includes("level"), badgeText = isLevel ? "PROMOTED" : "EQUIPMENT", badgeColor = isLevel ? "var(--primary)" : "var(--shard)";
        REFS.deltaTitle.innerHTML = `<div class="level-badge" style="background:${badgeColor}">${badgeText}</div> ${title}`;
        let html = '';
        
        lines.forEach(line => {
            // 1. Identify if lower is better (only for Attack Speed/Cooldown)
            const isLowerBetter = line.label === 'Atk Spd';
            const improved = isLowerBetter ? line.diff < 0 : line.diff > 0;
            
            // 2. Dynamic precision: show 2 decimals for small values so progress is visible
            const valPrec = (line.oldVal < 5) ? 2 : 1; 
            const diffPrec = Math.abs(line.diff) < 0.1 ? 2 : 1;
            
            let diffStr = line.diff.toFixed(diffPrec);
            let cColor = improved ? '#4caf50' : '#ff5252';
            let symb = line.diff > 0 ? '+' : '';
        
            html += `
                <div class="delta-row">
                    <span class="delta-icon">${iconMap[line.label] || '✨'}</span>
                    <span class="delta-label">${line.label}</span>
                    <span class="delta-values">
                        <span style="color:#ff5252">${line.oldVal.toFixed(valPrec)}</span> 
                        <span style="color:#aaa; margin: 0 4px;">➔</span> 
                        <span style="color:#4caf50">${line.newVal.toFixed(valPrec)}</span>
                    </span>
                    <span class="delta-change" style="color:${cColor}">${symb}${diffStr}</span>
                </div>`;
        });

        REFS.deltaContent.innerHTML = html;
        REFS.deltaPopup.style.display = 'block';
        setTimeout(() => { 
            REFS.deltaPopup.style.opacity = 1; 
            // CHANGE THIS LINE: Remove the vertical translation so it stays at the bottom
            REFS.deltaPopup.style.transform = "translate(-50%, 0) scale(1)"; 
        }, 10);
        
        if (UI._deltaTimeout) clearTimeout(UI._deltaTimeout);
        UI._deltaTimeout = setTimeout(() => { REFS.deltaPopup.style.opacity = 0; }, 2000);
    },

    notify: (msg) => {
        REFS.notification.innerText = msg; REFS.notification.style.opacity = 1;
        if (UI._notifTimeout) clearTimeout(UI._notifTimeout);
        UI._notifTimeout = setTimeout(() => REFS.notification.style.opacity = 0, 2000);
    },
    
    checkDailyLogin: () => { if (localStorage.getItem('dof_lastLogin') !== new Date().toDateString()) REFS.dailyLogin.style.display = 'block'; },
    claimDaily: () => { PlayerData.gold += 500; PlayerData.shards += 50; localStorage.setItem('dof_lastLogin', new Date().toDateString()); REFS.dailyLogin.style.display = 'none'; UI.updateCurrencies(); saveGame(); UI.notify("Daily Claimed!"); }
};

// --- 5. MAP GENERATION ---
let mapGrid = [], exploredGrid = [], entities = [], particles = [], floatingTexts = [], portal = null, player = null;

function generateMap() {
    mapGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(1));
    exploredGrid = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(false));
    let x = Math.floor(MAP_SIZE / 2), y = Math.floor(MAP_SIZE / 2), floorCount = 0, maxFloors = (MAP_SIZE * MAP_SIZE) * 0.4;
    for(let i=-2; i<=2; i++) for(let j=-2; j<=2; j++) mapGrid[y+i][x+j] = 0;
    while (floorCount < maxFloors) {
        let dir = randomInt(0, 3);
        if (dir === 0 && y > 2) y--; else if (dir === 1 && y < MAP_SIZE - 3) y++;
        else if (dir === 2 && x > 2) x--; else if (dir === 3 && x < MAP_SIZE - 3) x++;
        if (mapGrid[y][x] === 1) { mapGrid[y][x] = 0; if(Math.random() > 0.5) mapGrid[y+1][x] = 0; floorCount++; }
    }
    portal = { x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, radius: 30 };
}

function isWall(x, y) {
    let col = Math.floor(x / TILE_SIZE), row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= MAP_SIZE || col < 0 || col >= MAP_SIZE) return true;
    return mapGrid[row][col] === 1;
}

// --- 6. ENGINE FUNCTIONS ---
function spawnFloatingText(x, y, text, color) { floatingTexts.push(new FloatingText(x, y, text, color)); }
function spawnLoot(x, y, type) { entities.push(new Loot(x, y, type)); }

class Projectile {
    constructor(x, y, target, speed, damage, isCrit, isEnemy = false) {
        this.x = x; this.y = y; this.target = target; this.speed = speed; this.damage = damage; 
        this.isCrit = isCrit; this.isEnemy = isEnemy;
        // Visuals: Red for enemies, Purple/Gold for player
        this.color = isEnemy ? '#ff3300' : (isCrit ? '#ffeb3b' : '#bb86fc'); 
        this.radius = isCrit ? 8 : 5; this.lifetime = 3.0; this.currentLifetime = 0; this.isAlive = true; 
    }
    update(dt) {
        if (!this.isAlive) return;
        this.currentLifetime += dt;
        if (this.currentLifetime >= this.lifetime) { this.isAlive = false; return; }
        
        // Target can be either player or enemy
        if (this.target && this.target.hp > 0) {
            let dx = this.target.x - this.x, dy = this.target.y - this.y, dist = Math.hypot(dx, dy);
            let angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed * dt; 
            this.y += Math.sin(angle) * this.speed * dt;
            
            if (dist < this.radius + this.target.radius) { 
                // Enemy projectiles don't need crit logic for now, or use damage directly
                this.target.takeDamage(this.damage, this.isCrit); 
                this.isAlive = false; 
                spawnAura(this.x, this.y, this.isEnemy ? '#ff3300' : '#ff9800'); 
            }
        } else { this.isAlive = false; }
    }
    draw(ctx) {
        if (!this.isAlive) return;
        ctx.save(); 
        if (this.isEnemy) { ctx.shadowBlur = 10; ctx.shadowColor = 'red'; }
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); 
        ctx.restore();
    }
}

function spawnProjectile(x1, y1, target, damage, isCrit, isEnemy = false) {
    if (!player) return;
    entities.push(new Projectile(x1, y1, target, 600, damage, isCrit, isEnemy));
}

function spawnAura(x, y, color = '#ff9800') { for(let i=0; i<20; i++) particles.push(new Particle(x, y, color)); }

function gainXp(amt) {
    PlayerData.xp += Math.floor(amt * player.getXpMultiplier());
    if (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        let oldStats = { 
            hp:player.getMaxHp(), atk:player.getAttackPower(), def:player.getDefense(), regen:player.getRegen(), 
            crit:player.getCritChance(), cx:player.getCritMultiplier(), sp:player.getAttackSpeedFactor(),
            mag:player.getAffixValue('magnet'), grd:player.getAffixValue('greed'), wis:player.getAffixValue('wisdom'), fear:player.getFearValue()
        }, oldLevel = PlayerData.level;
        PlayerData.level++; player.skillPoints++; PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.5);
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
        let newStats = { 
            hp:player.getMaxHp(), atk:player.getAttackPower(), def:player.getDefense(), regen:player.getRegen(), 
            crit:player.getCritChance(), cx:player.getCritMultiplier(), sp:player.getAttackSpeedFactor(),
            mag:player.getAffixValue('magnet'), grd:player.getAffixValue('greed'), wis:player.getAffixValue('wisdom'), fear:player.getFearValue()
        };
        let deltas = [], keys = [
            {k:'hp',l:'Max HP'},{k:'atk',l:'Attack'},{k:'def',l:'Defense'},{k:'regen',l:'Regen'},
            {k:'crit',l:'Crit %'},{k:'cx',l:'Crit X'},{k:'sp',l:'Atk Spd'},
            {k:'mag',l:'Magnet'},{k:'grd',l:'Gold Farmer'},{k:'wis',l:'XP Fiend'},{k:'fear',l:'Fear Aura'}
        ];
        keys.forEach(s => { let d = newStats[s.k]-oldStats[s.k]; if(Math.abs(d)>0.001) deltas.push({label:s.l, oldVal:oldStats[s.k], newVal:newStats[s.k], diff:d}); });
        UI.showDelta(`Level Up! (${oldLevel} ➔ ${PlayerData.level})`, deltas);
    }
    if (typeof refreshSkillTreeUI === 'function') {
            refreshSkillTreeUI();
        }
    }
    UI.updateStats();
    saveGame();
}

function die() {
    GameState.state = 'DEAD'; PlayerData.gold = Math.floor(PlayerData.gold / 2); PlayerData.shards = Math.floor(PlayerData.shards / 2);
    UI.notify("YOU DIED. Wealth halved."); GameState.level = 1; saveGame();
    setTimeout(() => { initLevel(); GameState.state = 'PLAYING'; }, 2000);
}

function levelUpDungeon() { GameState.pendingLevelUp = true; }

function spawnEnemies() {
    let num = 10 + GameState.level; 
    for(let i=0; i<num; i++) {
        let ex, ey;
        do { 
            ex = randomInt(2, MAP_SIZE-3) * TILE_SIZE; 
            ey = randomInt(2, MAP_SIZE-3) * TILE_SIZE; 
        } while (isWall(ex, ey) || Math.hypot(ex - player.x, ey - player.y) < 300);
        entities.push(new Enemy(ex, ey));
    }
}

function initLevel() {
    generateMap(); entities = []; particles = []; floatingTexts = [];
    let startX = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2, startY = Math.floor(MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    if(!player) player = new Player(startX, startY); else { player.x = startX; player.y = startY; }
    if (typeof initializeSkillTree === 'function') {
        initializeSkillTree();
    }
    entities.push(player); spawnEnemies(); REFS.depthLevel.innerText = GameState.level; UI.updateMinimap();
}

// --- 7. INPUT & SAVE ---
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
            let d = JSON.parse(save);
            if (d.gear && d.gear.Weapon && d.gear.Weapon.atk > 5) {
                 PlayerData = { ...PlayerData, ...d };
                 PlayerData.gear = { ...PlayerData.gear, ...d.gear };
            } else {
                 PlayerData.gold = d.gold || 0;
                 PlayerData.shards = d.shards || 0;
                 PlayerData.level = d.level || 1;
                 PlayerData.dungeonLevel = d.dungeonLevel || 1;
                 UI.notify("System Updated: Old gear discarded for new power gear.");
            }

            if (PlayerData.dungeonLevel) GameState.level = PlayerData.dungeonLevel;
        } catch(e) { console.error("Save Corrupt", e); }
    }
}

// --- 8. RENDERER ---
function drawMap(camX, camY) {
    let sCol = Math.max(0, Math.floor(camX / TILE_SIZE)), eCol = Math.min(MAP_SIZE - 1, sCol + Math.ceil(REFS.canvas.width / TILE_SIZE) + 1),
        sRow = Math.max(0, Math.floor(camY / TILE_SIZE)), eRow = Math.min(MAP_SIZE - 1, sRow + Math.ceil(REFS.canvas.height / TILE_SIZE) + 1);
    for (let r = sRow; r <= eRow; r++) {
        for (let c = sCol; c <= eCol; c++) {
            if (!exploredGrid[r][c]) { ctx.fillStyle = '#000'; ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE); continue; }
            ctx.fillStyle = mapGrid[r][c] === 1 ? '#1e1e1e' : '#161616';
            ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
        }
    }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height);
    if (GameState.state !== 'PLAYING' && GameState.state !== 'DEAD') return;
    let camX = Math.max(0, Math.min(player.x - REFS.canvas.width / 2, MAP_SIZE * TILE_SIZE - REFS.canvas.width)),
        camY = Math.max(0, Math.min(player.y - REFS.canvas.height / 2, MAP_SIZE * TILE_SIZE - REFS.canvas.height));
    ctx.save(); drawMap(camX, camY); ctx.translate(-camX, -camY);
    if (portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) { ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2); ctx.fill(); }
    entities.sort((a, b) => a.y - b.y).forEach(e => e.draw?.(ctx));
    particles.forEach(p => p.draw(ctx)); floatingTexts.forEach(ft => ft.draw(ctx)); ctx.restore();
    if (GameState.state === 'DEAD') { ctx.fillStyle = 'rgba(100, 0, 0, 0.4)'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("YOU HAVE FALLEN", REFS.canvas.width/2, REFS.canvas.height/2); }
}

// --- 9. MAIN LOOP ---
function loop(timestamp) {
    let dt = Math.min(0.1, (timestamp - GameState.lastTime) / 1000); GameState.lastTime = timestamp;
    if (GameState.state === 'PLAYING') {
        if (GameState.pendingLevelUp) { GameState.level++; UI.notify(`Depth ${GameState.level}`); initLevel(); GameState.pendingLevelUp = false; saveGame(); }
        HiveMind.update();
        for (let i = entities.length - 1; i >= 0; i--) entities[i].update(dt);
        for (let i = particles.length - 1; i >= 0; i--) particles[i].update(dt);
        for (let i = floatingTexts.length - 1; i >= 0; i--) floatingTexts[i].update(dt);
        if (GameState.frame % 10 === 0) UI.updateStats();
        if (GameState.frame % 120 === 0) { 
            let ec = 0; 
            for(let i=0; i<entities.length; i++) {
                if(entities[i] instanceof Enemy) ec++;
            }
            
            let maxEnemies = 5 + GameState.level;
            if (ec < maxEnemies) {
                let toSpawn = Math.min(2, maxEnemies - ec);
                for(let s=0; s < toSpawn; s++) {
                    let ex, ey;
                    do { 
                        ex = randomInt(2, MAP_SIZE-3) * TILE_SIZE; 
                        ey = randomInt(2, MAP_SIZE-3) * TILE_SIZE; 
                    } while (isWall(ex, ey) || Math.hypot(ex - player.x, ey - player.y) < 400);
                    entities.push(new Enemy(ex, ey));
                }
            }
        }
        if (GameState.frame % 30 === 0) UI.updateMinimap();
        if (portal) {
            let dist = Math.hypot(player.x - portal.x, player.y - portal.y), cost = GameState.level * 250;
            if (dist < 50) {
                REFS.portalUI.style.display = 'block'; REFS.portalCost.innerText = `Unlock Cost: ${cost} Gold`;
                REFS.unlockBtn.onclick = () => { if (PlayerData.gold >= cost) { PlayerData.gold -= cost; levelUpDungeon(); REFS.portalUI.style.display = 'none'; } else UI.notify("Need Gold!"); };
            } else REFS.portalUI.style.display = 'none';
        }
    }
    draw(); GameState.frame++; requestAnimationFrame(loop);
}

// --- 10. BOOTSTRAP ---
REFS.canvas.width = window.innerWidth; REFS.canvas.height = window.innerHeight;
window.addEventListener('resize', () => { REFS.canvas.width = window.innerWidth; REFS.canvas.height = window.innerHeight; });

window.onload = () => {
    loadGame(); let progress = 0;
    let bootInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) { progress = 100; clearInterval(bootInterval); setTimeout(() => { REFS.loadingScreen.classList.add('hidden'); REFS.mainMenu.classList.remove('hidden'); GameState.state = 'MENU'; }, 400); }
        REFS.loadingFill.style.width = progress + '%';
    }, 80);
};

REFS.playBtn.addEventListener('click', () => {
    REFS.mainMenu.classList.add('hidden'); REFS.uiLayer.classList.remove('hidden');
    initLevel(); UI.updateCurrencies(); UI.checkDailyLogin();
    GameState.state = 'PLAYING'; GameState.lastTime = performance.now(); requestAnimationFrame(loop);
});

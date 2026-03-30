/**
 * main.js
 * Core engine and system managers.
 */

// --- 1. CORE CONFIGURATION ---
const TILE_SIZE = 64;
window.MAP_SIZE = 60;       
window.VILLAGE_START = 45;  
const GEAR_TYPES = ['Weapon', 'Armor', 'Legs', 'Fists', 'Head', 'Robe', 'Ring', 'Earrings', 'Necklace', 'Boots'];

const ACTIVE_SKILLS_CONFIG = {
    5: { icon: '🛡️', cd: 14, name: 'Invincibility' },
    6: { icon: '🔥', cd: 9, name: 'Scorch' },
    7: { icon: '🌋', cd: 17, name: 'Heat Wave' },
    8: { icon: '👁️‍🗨️', cd: 8, name: 'Blink' },
    9: { icon: '💢', cd: 6, name: 'Rage' },
    10: { icon: '🌪️', cd: 12, name: 'Twister' },
    11: { icon: '👥', cd: 13, name: 'Summon' },
    12: { icon: '☄️', cd: 10, name: 'Rain Fire' },
    13: { icon: '🧘', cd: 12, name: 'Zen' },
    14: { icon: '💣', cd: 20, name: 'Pipe Bomb' },
    22: { icon: '❄️', cd: 15, name: 'Frost Nova' },
    23: { icon: '🗡️', cd: 10, name: 'Daggers' }
};

const BOUNTY_CONFIG = [
    { id: 'slayer_1', title: 'The Great Purge', type: 'kills', goal: 300, rewardGold: 5000, rewardShards: 500, rewardRelic: 'Weapon' },
    { id: 'depth_1', title: 'The Deepest Descents', type: 'depth', goal: 20, rewardGold: 25000, rewardShards: 2500, rewardFullSet: true }
];

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
    workbenchModal:   document.getElementById('workbench-modal'),
    bountyModal:      document.getElementById('bounty-modal'),
    skillAmpList:     document.getElementById('skill-amp-list'),
    bountyList:       document.getElementById('bounty-list'),
    // Boss REFS (We will add these to HTML next)
    bossModal:        document.getElementById('boss-modal'),
    bossTimerUI:      document.getElementById('boss-timer-ui'),
    bossTimerText:    document.getElementById('boss-timer-text'),
    leaveBossBtn:     document.getElementById('leave-boss-btn')
};

const ctx = REFS.canvas ? REFS.canvas.getContext('2d') : null;

window.GameState = {
    state: 'BOOT', 
    level: 1,
    camera: { x: 0, y: 0 },
    lastTime: 0,
    frame: 0,
    pendingLevelUp: false,
    activeInteractable: null,
    bossTimer: 0 // New Boss Timer
};

window.Input = { joystick: { active: false, angle: 0, x:0, y:0 }, dashPressed: false };

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
    },
    skillAmps: {},
    questLog: { totalKills: 0 },
    claimedBounties: [],
    activeBounties: [], // INFINITE PROCEDURAL BOUNTIES
    bossLevel: 1,       // INFINITE BOSS PROGRESSION
    lastPlayed: Date.now() 
};

// --- INFINITE QUEST GENERATOR ---
function generateProceduralBounty() {
    let pLvl = Math.max(1, PlayerData.level);
    let types = ['kills', 'gold_collect'];
    let type = types[randomInt(0, 1)];
    
    let goal, title, rewardG, rewardS;
    if (type === 'kills') {
        goal = randomInt(10, 50) * Math.ceil(pLvl / 2);
        title = `Exterminate ${goal} Monsters`;
        rewardG = goal * 25 * pLvl;
        rewardS = goal * 2;
    } else {
        goal = randomInt(500, 2000) * pLvl;
        title = `Hoard ${FormatNumber(goal)} Gold`;
        rewardG = 0; // Doesn't reward gold if it's a gold quest
        rewardS = Math.floor(goal / 100);
    }

    return {
        id: `proc_${Date.now()}_${randomInt(0,9999)}`,
        title: title,
        type: type,
        goal: goal,
        progress: 0,
        rewardGold: rewardG,
        rewardShards: rewardS,
        isProcedural: true
    };
}

window.FormatNumber = function(value) {
    if (value === 0 || value == null) return "0";
    if (Math.abs(value) < 1000) return (Math.floor(value * 100) / 100).toString();
    let isNegative = value < 0; value = Math.abs(value);
    let suffixIndex = Math.floor(Math.log10(value) / 3);
    let displayValue = value / Math.pow(10, suffixIndex * 3);
    let truncated = Math.floor(displayValue * 1000) / 1000;
    let numStr = truncated.toString();
    let suffix = "";
    if (suffixIndex === 1) suffix = "K";
    else if (suffixIndex === 2) suffix = "M";
    else if (suffixIndex >= 3) {
        let n = suffixIndex - 3;
        if (n <= 475253) {
            let s = "";
            while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
            suffix = s;
        } else {
            let adjustedN = n - 475254; let subS = "";
            while (adjustedN >= 0) { subS = String.fromCharCode((adjustedN % 26) + 65) + subS; adjustedN = Math.floor(adjustedN / 26) - 1; }
            suffix = "S" + subS; 
        }
    }
    return (isNegative ? "-" : "") + numStr + suffix;
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min);

const endJoystick = () => { Input.joystick.active = false; let jBase = document.getElementById('j-base'); if (jBase) jBase.style.display = 'none'; };

// --- 4. UI SYSTEM ---
const UI = {
    updateStats: () => {
        if (!player) return;
        REFS.pLevel.innerText = PlayerData.level;
        REFS.hpFill.style.width = `${Math.max(0, (player.hp / player.getMaxHp()) * 100)}%`;
        REFS.hpText.innerText = `${FormatNumber(player.hp)} / ${FormatNumber(player.getMaxHp())}`;
        REFS.xpFill.style.width = `${(PlayerData.xp / PlayerData.maxXp) * 100}%`;
        REFS.xpText.innerText = `${FormatNumber(PlayerData.xp)} / ${FormatNumber(PlayerData.maxXp)}`;
    },
    updateCurrencies: () => { REFS.cGold.innerText = FormatNumber(PlayerData.gold); REFS.cShard.innerText = FormatNumber(PlayerData.shards); },
    buildHotbar: () => {
        let hb = document.getElementById('hotbar'); if (!hb) return;
        hb.innerHTML = ''; let html = '';
        const baseSkills = [{ id: 0, key: 'Pot', icon: '💚' }, { id: 1, key: 'Atk', icon: '⚔️' }, { id: 2, key: 'Aura', icon: '🔥' }, { id: 3, key: 'Dash', icon: '⚡' }];
        baseSkills.forEach(s => { html += `<div class="slot"><div class="slot-key">${s.key}</div><span>${s.icon}</span><div class="cooldown-overlay" id="cd-base-${s.id}"></div></div>`; });
        if (player && player.learnedSkills) {
            player.learnedSkills.forEach(id => {
                if (ACTIVE_SKILLS_CONFIG[id]) html += `<div class="slot ext-slot"><span>${ACTIVE_SKILLS_CONFIG[id].icon}</span><div class="cooldown-overlay" id="cd-ext-${id}"></div></div>`;
            });
        }
        hb.innerHTML = html;
    },
    updateHotbar: () => {
        if (!player) return;
        player.skills.forEach((s, i) => { let el = document.getElementById(`cd-base-${i}`); if (el) el.style.height = `${(s.current / s.cdMax) * 100}%`; });
        player.learnedSkills.forEach(id => {
            let el = document.getElementById(`cd-ext-${id}`);
            if (el && ACTIVE_SKILLS_CONFIG[id]) {
                let current = player.skillCooldowns[id] || 0; let maxCd = ACTIVE_SKILLS_CONFIG[id].cd;
                el.style.height = `${(current / maxCd) * 100}%`;
            }
        });
    },
    updateMinimap: () => {
        let mmCanvas = document.getElementById('minimap'); if (!mmCanvas) return;
        let mmCtx = mmCanvas.getContext('2d'); mmCtx.clearRect(0,0,100,100); let cellW = 100 / window.MAP_SIZE;
        for(let r=0; r<window.MAP_SIZE; r++){
            for(let c=0; c<window.MAP_SIZE; c++){
                if(exploredGrid[r][c]) {
                    if (r >= window.VILLAGE_START) mmCtx.fillStyle = mapGrid[r][c] === 1 ? '#1a252c' : '#2c3e50'; 
                    else mmCtx.fillStyle = mapGrid[r][c] === 1 ? '#333' : '#777'; 
                    mmCtx.fillRect(c*cellW, r*cellW, cellW, cellW);
                }
            }
        }
        mmCtx.fillStyle = '#bb86fc'; mmCtx.fillRect((player.x/TILE_SIZE)*cellW, (player.y/TILE_SIZE)*cellW, cellW, cellW);
        if(portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)]) {
            mmCtx.fillStyle = '#00e5ff'; mmCtx.fillRect((portal.x/TILE_SIZE)*cellW, (portal.y/TILE_SIZE)*cellW, cellW, cellW);
        }
    },
    toggleInventory: () => {
        if (REFS.invModal.style.display === 'flex') REFS.invModal.style.display = 'none';
        else { REFS.invModal.style.display = 'flex'; UI.renderInventory(); if (typeof refreshSkillTreeUI === 'function') refreshSkillTreeUI(); }
    },
    renderInventory: () => {
        if (REFS.itemDetailPanel) REFS.itemDetailPanel.style.display = 'none';
        if (REFS.statsSheet && player) {
            let baseStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { hp: player.getMaxHp(), atk: player.getAttackPower(), def: player.getDefense(), regen: player.getRegen(), cx: player.getCritMultiplier(), crit: player.getCritChance(), sp: 1 / player.getAttackSpeedFactor(), mag: player.getAffixValue('magnet'), grd: player.getAffixValue('greed'), wis: player.getAffixValue('wisdom'), fear: player.getFearValue(), cp: player.getCombatPower() };
            let html = `
                <div class="stat-line"><span>Max HP</span><span class="stat-val">${FormatNumber(baseStats.hp)}</span></div>
                <div class="stat-line"><span>Attack</span><span class="stat-val">${FormatNumber(baseStats.atk)}</span></div>
                <div class="stat-line"><span>Defense</span><span class="stat-val">${FormatNumber(baseStats.def)}</span></div>
                <div class="stat-line"><span>Regen</span><span class="stat-val">${FormatNumber(baseStats.regen)}/s</span></div>
                <div class="stat-line"><span>Atk Spd</span><span class="stat-val">${FormatNumber(baseStats.sp)}/s</span></div>
                <div class="stat-line"><span>Crit %</span><span class="stat-val">${FormatNumber(baseStats.crit)}%</span></div>
                <div class="stat-line"><span>Crit X</span><span class="stat-val">${FormatNumber(baseStats.cx)}x</span></div>
            `;
            if (baseStats.mag > 0) html += `<div class="stat-line"><span>Magnet</span><span class="stat-val">+${FormatNumber(baseStats.mag)}px</span></div>`;
            if (baseStats.grd > 0) html += `<div class="stat-line"><span>Gold Farmer</span><span class="stat-val">+${FormatNumber(baseStats.grd)}%</span></div>`;
            if (baseStats.wis > 0) html += `<div class="stat-line"><span>XP Fiend</span><span class="stat-val">+${FormatNumber(baseStats.wis)}%</span></div>`;
            if (baseStats.fear > 0) html += `<div class="stat-line"><span>Fear Aura</span><span class="stat-val">-${FormatNumber(baseStats.fear)}% Enemy Def</span></div>`;
            let cpValue = FormatNumber(baseStats.cp);
            html += `<div style="grid-column: 1 / -1; margin-top: 15px; border-top: 1px solid #444; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;"><span style="font-size: 1.5rem; font-weight: 900; color: #4caf50;">CP</span><span style="font-size: 1.5rem; font-weight: 900; color: #4caf50;">${cpValue}</span></div>`;
            REFS.statsSheet.innerHTML = html;
        }
        if (REFS.gearGrid) {
            REFS.gearGrid.innerHTML = '';
            GEAR_TYPES.forEach(type => {
                let gear = PlayerData.gear[type]; if (!gear) return;
                let stats = gear.stats || gear, lvl = gear.level || 1, sCost = lvl * 10, gCost = lvl * 20;
                let canAfford = PlayerData.shards >= sCost && PlayerData.gold >= gCost; let statLines = [];
                let statMap = { atk:'Atk', hp:'HP', def:'Def', regen:'Reg', critChance:'Crit%', critMult:'CritX', atkSpeed:'Spd' };
                for (let [key, label] of Object.entries(statMap)) { if (stats[key]) statLines.push(`<span style="color:#03dac6">+${FormatNumber(stats[key])}${label}</span>`); }
                if (gear.affix) statLines.push(`<span style="color:var(--rarity-legendary)">${gear.affix.label}</span>`);
                let div = document.createElement('div'); div.className = 'gear-item';
                div.style.cssText = "cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; min-height:140px; padding:8px;";
                div.onclick = (e) => { if (e.target.tagName !== 'BUTTON') UI.inspectItem(type, false); };
                div.innerHTML = `<div><h4 style="color:${gear.color || 'var(--primary)'}; font-size:0.8rem; line-height:1; margin-bottom:4px;">${gear.name || type}</h4><div style="font-size:0.65rem; display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-bottom:5px;">${statLines.join(' ')}</div></div><button class="upgrade-btn" ${canAfford ? '' : 'disabled'} style="font-size:0.65rem; padding:6px 2px; margin-top:auto;" onclick="UI.upgradeGear('${type}')">Lv.${lvl} UP (${FormatNumber(sCost)}💎 / ${FormatNumber(gCost)}🪙)</button>`;
                REFS.gearGrid.appendChild(div);
            });
        }
        if (REFS.bagGrid) {
            REFS.bagGrid.innerHTML = '';
            PlayerData.inventory.forEach((item, index) => {
                let div = document.createElement('div'); div.className = 'gear-item';
                div.innerHTML = `<h4 style="color:${item.color || '#00e5ff'}; font-size:0.8rem;">${item.name || item.slot}</h4><button class="upgrade-btn" style="background:#00e5ff; color:#000;" onclick="UI.inspectItem(${index}, true)">Inspect</button>`;
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
        REFS.itemDetailPanel.style.display = 'block'; REFS.detailName.innerText = item.name || slotOrIndex; REFS.detailName.style.color = item.color || 'var(--primary)'; REFS.detailRarity.innerText = item.rarity || 'Common'; REFS.detailRarity.style.color = item.color || '#fff';
        let statKeys = ['atk', 'hp', 'def', 'regen', 'critChance', 'critMult', 'atkSpeed'], selectedHtml = '', equippedHtml = '', itemStats = item.stats || item, eqStats = equippedItem ? (equippedItem.stats || equippedItem) : {};
        statKeys.forEach(stat => {
            let val1 = itemStats[stat] || 0, val2 = eqStats[stat] || 0; if (val1 === 0 && val2 === 0) return;
            let diff = val1 - val2, diffHtml = '';
            if (diff > 0) diffHtml = `<small style="color:#0f0">(+${FormatNumber(diff)})</small>`; else if (diff < 0) diffHtml = `<small style="color:#f00">(${FormatNumber(diff)})</small>`;
            selectedHtml += `<p>${stat.toUpperCase()}: <span style="color:var(--shard)">${FormatNumber(val1)}</span></p>`; equippedHtml += `<p>${stat.toUpperCase()}: <span style="color:#aaa">${FormatNumber(val2)}</span> ${diffHtml}</p>`;
        });
        if (item.affix) selectedHtml += `<p style="color:var(--rarity-legendary); font-weight:bold; margin-top:5px;">★ ${item.affix.label}: +${FormatNumber(item.affix.value)}${item.affix.type === 'magnet' ? 'px' : '%'}</p>`;
        REFS.selectedStats.innerHTML = selectedHtml || '<p>No Stats</p>'; REFS.equippedStats.innerHTML = equippedHtml || '<p>None</p>';
        if (isBagItem) { REFS.equipBtn.innerText = "Equip"; REFS.equipBtn.onclick = () => { UI.equipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; }; REFS.discardBtn.style.display = 'block'; REFS.discardBtn.onclick = () => UI.discardItem(slotOrIndex); } else { REFS.equipBtn.innerText = "Unequip"; REFS.equipBtn.onclick = () => { UI.unequipItem(slotOrIndex); REFS.itemDetailPanel.style.display = 'none'; }; REFS.discardBtn.style.display = 'none'; }
    },
    equipItem: (index) => {
        if (!PlayerData.inventory[index]) return; let itemToEquip = PlayerData.inventory[index], slot = itemToEquip.slot;
        let oldStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
        PlayerData.inventory.splice(index, 1); let currentlyEquipped = PlayerData.gear[slot]; if (currentlyEquipped && currentlyEquipped.id) PlayerData.inventory.push(currentlyEquipped); PlayerData.gear[slot] = itemToEquip;
        player.hp = Math.min(player.hp, player.getMaxHp()); UI.renderInventory(); UI.updateStats(); saveGame();
        let newStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
        let deltas = [], keys = [{k:'hp',l:'Max HP'},{k:'atk',l:'Attack'},{k:'def',l:'Defense'},{k:'regen',l:'Regen'},{k:'crit',l:'Crit %'},{k:'cx',l:'Crit X'},{k:'sp',l:'Atk Spd'},{k:'mag',l:'Magnet'},{k:'grd',l:'Gold Farmer'},{k:'wis',l:'XP Fiend'},{k:'fear',l:'Fear Aura'},{k:'cp',l:'cp'}];
        keys.forEach(s => { if(newStats[s.k] !== undefined && oldStats[s.k] !== undefined) { let d = newStats[s.k] - oldStats[s.k]; if(Math.abs(d) > 0.001 || s.k === 'cp') deltas.push({label:s.l, oldVal:oldStats[s.k], newVal:newStats[s.k], diff:d}); } });
        if (deltas.length > 0) UI.showDelta(`Equipped: ${itemToEquip.name}`, deltas);
    },
    discardItem: (index) => {
        if (!PlayerData.inventory[index]) return; let item = PlayerData.inventory[index], reward = 5;
        if (item.rarity === 'Legendary' || item.rarity === 'LEGENDARY RELIC') reward = 50; else if (item.rarity === 'Epic') reward = 20; else if (item.rarity === 'Rare') reward = 10;
        PlayerData.inventory.splice(index, 1); PlayerData.shards += reward;
        UI.renderInventory(); UI.updateCurrencies(); UI.notify(`Discarded ${item.name} (+${FormatNumber(reward)} 💎)`); REFS.itemDetailPanel.style.display = 'none'; saveGame();
    },
    unequipItem: (slot) => {
        let itemToUnequip = PlayerData.gear[slot]; if (!itemToUnequip) return; 
        let oldStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
        PlayerData.inventory.push(itemToUnequip); PlayerData.gear[slot] = null; 
        player.hp = Math.min(player.hp, player.getMaxHp()); UI.renderInventory(); UI.updateStats(); saveGame();
        let newStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
        let deltas = [], keys = [{k:'hp',l:'Max HP'},{k:'atk',l:'Attack'},{k:'def',l:'Defense'},{k:'regen',l:'Regen'},{k:'crit',l:'Crit %'},{k:'cx',l:'Crit X'},{k:'sp',l:'Atk Spd'},{k:'mag',l:'Magnet'},{k:'grd',l:'Gold Farmer'},{k:'wis',l:'XP Fiend'},{k:'fear',l:'Fear Aura'},{k:'cp',l:'cp'}];
        keys.forEach(s => { if(newStats[s.k] !== undefined && oldStats[s.k] !== undefined) { let d = newStats[s.k] - oldStats[s.k]; if(Math.abs(d) > 0.001 || s.k === 'cp') deltas.push({label:s.l, oldVal:oldStats[s.k], newVal:newStats[s.k], diff:d}); } });
        if (deltas.length > 0) UI.showDelta(`Unequipped: ${itemToUnequip.name || slot}`, deltas);
    },
    upgradeGear: (type) => {
        let gear = PlayerData.gear[type]; if (!gear) return;
        let stats = gear.stats || gear, lvl = gear.level || 1, sCost = lvl * 10, gCost = lvl * 20;
        if (PlayerData.shards >= sCost && PlayerData.gold >= gCost) {
            PlayerData.shards -= sCost; PlayerData.gold -= gCost; gear.level = lvl + 1;
            if (stats.atk !== undefined) stats.atk += randomInt(3, 7); if (stats.hp !== undefined) stats.hp += randomInt(15, 30); if (stats.def !== undefined) stats.def += randomInt(2, 5); if (stats.regen !== undefined) stats.regen += 0.2; if (stats.critChance !== undefined) stats.critChance += 0.4; if (stats.critMult !== undefined) stats.critMult += 0.03; if (stats.atkSpeed !== undefined) stats.atkSpeed = Math.min(0.6, stats.atkSpeed + 0.01); 
            UI.renderInventory(); UI.updateStats(); saveGame(); UI.notify(`${type} Specialized!`);
        } else UI.notify("Need more Gold or Shards!");
    },
    showDelta: (title, lines) => {
        const iconMap = { 'Max HP': '•', 'Attack': '•', 'Defense': '•', 'Regen': '•', 'Crit %': '•', 'Crit X': '•', 'Atk Spd': '•', 'Magnet': '•', 'Gold Farmer': '•', 'XP Fiend': '•', 'Fear Aura': '•' };
        let isLevel = title.toLowerCase().includes("level"), badgeText = isLevel ? "PROMOTED" : "EQUIPMENT", badgeColor = isLevel ? "var(--primary)" : "var(--shard)";
        let html = ''; let cpOld = lines.find(l => l.label === 'cp')?.oldVal || 0; let cpNew = lines.find(l => l.label === 'cp')?.newVal || 0; let statLines = lines.filter(l => l.label !== 'cp');
        REFS.deltaTitle.innerHTML = `<div class="level-badge" style="background:${badgeColor}">${badgeText}</div> ${title} <div style="color:#4caf50; font-size: 0.9rem; margin-top: 5px; text-transform: uppercase;">Combat Power: ${FormatNumber(cpNew)}</div>`;
        statLines.forEach(line => {
            let improved = line.diff > 0; if (line.label === 'Atk Spd') improved = line.diff < 0;
            let cColor = improved ? '#4caf50' : '#ff5252'; let diffValStr = FormatNumber(Math.abs(line.diff)); let symb = line.diff > 0 ? '+' : (line.diff < 0 ? '-' : '');
            html += `<div class="delta-row"><span class="delta-icon">${iconMap[line.label] || '✨'}</span><span class="delta-label">${line.label}</span><span class="delta-values"><span style="color:#ff5252">${FormatNumber(line.oldVal)}</span> <span style="color:#aaa; margin: 0 4px;">➔</span> <span style="color:#4caf50">${FormatNumber(line.newVal)}</span></span><span class="delta-change" style="color:${cColor}">${symb}${diffValStr}</span></div>`;
        });
        REFS.deltaContent.innerHTML = html; REFS.deltaPopup.style.display = 'block'; setTimeout(() => { REFS.deltaPopup.style.opacity = 1; REFS.deltaPopup.style.transform = "translate(-50%, 0) scale(1)"; }, 10);
        if (UI._deltaTimeout) clearTimeout(UI._deltaTimeout); UI._deltaTimeout = setTimeout(() => { REFS.deltaPopup.style.opacity = 0; }, 2000);
    },
    notify: (msg) => { REFS.notification.innerText = msg; REFS.notification.style.opacity = 1; if (UI._notifTimeout) clearTimeout(UI._notifTimeout); UI._notifTimeout = setTimeout(() => REFS.notification.style.opacity = 0, 2000); },
    
    checkDailyLogin: () => {
        let now = Date.now();
        let lastPlayed = PlayerData.lastPlayed || now;
        let elapsedSeconds = Math.floor((now - lastPlayed) / 1000);
        let cappedSeconds = Math.min(elapsedSeconds, 86400);

        let isNewDay = localStorage.getItem('dof_lastLoginDay') !== new Date().toDateString();
        let dailyGold = isNewDay ? 500 : 0; let dailyShards = isNewDay ? 50 : 0;

        if (cappedSeconds >= 60 || isNewDay) {
            let kills = Math.floor(cappedSeconds / 2);
            let offShards = Math.floor(cappedSeconds / 180) * 5; 
            let offGold = kills * (PlayerData.level * 5);
            let offXp = kills * (PlayerData.level * 2);

            UI._pendingOffline = { gold: offGold + dailyGold, shards: offShards + dailyShards, xp: offXp, kills: kills };

            let offTimeRef = document.getElementById('off-time'); if(offTimeRef) offTimeRef.innerText = Math.floor(cappedSeconds / 60) + "m";
            let offKillsRef = document.getElementById('off-kills'); if(offKillsRef) offKillsRef.innerText = FormatNumber(kills);
            let offGoldRef = document.getElementById('off-gold'); if(offGoldRef) offGoldRef.innerText = FormatNumber(UI._pendingOffline.gold);
            let offShardsRef = document.getElementById('off-shards'); if(offShardsRef) offShardsRef.innerText = FormatNumber(UI._pendingOffline.shards);
            let offXpRef = document.getElementById('off-xp'); if(offXpRef) offXpRef.innerText = FormatNumber(offXp);

            REFS.dailyLogin.style.display = 'block';
            if (isNewDay) localStorage.setItem('dof_lastLoginDay', new Date().toDateString());
        }
    },
    claimDaily: () => {
        if (UI._pendingOffline) {
            PlayerData.gold += UI._pendingOffline.gold; PlayerData.shards += UI._pendingOffline.shards;
            if (!PlayerData.questLog) PlayerData.questLog = { totalKills: 0 }; PlayerData.questLog.totalKills += UI._pendingOffline.kills;
            gainXp(UI._pendingOffline.xp); UI._pendingOffline = null;
        }
        PlayerData.lastPlayed = Date.now(); REFS.dailyLogin.style.display = 'none'; UI.updateCurrencies(); UI.updateStats(); saveGame(); UI.notify("Rewards Claimed!");
    },

    openWorkbench: () => { if (!REFS.workbenchModal) return; REFS.workbenchModal.style.display = 'flex'; UI.renderWorkbench(); },
    renderWorkbench: () => {
        if (!REFS.skillAmpList) return; let html = '';
        player.learnedSkills.forEach(id => {
            if (ACTIVE_SKILLS_CONFIG[id]) {
                let lvl = PlayerData.skillAmps[id] || 0; let cost = (lvl + 1) * 250; let canAfford = PlayerData.shards >= cost;
                html += `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;"><div><span style="font-size: 1.2rem; margin-right: 10px;">${ACTIVE_SKILLS_CONFIG[id].icon}</span><span style="font-weight: bold; color: var(--primary);">${ACTIVE_SKILLS_CONFIG[id].name}</span><div style="font-size: 0.7rem; color: #aaa;">Amp Level: ${lvl}</div></div><button class="upgrade-btn" style="width: auto; padding: 5px 15px;" ${canAfford ? '' : 'disabled'} onclick="UI.amplifySkill(${id}, ${cost})">AMPLIFY (${cost}💎)</button></div>`;
            }
        });
        if (player.learnedSkills.length === 0) html = '<p style="text-align:center; color:#777;">Learn skills in your talent tree first!</p>';
        REFS.skillAmpList.innerHTML = html;
    },
    amplifySkill: (id, cost) => { if (PlayerData.shards >= cost) { PlayerData.shards -= cost; PlayerData.skillAmps[id] = (PlayerData.skillAmps[id] || 0) + 1; UI.renderWorkbench(); UI.updateCurrencies(); UI.notify(`${ACTIVE_SKILLS_CONFIG[id].name} Amplified!`); saveGame(); } },
    autoCleanBag: () => {
        if (!player || PlayerData.inventory.length === 0) { UI.notify("Bag is already empty!"); return; }
        let itemsSwapped = 0; const slotGroups = {}; PlayerData.inventory.forEach(item => { if (!slotGroups[item.slot]) slotGroups[item.slot] = []; slotGroups[item.slot].push(item); });
        for (let slot in slotGroups) {
            slotGroups[slot].sort((a,b) => { let sumA = Object.values(a.stats || a).reduce((p,c) => typeof c === 'number' ? p+c : p, 0); let sumB = Object.values(b.stats || b).reduce((p,c) => typeof c === 'number' ? p+c : p, 0); return sumB - sumA; });
            let bestInBag = slotGroups[slot][0]; let currentlyEquipped = PlayerData.gear[slot]; let currentSum = currentlyEquipped ? Object.values(currentlyEquipped.stats || currentlyEquipped).reduce((p,c) => typeof c === 'number' ? p+c : p, 0) : 0; let bestSum = Object.values(bestInBag.stats || bestInBag).reduce((p,c) => typeof c === 'number' ? p+c : p, 0);
            if (bestSum > currentSum) { let idx = PlayerData.inventory.indexOf(bestInBag); UI.equipItem(idx); itemsSwapped++; }
        }
        let rewardTotal = 0; while (PlayerData.inventory.length > 0) { let item = PlayerData.inventory[0]; let reward = 5; if (item.rarity === 'Legendary' || item.rarity === 'LEGENDARY RELIC') reward = 50; else if (item.rarity === 'Epic') reward = 20; else if (item.rarity === 'Rare') reward = 10; rewardTotal += reward; PlayerData.inventory.splice(0, 1); }
        PlayerData.shards += rewardTotal; UI.notify(`Bag Cleaned! Found ${itemsSwapped} upgrades. Salvaged others for +${rewardTotal} 💎`); UI.updateCurrencies(); UI.renderInventory(); saveGame();
    },

    // --- PHASE 3: INFINITE BOUNTY BOARD ---
    renderBountyBoard: () => {
        if (!REFS.bountyList) return; 
        if (!PlayerData.questLog) PlayerData.questLog = { totalKills: 0 }; 
        if (!PlayerData.claimedBounties) PlayerData.claimedBounties = [];
        if (!PlayerData.activeBounties) PlayerData.activeBounties = [];

        // Make sure we always have 3 procedural bounties
        while (PlayerData.activeBounties.length < 3) {
            PlayerData.activeBounties.push(generateProceduralBounty());
        }

        let html = ''; 
        
        // 1. Render Static Milestones
        BOUNTY_CONFIG.forEach(b => {
            let isClaimed = PlayerData.claimedBounties.includes(b.id);
            if (isClaimed) return; // Hide completed static milestones
            
            let current = b.type === 'kills' ? PlayerData.questLog.totalKills : GameState.level; 
            let progress = Math.min(100, (current / b.goal) * 100); 
            let canClaim = progress >= 100;
            
            html += `<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid ${canClaim ? 'var(--gold)' : '#333'}; margin-bottom: 10px; position: relative;">
                <h4 style="color: var(--gold);">${b.title} <span style="font-size:0.6rem; background:red; color:white; padding:2px 4px; border-radius:4px;">MILESTONE</span></h4>
                <p style="font-size: 0.8rem; color: #aaa;">Goal: ${b.goal} ${b.type === 'kills' ? 'Kills' : 'Depth reached'}</p>
                <div style="width: 100%; height: 6px; background: #222; border-radius: 3px; margin: 10px 0; overflow: hidden;"><div style="width: ${progress}%; height: 100%; background: var(--gold);"></div></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: var(--shard);">${FormatNumber(current)} / ${FormatNumber(b.goal)}</span>
                    <button class="upgrade-btn" style="width: auto; padding: 5px 15px; background: var(--gold); color: black;" ${canClaim ? '' : 'disabled'} onclick="UI.claimBounty('${b.id}')">CLAIM REWARD</button>
                </div>
            </div>`;
        });

        // 2. Render Infinite Procedural Quests
        PlayerData.activeBounties.forEach(b => {
            let current = b.type === 'kills' ? PlayerData.questLog.totalKills - b.progress : PlayerData.gold - b.progress;
            // Hack to make gold quests track total earned since accepting, not current bank balance
            if (b.type === 'gold_collect' && b.progress === 0) b.progress = PlayerData.gold; 
            if (b.type === 'kills' && b.progress === 0) b.progress = PlayerData.questLog.totalKills;

            let trackedCurrent = b.type === 'kills' ? (PlayerData.questLog.totalKills - b.progress) : (PlayerData.gold - b.progress);
            trackedCurrent = Math.max(0, trackedCurrent); // Prevent negatives
            let progressPct = Math.min(100, (trackedCurrent / b.goal) * 100);
            let canClaim = progressPct >= 100;

            html += `<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid ${canClaim ? 'var(--shard)' : '#333'}; margin-bottom: 10px; position: relative;">
                <h4 style="color: var(--shard);">${b.title}</h4>
                <p style="font-size: 0.8rem; color: #aaa;">Reward: ${b.rewardGold > 0 ? FormatNumber(b.rewardGold) + ' Gold' : FormatNumber(b.rewardShards) + ' Shards'}</p>
                <div style="width: 100%; height: 6px; background: #222; border-radius: 3px; margin: 10px 0; overflow: hidden;"><div style="width: ${progressPct}%; height: 100%; background: var(--shard);"></div></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: var(--shard);">${FormatNumber(trackedCurrent)} / ${FormatNumber(b.goal)}</span>
                    <button class="upgrade-btn" style="width: auto; padding: 5px 15px; background: var(--shard); color: black;" ${canClaim ? '' : 'disabled'} onclick="UI.claimBounty('${b.id}')">CLAIM REWARD</button>
                </div>
            </div>`;
        });

        REFS.bountyList.innerHTML = html;
    },

    claimBounty: (id) => {
        // 1. Check if it's a static milestone
        let staticB = BOUNTY_CONFIG.find(x => x.id === id); 
        if (staticB) {
            PlayerData.gold += staticB.rewardGold; PlayerData.shards += staticB.rewardShards; PlayerData.claimedBounties.push(id);
            if (staticB.rewardRelic) { let godItem = generateRandomGear(GameState.level, true); PlayerData.inventory.push(godItem); UI.notify(`REWARD: 50X POWER ${godItem.name} FOUND!`); }
            if (staticB.rewardFullSet) { GEAR_TYPES.forEach(slot => { let godItem = generateRandomGear(GameState.level, true); godItem.slot = slot; godItem.name = `RELIC ${slot}`; PlayerData.inventory.push(godItem); }); UI.notify(`THE ASCENDED SET HAS BEEN GRANTED!`); }
        } else {
            // 2. Check if it's an infinite procedural quest
            let procIndex = PlayerData.activeBounties.findIndex(x => x.id === id);
            if (procIndex > -1) {
                let pB = PlayerData.activeBounties[procIndex];
                PlayerData.gold += pB.rewardGold; PlayerData.shards += pB.rewardShards;
                PlayerData.activeBounties.splice(procIndex, 1); // Remove completed
                PlayerData.activeBounties.push(generateProceduralBounty()); // Generate new one instantly
                UI.notify("Quest Completed!");
            }
        }
        UI.updateCurrencies(); UI.renderBountyBoard(); UI.renderInventory(); saveGame();
    },

    // --- PHASE 4: BOSS ARENA UI ---
    openBossMenu: () => {
        let bossLvl = PlayerData.bossLevel || 1;
        let cost = bossLvl * 1000;
        if (!REFS.bossModal) return;
        REFS.bossModal.innerHTML = `
            <div class="inv-header"><h2 style="color:#ff5252;">🩸 GLADIATOR ARENA</h2><button class="close-btn" onclick="document.getElementById('boss-modal').style.display='none'">X</button></div>
            <div class="modal-body" style="text-align:center;">
                <p>Face the Arena Champion to prove your worth.</p>
                <h3 style="color:#ff0000; font-size:2rem; margin:20px 0;">BOSS LEVEL ${bossLvl}</h3>
                <p style="color:#aaa; font-size:0.9rem;">Win to earn guaranteed Legendary loot.<br>Fail, and leave with nothing.</p>
                <p style="color:var(--gold); margin: 20px 0; font-weight:bold;">Entry Fee: ${FormatNumber(cost)} Gold</p>
                <button class="btn" style="background:#ff5252; color:white; border-color:#ff5252; width:100%;" onclick="startBossArena(${cost})">ENTER ARENA</button>
            </div>
        `;
        REFS.bossModal.style.display = 'flex';
    }
};

// --- 5. MAP & BOSS GENERATION ---
let mapGrid = [], exploredGrid = [], entities = [], particles = [], floatingTexts = [], portal = null, player = null;

function initEmptyMap() { mapGrid = Array(window.MAP_SIZE).fill(0).map(() => Array(window.MAP_SIZE).fill(1)); exploredGrid = Array(window.MAP_SIZE).fill(0).map(() => Array(window.MAP_SIZE).fill(false)); }

function generateVillage() {
    for (let r = window.VILLAGE_START; r < window.MAP_SIZE; r++) {
        for (let c = 0; c < window.MAP_SIZE; c++) {
            if (r === window.VILLAGE_START || r === window.MAP_SIZE - 1 || c === 0 || c === window.MAP_SIZE - 1) mapGrid[r][c] = 1;
            else { mapGrid[r][c] = 0; exploredGrid[r][c] = true; }
        }
    }
    let gateX = Math.floor(window.MAP_SIZE / 2);
    mapGrid[window.VILLAGE_START][gateX] = 0; mapGrid[window.VILLAGE_START][gateX - 1] = 0; mapGrid[window.VILLAGE_START][gateX + 1] = 0;
}

function generateDungeon() {
    for (let r = 0; r < window.VILLAGE_START; r++) { for (let c = 0; c < window.MAP_SIZE; c++) { mapGrid[r][c] = 1; exploredGrid[r][c] = false; } }
    let startX = Math.floor(window.MAP_SIZE / 2); let startY = window.VILLAGE_START - 1; let x = startX, y = startY;
    let floorCount = 0; let maxFloors = (window.MAP_SIZE * window.VILLAGE_START) * 0.45;
    mapGrid[y][x] = 0;
    while (floorCount < maxFloors) {
        let dir = randomInt(0, 3);
        if (dir === 0 && y > 2) y--; else if (dir === 1 && y < window.VILLAGE_START - 2) y++; else if (dir === 2 && x > 2) x--; else if (dir === 3 && x < window.MAP_SIZE - 3) x++;
        if (mapGrid[y][x] === 1) { mapGrid[y][x] = 0; if(Math.random() > 0.5 && mapGrid[y+1]) mapGrid[y+1][x] = 0; floorCount++; }
    }
    portal = { x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, radius: 30 };
}

function isWall(x, y) {
    let col = Math.floor(x / TILE_SIZE), row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= window.MAP_SIZE || col < 0 || col >= window.MAP_SIZE) return true;
    return mapGrid[row][col] === 1;
}

// --- BOSS STATE MACHINE ---
window.startBossArena = function(cost) {
    if (PlayerData.gold < cost) { UI.notify("Not enough Gold!"); return; }
    PlayerData.gold -= cost; UI.updateCurrencies();
    if (REFS.bossModal) REFS.bossModal.style.display = 'none';

    GameState.state = 'BOSS_ARENA';
    GameState.bossTimer = 75.0; // 75 SECONDS TO WIN
    if (REFS.bossTimerUI) REFS.bossTimerUI.style.display = 'block';

    initEmptyMap();
    let cx = Math.floor(window.MAP_SIZE / 2);
    let cy = Math.floor(window.MAP_SIZE / 2);

    // Carve circular arena
    for (let r = 0; r < window.MAP_SIZE; r++) {
        for (let c = 0; c < window.MAP_SIZE; c++) {
            if (Math.hypot(c - cx, r - cy) < 12) {
                mapGrid[r][c] = 0; 
                exploredGrid[r][c] = true;
            }
        }
    }

    entities = []; particles = []; floatingTexts = []; portal = null;
    
    player.x = cx * TILE_SIZE; 
    player.y = (cy + 8) * TILE_SIZE;
    player.hp = player.getMaxHp();
    entities.push(player);

    // Spawn Boss (We will define BossEnemy in entities.js)
    if (typeof BossEnemy !== 'undefined') {
        entities.push(new BossEnemy(cx * TILE_SIZE, (cy - 5) * TILE_SIZE, PlayerData.bossLevel || 1));
    }
};

window.failBossArena = function() {
    GameState.state = 'DEAD';
    if (REFS.bossTimerUI) REFS.bossTimerUI.style.display = 'none';
    UI.notify("TIME UP! YOU WERE DEFEATED.");
    setTimeout(() => { initLevel(false); GameState.state = 'PLAYING'; }, 2000);
};

window.winBossArena = function() {
    if (REFS.bossTimerUI) REFS.bossTimerUI.style.display = 'none';
    PlayerData.bossLevel = (PlayerData.bossLevel || 1) + 1;
    
    // Massive Loot
    let goldReward = (PlayerData.bossLevel * 5000);
    let shardReward = (PlayerData.bossLevel * 100);
    PlayerData.gold += goldReward;
    PlayerData.shards += shardReward;
    
    let bossLoot = generateRandomGear(GameState.level, true); // Force Legendary
    PlayerData.inventory.push(bossLoot);
    saveGame();

    // Show Victory Modal
    if (REFS.bossModal) {
        REFS.bossModal.innerHTML = `
            <div class="inv-header"><h2 style="color:#03dac6;">🏆 ARENA CONQUERED!</h2></div>
            <div class="modal-body" style="text-align:center;">
                <h3 style="color:var(--gold); font-size:1.5rem; margin:20px 0;">+${FormatNumber(goldReward)} Gold & +${FormatNumber(shardReward)} Shards</h3>
                <p style="color:var(--primary); font-weight:bold;">Epic Loot Acquired: ${bossLoot.name}</p>
                <div style="display:flex; gap:10px; margin-top:30px;">
                    <button class="btn" style="flex:1; background:#4caf50; color:black; border:none;" onclick="UI.openBossMenu()">NEXT BOSS</button>
                    <button class="btn" style="flex:1; background:#ff5252; color:white; border:none;" onclick="leaveBossArena()">RETURN TO VILLAGE</button>
                </div>
            </div>
        `;
        REFS.bossModal.style.display = 'flex';
    }
};

window.leaveBossArena = function() {
    if (REFS.bossModal) REFS.bossModal.style.display = 'none';
    if (REFS.bossTimerUI) REFS.bossTimerUI.style.display = 'none';
    initLevel(false);
    GameState.state = 'PLAYING';
};

// --- 6. ENGINE FUNCTIONS ---
function spawnFloatingText(x, y, text, color) { floatingTexts.push(new FloatingText(x, y, text, color)); }
function spawnLoot(x, y, type) { entities.push(new Loot(x, y, type)); }

class Projectile {
    constructor(x, y, target, speed, damage, isCrit, isEnemy = false) {
        this.x = x; this.y = y; this.target = target; this.speed = speed; this.damage = damage; 
        this.isCrit = isCrit; this.isEnemy = isEnemy;
        this.color = isEnemy ? '#ff3300' : (isCrit ? '#ffeb3b' : '#bb86fc'); 
        this.radius = isCrit ? 8 : 5; this.lifetime = 3.0; this.currentLifetime = 0; 
        this.markedForDeletion = false; 
    }
    update(dt) {
        if (this.markedForDeletion) return;
        this.currentLifetime += dt;
        if (this.currentLifetime >= this.lifetime) { this.markedForDeletion = true; return; }
        
        if (this.target && this.target.hp > 0) {
            let dx = this.target.x - this.x, dy = this.target.y - this.y, dist = Math.hypot(dx, dy);
            let angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed * dt; 
            this.y += Math.sin(angle) * this.speed * dt;
            
            if (dist < this.radius + this.target.radius) { 
                
                if (typeof this.target.takeDamage === 'function') {
                    this.target.takeDamage(this.damage, this.isCrit); 
                }
                
                this.markedForDeletion = true; 
                if (typeof spawnAura === 'function') {
                    spawnAura(this.x, this.y, this.isEnemy ? '#ff3300' : '#ff9800'); 
                }
            }
        } else { 
            this.markedForDeletion = true; 
        }
    }
    draw(ctx) {
        if (this.markedForDeletion) return;
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

function spawnSotaParticles(x, y, color, count, speed) {
    for(let i=0; i<count; i++) {
        let p = new Particle(x, y, color);
        p.vx = (Math.random() - 0.5) * speed; p.vy = (Math.random() - 0.5) * speed;
        p.size = randomFloat(2, 6); p.life = randomFloat(0.5, 1.2);
        particles.push(p);
    }
}

function gainXp(amt) {
    PlayerData.xp += Math.floor(amt * player.getXpMultiplier());
    let oldStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
    let oldLevel = PlayerData.level;
    let didLevel = false;

    while (PlayerData.xp >= PlayerData.maxXp) {
        PlayerData.xp -= PlayerData.maxXp;
        PlayerData.level++;
        player.skillPoints++;
        PlayerData.maxXp = Math.floor(PlayerData.maxXp * 1.5);
        didLevel = true;
    }

    if (didLevel) {
        player.hp = player.getMaxHp();
        spawnFloatingText(player.x, player.y - 40, "LEVEL UP!", '#03dac6');
        let newStats = typeof player.getUIStats === 'function' ? player.getUIStats() : { cp: player.getCombatPower() };
        let deltas = [], keys = [{k:'hp',l:'Max HP'},{k:'atk',l:'Attack'},{k:'def',l:'Defense'},{k:'regen',l:'Regen'},{k:'crit',l:'Crit %'},{k:'cx',l:'Crit X'},{k:'sp',l:'Atk Spd'},{k:'mag',l:'Magnet'},{k:'grd',l:'Gold Farmer'},{k:'wis',l:'XP Fiend'},{k:'fear',l:'Fear Aura'},{k:'cp',l:'cp'}];
        keys.forEach(s => { if(newStats[s.k] !== undefined && oldStats[s.k] !== undefined) { let d = newStats[s.k] - oldStats[s.k]; if(Math.abs(d) > 0.001 || s.k === 'cp') deltas.push({label:s.l, oldVal:oldStats[s.k], newVal:newStats[s.k], diff:d}); } });
        UI.showDelta(`Level Up! (${oldLevel} ➔ ${PlayerData.level})`, deltas);
        if (typeof refreshSkillTreeUI === 'function') refreshSkillTreeUI();
    }
    UI.updateStats(); saveGame();
}

function die() {
    Input.joystick.active = false;
    let jBase = document.getElementById('j-base');
    if (jBase) jBase.style.display = 'none';
    player.vx = 0;
    player.vy = 0;

    if (GameState.state === 'BOSS_ARENA') { failBossArena(); return; }
    GameState.state = 'DEAD'; 
    PlayerData.gold = Math.floor(PlayerData.gold / 2); 
    PlayerData.shards = Math.floor(PlayerData.shards / 2);
    UI.notify("YOU DIED. Wealth halved."); 
    saveGame();
    setTimeout(() => { initLevel(false); GameState.state = 'PLAYING'; }, 2000);
}

function levelUpDungeon() { GameState.pendingLevelUp = true; }

function spawnEnemies() {
    let num = 10 + GameState.level; 
    for(let i=0; i<num; i++) {
        let ex, ey;
        do { ex = randomInt(2, window.MAP_SIZE-3) * TILE_SIZE; ey = randomInt(2, window.VILLAGE_START - 2) * TILE_SIZE; } while (isWall(ex, ey) || (player && Math.hypot(ex - player.x, ey - player.y) < 400)); 
        entities.push(new Enemy(ex, ey));
    }
}

function initLevel(isFirstLoad = false) {
    if (isFirstLoad) { initEmptyMap(); generateVillage(); }
    generateDungeon(); 
    let p = player; entities = []; particles = []; floatingTexts = [];
    let spawnX = Math.floor(window.MAP_SIZE/2) * TILE_SIZE + TILE_SIZE/2;
    let spawnY = (window.VILLAGE_START + 5) * TILE_SIZE + TILE_SIZE/2;
    if(!p) player = new Player(spawnX, spawnY); else { player = p; player.x = spawnX; player.y = spawnY; player.hp = player.getMaxHp(); }
    if (typeof initializeSkillTree === 'function') initializeSkillTree();
    entities.push(player); 
    entities.push(new VillageInteractable(spawnX + 150, spawnY - 100, 'WORKBENCH', '🛠️'));
    entities.push(new VillageNPC(spawnX - 150, spawnY - 100, 'ELDER VIC', '🧙‍♂️', "Face the Arena... if you dare."));
    entities.push(new VillageInteractable(spawnX, spawnY - 200, 'BOUNTY BOARD', '📜'));
    spawnEnemies(); 
    REFS.depthLevel.innerText = GameState.level; 
    UI.updateMinimap(); UI.buildHotbar(); UI.updateStats();
}

// --- 7. INPUT & SAVE ---
let jZoneRef = document.getElementById('joystick-zone');
if (jZoneRef) {
    jZoneRef.addEventListener('touchstart', (e) => {
        if(GameState.state !== 'PLAYING' && GameState.state !== 'BOSS_ARENA') return;
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

function saveGame() { 
    PlayerData.dungeonLevel = GameState.level; 
    if (player) { PlayerData.skillPoints = player.skillPoints; PlayerData.learnedSkills = player.learnedSkills; }
    PlayerData.lastPlayed = Date.now();
    localStorage.setItem('dof_save', JSON.stringify(PlayerData));
}

function loadGame() {
    let save = localStorage.getItem('dof_save');
    if (save) {
        try {
            let d = JSON.parse(save);
            PlayerData.gold = d.gold ?? PlayerData.gold; PlayerData.shards = d.shards ?? PlayerData.shards; PlayerData.level = d.level ?? PlayerData.level; PlayerData.dungeonLevel = d.dungeonLevel ?? PlayerData.dungeonLevel; PlayerData.xp = d.xp ?? PlayerData.xp; PlayerData.maxXp = d.maxXp ?? PlayerData.maxXp; PlayerData.skillPoints = d.skillPoints ?? PlayerData.skillPoints; PlayerData.learnedSkills = d.learnedSkills ?? PlayerData.learnedSkills;
            PlayerData.skillAmps = d.skillAmps ?? {};
            PlayerData.questLog = d.questLog ?? { totalKills: 0 }; PlayerData.claimedBounties = d.claimedBounties ?? []; PlayerData.activeBounties = d.activeBounties ?? []; PlayerData.bossLevel = d.bossLevel ?? 1;
            PlayerData.lastPlayed = d.lastPlayed ?? Date.now();
            if (d.inventory) PlayerData.inventory = d.inventory; if (d.gear) PlayerData.gear = { ...PlayerData.gear, ...d.gear };
            GameState.level = PlayerData.dungeonLevel;
            if (window.refreshSkillTreeUI) window.refreshSkillTreeUI();
        } catch(e) { console.error("Save Corrupt", e); }
    }
}

// --- 8. RENDERER ---
function drawMap(camX, camY) {
    let sCol = Math.max(0, Math.floor(camX / TILE_SIZE)), eCol = Math.min(window.MAP_SIZE - 1, sCol + Math.ceil(REFS.canvas.width / TILE_SIZE) + 1),
        sRow = Math.max(0, Math.floor(camY / TILE_SIZE)), eRow = Math.min(window.MAP_SIZE - 1, sRow + Math.ceil(REFS.canvas.height / TILE_SIZE) + 1);
    for (let r = sRow; r <= eRow; r++) {
        for (let c = sCol; c <= eCol; c++) {
            if (!exploredGrid[r][c]) { ctx.fillStyle = '#000'; ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE); continue; }
            
            // Arena Floor vs Village Floor
            if (GameState.state === 'BOSS_ARENA') {
                ctx.fillStyle = mapGrid[r][c] === 1 ? '#000' : '#3d1c1c'; // Bloody red arena
            } else {
                if (r >= window.VILLAGE_START) ctx.fillStyle = mapGrid[r][c] === 1 ? '#1a252c' : '#2c3e50'; 
                else ctx.fillStyle = mapGrid[r][c] === 1 ? '#1e1e1e' : '#161616'; 
            }
            ctx.fillRect(c * TILE_SIZE - camX, r * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
        }
    }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height);
    if (GameState.state !== 'PLAYING' && GameState.state !== 'DEAD' && GameState.state !== 'BOSS_ARENA') return;
    
    let targetCamX = Math.max(0, Math.min(player.x - REFS.canvas.width / 2, window.MAP_SIZE * TILE_SIZE - REFS.canvas.width));
    let targetCamY = Math.max(0, Math.min(player.y - REFS.canvas.height / 2, window.MAP_SIZE * TILE_SIZE - REFS.canvas.height));
    if (GameState.camera.x === 0 && GameState.camera.y === 0) { GameState.camera.x = targetCamX; GameState.camera.y = targetCamY; }
    let lerpSpeed = player.isBlinking ? 0.015 : 0.1;
    GameState.camera.x += (targetCamX - GameState.camera.x) * lerpSpeed; GameState.camera.y += (targetCamY - GameState.camera.y) * lerpSpeed;
    
    ctx.save(); drawMap(GameState.camera.x, GameState.camera.y); ctx.translate(-GameState.camera.x, -GameState.camera.y);
    if (portal && exploredGrid[Math.floor(portal.y/TILE_SIZE)][Math.floor(portal.x/TILE_SIZE)] && GameState.state !== 'BOSS_ARENA') { ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2); ctx.fill(); }
    entities.filter(e => !e.markedForDeletion).sort((a, b) => a.y - b.y).forEach(e => e.draw?.(ctx));
    particles.forEach(p => p.draw(ctx)); floatingTexts.forEach(ft => ft.draw(ctx)); ctx.restore();
    if (GameState.state === 'DEAD') { ctx.fillStyle = 'rgba(100, 0, 0, 0.4)'; ctx.fillRect(0, 0, REFS.canvas.width, REFS.canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("YOU HAVE FALLEN", REFS.canvas.width/2, REFS.canvas.height/2); }
}

// --- 9. MAIN LOOP ---
function loop(timestamp) {
    let dt = Math.min(0.1, (timestamp - GameState.lastTime) / 1000); GameState.lastTime = timestamp;
    if (GameState.state === 'PLAYING' || GameState.state === 'BOSS_ARENA') {
        
        // Handle Boss Timer
        if (GameState.state === 'BOSS_ARENA') {
            GameState.bossTimer -= dt;
            if (REFS.bossTimerText) REFS.bossTimerText.innerText = Math.max(0, GameState.bossTimer).toFixed(1) + "s";
            if (GameState.bossTimer <= 0) failBossArena();
        }

        if (GameState.pendingLevelUp && GameState.state !== 'BOSS_ARENA') { GameState.level++; UI.notify(`Depth ${GameState.level}`); initLevel(false); GameState.pendingLevelUp = false; saveGame(); }
        HiveMind.update();
        for (let i = entities.length - 1; i >= 0; i--) if (entities[i] && entities[i].update) entities[i].update(dt);
        for (let i = entities.length - 1; i >= 0; i--) if (entities[i] && entities[i].markedForDeletion) entities.splice(i, 1);
        for (let i = particles.length - 1; i >= 0; i--) particles[i].update(dt);
        for (let i = floatingTexts.length - 1; i >= 0; i--) floatingTexts[i].update(dt);
        
        GameState.activeInteractable = null;
        if (GameState.state !== 'BOSS_ARENA') {
            entities.forEach(e => { if ((e instanceof VillageNPC || e instanceof VillageInteractable) && Math.hypot(player.x - e.x, player.y - e.y) < 100) GameState.activeInteractable = e; });
        }

        if (GameState.frame % 10 === 0) UI.updateStats();
        
        if (GameState.frame % 120 === 0 && GameState.state !== 'BOSS_ARENA') { 
            let ec = 0; for(let i=0; i<entities.length; i++) if(entities[i] instanceof Enemy) ec++;
            let maxEnemies = 5 + GameState.level;
            if (ec < maxEnemies) {
                let toSpawn = Math.min(2, maxEnemies - ec);
                for(let s=0; s < toSpawn; s++) {
                    let ex, ey; do { ex = randomInt(2, window.MAP_SIZE-3) * TILE_SIZE; ey = randomInt(2, window.VILLAGE_START - 2) * TILE_SIZE; } while (isWall(ex, ey) || Math.hypot(ex - player.x, ey - player.y) < 400);
                    entities.push(new Enemy(ex, ey));
                }
            }
        }
        if (GameState.frame % 30 === 0) UI.updateMinimap();
        if (portal && GameState.state !== 'BOSS_ARENA') {
            let dist = Math.hypot(player.x - portal.x, player.y - portal.y), cost = GameState.level * 250;
            if (dist < 50) {
                REFS.portalUI.style.display = 'block'; REFS.portalCost.innerText = `Unlock Cost: ${FormatNumber(cost)} Gold`;
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
REFS.playBtn.addEventListener('click', () => { REFS.mainMenu.classList.add('hidden'); REFS.uiLayer.classList.remove('hidden'); initLevel(true); UI.updateCurrencies(); UI.checkDailyLogin(); GameState.state = 'PLAYING'; GameState.lastTime = performance.now(); requestAnimationFrame(loop); });

const bindUIButton = (element, callback) => {
    if (!element) return; let fired = false;
    element.addEventListener('touchstart', (e) => { e.preventDefault(); if (!fired) { fired = true; callback(); setTimeout(() => fired = false, 400); } }, { passive: false });
    element.addEventListener('click', (e) => { if (!fired) { fired = true; callback(); setTimeout(() => fired = false, 400); } });
};
window.addEventListener('DOMContentLoaded', () => {
    bindUIButton(document.getElementById('claim-daily-btn'), () => UI.claimDaily());
    bindUIButton(document.getElementById('avatar-btn'), () => UI.toggleInventory());
    bindUIButton(document.querySelector('#inventory-modal .close-btn'), () => REFS.invModal.style.display = 'none');
    bindUIButton(document.querySelector('#workbench-modal .close-btn'), () => REFS.workbenchModal.style.display = 'none');
    bindUIButton(document.querySelector('#bounty-modal .close-btn'), () => REFS.bountyModal.style.display = 'none');
    bindUIButton(document.getElementById('auto-clean-btn'), () => UI.autoCleanBag());
});

class VillageNPC { constructor(x, y, name, icon, message) { this.x = x; this.y = y; this.name = name; this.icon = icon; this.message = message; this.radius = 25; } update(dt) {} draw(ctx) { ctx.save(); ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.fillText(this.icon, this.x, this.y); ctx.font = "bold 14px Arial"; ctx.fillStyle = "white"; ctx.fillText(this.name, this.x, this.y + 20); if (GameState.activeInteractable === this) { ctx.fillStyle = "rgba(187, 134, 252, 0.5)"; ctx.beginPath(); ctx.arc(this.x, this.y, 40, 0, Math.PI*2); ctx.fill(); } ctx.restore(); } }
class VillageInteractable { constructor(x, y, type, icon) { this.x = x; this.y = y; this.type = type; this.icon = icon; this.radius = 25; } update(dt) {} draw(ctx) { ctx.save(); ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.fillText(this.icon, this.x, this.y); ctx.font = "bold 14px Arial"; ctx.fillStyle = "#ffd700"; ctx.fillText(this.type, this.x, this.y + 20); if (GameState.activeInteractable === this) { ctx.fillStyle = "rgba(255, 215, 0, 0.3)"; ctx.beginPath(); ctx.arc(this.x, this.y, 50, 0, Math.PI*2); ctx.fill(); } ctx.restore(); } }

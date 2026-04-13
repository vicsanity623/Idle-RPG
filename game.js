function formatNumber(num) {
    if (num < 1000) return Number.isInteger(num) ? num.toString() : num.toFixed(2);
    const exponent = Math.floor(Math.log10(num) / 3);
    const shortValue = num / Math.pow(10, exponent * 3);
    let suffix = "";
    if (exponent === 1) suffix = "K";
    else if (exponent === 2) suffix = "M";
    else if (exponent === 3) suffix = "B";
    else {
        let index = exponent - 4;
        while (index >= 0) {
            suffix = String.fromCharCode((index % 26) + 65) + suffix;
            index = Math.floor(index / 26) - 1;
        }
    }
    return shortValue.toFixed(2) + suffix;
}

// --- UPDATED GAME STATE ---
let state = {
    world: 1,
    stage: 1,
    highestStage: 1,
    wave: 1,
    goldDust: 0,
    sats: 0,
    iron: 0,
    core: 0,
    level: 1,
    xp: 0,
    stageXpTracker: {}, // Tracks re-clears for diminishing returns
    lastSaveTime: Date.now(),
    stats: { maxHp: 100, atk: 10, def: 2, crit: 5, regen: 1 },
    upgrades: { hp: 0, atk: 0, def: 0, crit: 0, regen: 0 }
};

let currentHp = 100;
let enemy = { name: 'Slime', hp: 30, maxHp: 30, atk: 2, def: 0 };
let isBattling = false;

function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('satoshiRpgSaveV2', JSON.stringify(state));
}

function loadGame() {
    const save = localStorage.getItem('satoshiRpgSaveV2');
    if (save) {
        let loaded = JSON.parse(save);
        state = { ...state, ...loaded };
        currentHp = state.stats.maxHp;
        
        let now = Date.now();
        let elapsedMins = (now - state.lastSaveTime) / 60000;
        if (elapsedMins > 1) {
            if (elapsedMins > 1440) elapsedMins = 1440;
            let earnedDust = elapsedMins * 0.01;
            state.goldDust += earnedDust;
            document.getElementById('offline-time').innerText = Math.floor(elapsedMins);
            document.getElementById('offline-dust').innerText = formatNumber(earnedDust);
            document.getElementById('offline-modal').classList.remove('hidden');
        }
    }
}

function getNextXp() {
    return 100 * Math.pow(1.2, state.level - 1);
}

function addXp(amount) {
    state.xp += amount;
    let nextXp = getNextXp();
    if (state.xp >= nextXp) {
        state.xp -= nextXp;
        state.level++;
        // Stat Level Up Bonus (+2% to everything)
        state.stats.maxHp *= 1.02;
        state.stats.atk *= 1.02;
        state.stats.def *= 1.02;
        state.stats.regen *= 1.02;
        log(`<span style="color:#3498db">LEVEL UP! Reached Lv.${state.level}. Stats increased!</span>`, 'log-loot');
        spawnText('player', 'LEVEL UP!', 'heal-text');
    }
}

function updateDOM() {
    document.getElementById('world-display').innerText = state.world;
    document.getElementById('stage-display').innerText = state.stage;
    document.getElementById('wave-display').innerText = state.wave;
    document.getElementById('dust-balance').innerText = formatNumber(state.goldDust);
    document.getElementById('sats-balance').innerText = formatNumber(state.sats);
    
    // XP Bar
    let nextXp = getNextXp();
    document.getElementById('player-lvl').innerText = state.level;
    document.getElementById('curr-xp').innerText = formatNumber(state.xp);
    document.getElementById('next-xp').innerText = formatNumber(nextXp);
    document.getElementById('xp-fill').style.width = (state.xp / nextXp * 100) + '%';

    // Unlock Logic UI
    const nextCost = getStageCost(state.stage + 1);
    const unlockInfo = document.getElementById('unlock-info');
    if (state.stage < state.highestStage) {
        unlockInfo.innerHTML = `Wave <span id="wave-display">${state.wave}</span>/3 | <span style="color:#4caf50">Unlocked</span>`;
    } else {
        unlockInfo.innerHTML = `Wave <span id="wave-display">${state.wave}</span>/3 | Unlock: <span id="next-cost">${formatNumber(nextCost)}</span> ✨`;
    }
    
    document.getElementById('player-hp').innerText = formatNumber(currentHp);
    document.getElementById('player-max-hp').innerText = formatNumber(state.stats.maxHp);
    document.getElementById('player-hp-fill').style.width = Math.max(0, (currentHp / state.stats.maxHp) * 100) + '%';
    document.getElementById('enemy-hp').innerText = formatNumber(enemy.hp);
    document.getElementById('enemy-max-hp').innerText = formatNumber(enemy.maxHp);
    document.getElementById('enemy-hp-fill').style.width = Math.max(0, (enemy.hp / enemy.maxHp) * 100) + '%';
    
    document.getElementById('stat-maxhp').innerText = formatNumber(state.stats.maxHp);
    document.getElementById('stat-atk').innerText = formatNumber(state.stats.atk);
    document.getElementById('stat-def').innerText = formatNumber(state.stats.def);
    document.getElementById('stat-crit').innerText = state.stats.crit.toFixed(0);
    document.getElementById('stat-regen').innerText = formatNumber(state.stats.regen);
    document.getElementById('inv-iron').innerText = formatNumber(state.iron);
    document.getElementById('inv-core').innerText = formatNumber(state.core);

    renderCrafting();
}

function log(msg, styleClass = '') {
    const elLog = document.getElementById('combat-log');
    const div = document.createElement('div');
    div.className = `log-entry ${styleClass}`;
    div.innerHTML = msg;
    elLog.appendChild(div);
    if(elLog.childElementCount > 20) elLog.removeChild(elLog.firstChild);
    elLog.scrollTop = elLog.scrollHeight;
}

function getStageCost(targetStage) {
    return 5 * Math.pow(1.2, targetStage - 1) * Math.pow(2, state.world - 1);
}

function spawnEnemy() {
    const isBoss = state.stage % 10 === 0 && state.wave === 3;
    const multiplier = Math.pow(1.5, state.world - 1) * Math.pow(1.15, state.stage - 1);
    let baseHp = isBoss ? 100 : 25;
    let baseAtk = isBoss ? 5 : 2;
    let waveScale = 1 + (state.wave * 0.1);

    enemy = {
        name: isBoss ? `World Boss ${state.world}-${state.stage}` : `Monster ${state.world}-${state.stage}`,
        maxHp: baseHp * multiplier * waveScale,
        hp: baseHp * multiplier * waveScale,
        atk: baseAtk * multiplier * waveScale,
        def: (isBoss ? 2 : 0) * multiplier
    };
    const eSprite = document.getElementById('enemy-sprite');
    eSprite.style.backgroundImage = `url('https://api.dicebear.com/7.x/bottts/svg?seed=${state.world}${state.stage}${state.wave}&backgroundColor=transparent')`;
    updateDOM();
}

function combatTick() {
    if (!isBattling) return;
    if (currentHp < state.stats.maxHp) currentHp = Math.min(state.stats.maxHp, currentHp + state.stats.regen);

    const pSprite = document.getElementById('player-sprite');
    const eSprite = document.getElementById('enemy-sprite');

    // Player Turn
    pSprite.classList.add('attack-right');
    eSprite.classList.add('take-damage');
    setTimeout(() => { pSprite.classList.remove('attack-right'); eSprite.classList.remove('take-damage'); }, 300);

    let isCrit = Math.random() * 100 < state.stats.crit;
    let rawDmg = (state.stats.atk * (isCrit ? 2 : 1)) - enemy.def;
    let actualDmg = Math.max(1, Math.min(rawDmg, enemy.maxHp * 0.33));
    enemy.hp -= actualDmg;
    spawnText('enemy', `-${formatNumber(actualDmg)}`, isCrit ? 'heal-text' : 'dmg-enemy');

    if (enemy.hp <= 0) { enemy.hp = 0; enemyDefeated(); return; }

    // Enemy Turn
    setTimeout(() => {
        if (!isBattling || enemy.hp <= 0) return;
        eSprite.classList.add('attack-left');
        pSprite.classList.add('take-damage');
        setTimeout(() => { eSprite.classList.remove('attack-left'); pSprite.classList.remove('take-damage'); }, 300);
        let eActualDmg = Math.max(1, Math.min(enemy.atk - state.stats.def, state.stats.maxHp * 0.33));
        currentHp -= eActualDmg;
        spawnText('player', `-${formatNumber(eActualDmg)}`, 'dmg-player');
        if (currentHp <= 0) { currentHp = state.stats.maxHp; showMap(); }
        updateDOM();
    }, 700);
    updateDOM();
}

function enemyDefeated() {
    log(`Victory!`, 'log-kill');
    
    // XP Diminishing Returns Logic
    let stageKey = `${state.world}-${state.stage}`;
    if(!state.stageXpTracker[stageKey]) state.stageXpTracker[stageKey] = 0;
    
    let baseXp = 20 * Math.pow(1.1, state.stage);
    let xpMultiplier = Math.pow(0.5, state.stageXpTracker[stageKey]);
    let finalXp = baseXp * xpMultiplier;

    if (finalXp > 0.01) {
        addXp(finalXp);
        log(`+${formatNumber(finalXp)} XP`);
        state.stageXpTracker[stageKey]++; // Increase clear count
    } else {
        log(`No XP gained (Stage over-farmed)`);
    }

    // Gold Dust
    state.goldDust += 0.5 * Math.pow(1.1, state.stage);
    if(Math.random() > 0.6) state.iron++;
    if(Math.random() > 0.9) state.core++;
    if (state.stage % 10 === 0 && state.wave === 3) state.sats += 10;

    state.wave++;
    if (state.wave > 3) {
        state.wave = 1;
        // FREE IF ALREADY HIGHEST
        if (state.stage < state.highestStage) {
            state.stage++;
        } else {
            // UNLOCK COST FOR NEW STAGES
            let cost = getStageCost(state.stage + 1);
            if (state.goldDust >= cost) {
                state.goldDust -= cost;
                state.stage++;
                state.highestStage++;
                if (state.stage > 50) { triggerWorldTransition(); return; }
            } else {
                log('Gold Dust required to unlock next stage.');
                showMap();
                return;
            }
        }
    }
    saveGame();
    setTimeout(spawnEnemy, 1000);
}

// Map Logic
function showMap() {
    isBattling = false;
    document.getElementById('map-view').classList.remove('hidden');
    document.getElementById('map-world').innerText = state.world;
    document.getElementById('map-dust').innerText = formatNumber(state.goldDust);
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 50; i++) {
        let node = document.createElement('div');
        node.className = 'map-node';
        node.innerText = i;
        if (i < state.highestStage) node.classList.add('node-cleared');
        else if (i === state.highestStage) node.classList.add('node-active');
        else node.classList.add('node-locked');

        if (i <= state.highestStage) {
            node.onclick = () => { state.stage = i; state.wave = 1; closeMap(); };
        }
        grid.appendChild(node);
    }
}

function closeMap() { document.getElementById('map-view').classList.add('hidden'); isBattling = true; spawnEnemy(); }

function triggerWorldTransition() {
    isBattling = false; state.world++; state.stage = 1; state.highestStage = 1; state.wave = 1; state.stageXpTracker = {};
    document.getElementById('trans-world-num').innerText = state.world;
    document.getElementById('falling-transition').classList.remove('hidden');
    setTimeout(() => { document.getElementById('falling-transition').classList.add('hidden'); isBattling = true; spawnEnemy(); }, 3000);
}

// Upgrades
const upgradesData = [
    { id: 'atk', name: 'Sharpen Weapon', stat: 'ATK', baseDust: 10, baseIron: 2, scale: 1.5, boost: 5 },
    { id: 'hp', name: 'Fortify Armor', stat: 'Max HP', baseDust: 10, baseIron: 2, scale: 1.5, boost: 20 },
    { id: 'def', name: 'Thick Plating', stat: 'DEF', baseDust: 25, baseIron: 5, scale: 1.6, boost: 2 },
    { id: 'crit', name: 'Focus Lens', stat: 'CRIT', baseDust: 100, baseCore: 1, scale: 2.0, boost: 1 },
    { id: 'regen', name: 'Healing Aura', stat: 'REGEN', baseDust: 50, baseCore: 2, scale: 1.8, boost: 1 }
];

function renderCrafting() {
    const list = document.getElementById('crafting-list');
    list.innerHTML = '';
    upgradesData.forEach(u => {
        let level = state.upgrades[u.id];
        let costDust = u.baseDust * Math.pow(u.scale, level);
        let costIron = u.baseIron ? Math.floor(u.baseIron * Math.pow(1.2, level)) : 0;
        let costCore = u.baseCore ? Math.floor(u.baseCore * Math.pow(1.2, level)) : 0;
        let costStr = `✨${formatNumber(costDust)}`;
        if(costIron) costStr += ` | ⚙️${formatNumber(costIron)}`;
        if(costCore) costStr += ` | 🔮${formatNumber(costCore)}`;
        const div = document.createElement('div');
        div.className = 'craft-box';
        div.innerHTML = `<div class="craft-details"><h4>${u.name} (Lv.${level})</h4><p style="color:#4caf50; font-size:12px;">+${u.boost} ${u.stat}</p><p class="craft-cost">${costStr}</p></div><button class="craft-btn" onclick="buyUpgrade('${u.id}')">Craft</button>`;
        list.appendChild(div);
    });
}

window.buyUpgrade = function(id) {
    const u = upgradesData.find(x => x.id === id);
    let level = state.upgrades[id];
    let costDust = u.baseDust * Math.pow(u.scale, level);
    let costIron = u.baseIron ? Math.floor(u.baseIron * Math.pow(1.2, level)) : 0;
    let costCore = u.baseCore ? Math.floor(u.baseCore * Math.pow(1.2, level)) : 0;
    if (state.goldDust >= costDust && state.iron >= costIron && state.core >= costCore) {
        state.goldDust -= costDust; state.iron -= costIron; state.core -= costCore; state.upgrades[id]++;
        if (id === 'atk') state.stats.atk += u.boost; if (id === 'hp') state.stats.maxHp += u.boost;
        if (id === 'def') state.stats.def += u.boost; if (id === 'crit') state.stats.crit += u.boost;
        if (id === 'regen') state.stats.regen += u.boost;
        updateDOM(); saveGame();
    }
}

function spawnText(target, text, cssClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${cssClass}`;
    el.innerText = text;
    el.style.left = target === 'player' ? '25%' : '75%';
    el.style.top = '40%';
    document.getElementById('fx-container').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function closeOfflineModal() { document.getElementById('offline-modal').classList.add('hidden'); isBattling = true; }

loadGame();
if (document.getElementById('offline-modal').classList.contains('hidden')) isBattling = true;
spawnEnemy();
setInterval(combatTick, 2000);
setInterval(saveGame, 10000);

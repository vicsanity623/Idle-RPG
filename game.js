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

let state = {
    world: 1, stage: 1, highestStage: 1, wave: 1,
    level: 1, xp: 0, clearCounts: {}, 
    goldDust: 0, sats: 0, iron: 0, core: 0,
    lastSaveTime: Date.now(),
    stats: { maxHp: 100, atk: 10, def: 2, crit: 5, regen: 1 },
    upgrades: { hp: 0, atk: 0, def: 0, crit: 0, regen: 0 }
};

let currentHp = 100;
let enemy = { name: 'Slime', hp: 30, maxHp: 30, atk: 2, def: 0 };
let isBattling = false; 

function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('satoshiRpgSave', JSON.stringify(state));
}

function loadGame() {
    const save = localStorage.getItem('satoshiRpgSave');
    if (save) {
        let loaded = JSON.parse(save);
        state = { ...state, ...loaded }; 
        currentHp = state.stats.maxHp;
        
        let now = Date.now();
        let elapsedMins = (now - state.lastSaveTime) / 60000;
        if (elapsedMins > 0) {
            if (elapsedMins > 1440) elapsedMins = 1440; 
            let earnedDust = elapsedMins * 0.01;
            state.goldDust += earnedDust;
            
            document.getElementById('offline-time').innerText = Math.floor(elapsedMins);
            document.getElementById('offline-dust').innerText = formatNumber(earnedDust);
            document.getElementById('offline-modal').classList.remove('hidden');
        }
    }
}

function getMaxXp() { return 100 * Math.pow(1.3, state.level - 1); }

function checkLevelUp() {
    let maxXp = getMaxXp();
    let leveledUp = false;
    while (state.xp >= maxXp) {
        state.xp -= maxXp;
        state.level++;
        state.stats.maxHp += 5;
        state.stats.atk += 1;
        state.stats.def += 0.5;
        state.stats.crit = Math.min(50, state.stats.crit + 0.1); 
        state.stats.regen += 0.2;
        maxXp = getMaxXp();
        leveledUp = true;
    }
    if (leveledUp) {
        currentHp = state.stats.maxHp; 
        log(`Level Up! You are now Lv.${formatNumber(state.level)}`, 'log-boss');
        spawnText('player', 'LEVEL UP!', 'heal-text');
    }
}

function updateDOM() {
    document.getElementById('world-display').innerText = formatNumber(state.world);
    document.getElementById('stage-display').innerText = formatNumber(state.stage);
    document.getElementById('wave-display').innerText = formatNumber(state.wave);
    document.getElementById('dust-balance').innerText = formatNumber(state.goldDust);
    document.getElementById('sats-balance').innerText = formatNumber(state.sats);
    
    let nextStageCost = getStageCost(state.stage + 1);
    document.getElementById('next-cost').innerText = nextStageCost === 0 ? "Unlocked" : formatNumber(nextStageCost) + " ✨";
    
    document.getElementById('player-hp').innerText = formatNumber(currentHp);
    document.getElementById('player-max-hp').innerText = formatNumber(state.stats.maxHp);
    document.getElementById('player-hp-fill').style.width = Math.max(0, (currentHp / state.stats.maxHp) * 100) + '%';
    
    document.getElementById('player-level').innerText = formatNumber(state.level);
    document.getElementById('player-xp-fill').style.width = Math.max(0, Math.min(100, (state.xp / getMaxXp()) * 100)) + '%';
    
    document.getElementById('enemy-name').innerText = enemy.name;
    document.getElementById('enemy-hp').innerText = formatNumber(enemy.hp);
    document.getElementById('enemy-max-hp').innerText = formatNumber(enemy.maxHp);
    document.getElementById('enemy-hp-fill').style.width = Math.max(0, (enemy.hp / enemy.maxHp) * 100) + '%';

    document.getElementById('stat-maxhp').innerText = formatNumber(state.stats.maxHp);
    document.getElementById('stat-atk').innerText = formatNumber(state.stats.atk);
    document.getElementById('stat-def').innerText = formatNumber(state.stats.def);
    document.getElementById('stat-crit').innerText = formatNumber(state.stats.crit);
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
    if(elLog.childElementCount > 30) elLog.removeChild(elLog.firstChild);
    elLog.scrollTop = elLog.scrollHeight;
}

function closeOfflineModal() {
    document.getElementById('offline-modal').classList.add('hidden');
    isBattling = true;
}

function getStageCost(targetStage) {
    if (targetStage <= state.highestStage) return 0;
    return 5 * Math.pow(1.2, targetStage - 1) * Math.pow(2, state.world - 1);
}

function spawnEnemy() {
    const isBoss = state.stage % 10 === 0 && state.wave === 3;
    const multiplier = Math.pow(1.5, state.world - 1) * Math.pow(1.15, state.stage - 1);
    
    let baseHp = isBoss ? 100 : 20;
    let baseAtk = isBoss ? 5 : 2;
    let baseDef = isBoss ? 2 : 0;
    let waveScale = 1 + (state.wave * 0.1);

    enemy = {
        name: isBoss ? `World Boss ${state.world}-${state.stage}` : `Monster ${state.world}-${state.stage}`,
        maxHp: baseHp * multiplier * waveScale,
        hp: baseHp * multiplier * waveScale,
        atk: baseAtk * multiplier * waveScale,
        def: baseDef * multiplier * waveScale
    };

    const eSprite = document.getElementById('enemy-sprite');
    if (isBoss) {
        eSprite.style.backgroundImage = "url('https://api.dicebear.com/7.x/bottts/svg?seed=Boss" + state.stage + "&backgroundColor=transparent')";
        eSprite.style.transform = "scaleX(-1) scale(1.3)";
    } else {
        eSprite.style.backgroundImage = "url('https://api.dicebear.com/7.x/bottts/svg?seed=" + state.world + state.stage + state.wave + "&backgroundColor=transparent')";
        eSprite.style.transform = "scaleX(-1) scale(1)";
    }
    updateDOM();
}

function combatTick() {
    if (!isBattling) return;

    if (currentHp < state.stats.maxHp) {
        currentHp = Math.min(state.stats.maxHp, currentHp + state.stats.regen);
    }

    const pSprite = document.getElementById('player-sprite');
    const eSprite = document.getElementById('enemy-sprite');

    pSprite.classList.add('attack-right');
    eSprite.classList.add('take-damage');
    setTimeout(() => { pSprite.classList.remove('attack-right'); eSprite.classList.remove('take-damage'); }, 300);

    let isCrit = Math.random() * 100 < state.stats.crit;
    let rawDamage = (state.stats.atk * (isCrit ? 2 : 1)) - enemy.def;
    let maxAllowedDmg = enemy.maxHp * 0.33;
    let actualDamage = Math.max(1, Math.min(rawDamage, maxAllowedDmg));

    enemy.hp -= actualDamage;
    spawnText('enemy', `-${formatNumber(actualDamage)}${isCrit ? '!' : ''}`, 'dmg-enemy');

    if (enemy.hp <= 0) {
        enemy.hp = 0;
        enemyDefeated();
        return;
    }

    setTimeout(() => {
        if (!isBattling || enemy.hp <= 0) return;
        
        eSprite.classList.add('attack-left');
        pSprite.classList.add('take-damage');
        setTimeout(() => { eSprite.classList.remove('attack-left'); pSprite.classList.remove('take-damage'); }, 300);

        let eRawDamage = enemy.atk - state.stats.def;
        let eMaxAllowed = state.stats.maxHp * 0.33;
        let eActualDamage = Math.max(1, Math.min(eRawDamage, eMaxAllowed));

        currentHp -= eActualDamage;
        spawnText('player', `-${formatNumber(eActualDamage)}`, 'dmg-player');

        if (currentHp <= 0) {
            currentHp = 0;
            log('Hero died. Retreating to Hub...', 'log-kill');
            currentHp = state.stats.maxHp;
            goToHub(); // Send to hub on death
        }
        updateDOM();
    }, 700);

    updateDOM();
}

function enemyDefeated() {
    log(`Defeated ${enemy.name}!`, 'log-kill');
    
    let stageKey = `${state.world}-${state.stage}`;
    let clearCount = state.clearCounts[stageKey] || 0;
    
    let baseXp = 15 * Math.pow(1.3, state.world - 1) * Math.pow(1.1, state.stage);
    let earnedXp = baseXp / Math.pow(2, clearCount); 
    
    if (earnedXp > 0.01) {
        state.xp += earnedXp;
        log(`+${formatNumber(earnedXp)} XP`, 'log-loot');
        checkLevelUp();
    }
    
    let dustDrop = 0.75 * Math.pow(1.5, state.world - 1) * Math.pow(1.1, state.stage);
    state.goldDust += dustDrop;
    log(`Found ${formatNumber(dustDrop)} Dust.`);
    
    if(Math.random() > 0.5) state.iron++;
    if(Math.random() > 0.8) state.core++;

    if (state.stage % 10 === 0 && state.wave === 3) state.sats += 10;

    state.wave++;
    if (state.wave > 3) {
        // STAGE CLEARED - INTERCEPT AUTO LOOP
        state.clearCounts[stageKey] = clearCount + 1; 
        state.wave = 1;
        
        isBattling = false; // Pause combat
        
        // Show Victory Modal
        let nextCost = getStageCost(state.stage + 1);
        let nextBtn = document.getElementById('btn-next-stage');
        if (nextCost > 0) {
            nextBtn.innerText = `Unlock Stage ${state.stage + 1} (Cost: ${formatNumber(nextCost)} ✨)`;
        } else {
            nextBtn.innerText = `Proceed to Stage ${state.stage + 1} (Free)`;
        }
        
        document.getElementById('next-stage-error').innerText = ''; // Clear old errors
        document.getElementById('stage-clear-modal').classList.remove('hidden');
        
        saveGame();
        return; // Stops spawnEnemy from running
    }
    
    saveGame();
    setTimeout(spawnEnemy, 1000);
}

// --- NEW STAGE / HUB NAVIGATION CONTROLS ---

function handleNextStage() {
    let nextCost = getStageCost(state.stage + 1);
    
    if (state.goldDust >= nextCost) {
        if (nextCost > 0) state.goldDust -= nextCost;
        
        state.stage++;
        if (state.stage > state.highestStage) state.highestStage = state.stage;
        
        document.getElementById('stage-clear-modal').classList.add('hidden');
        
        if (state.stage > 50) {
            triggerWorldTransition();
            return;
        }
        
        isBattling = true;
        spawnEnemy();
    } else {
        document.getElementById('next-stage-error').innerText = 'Not enough Gold Dust to unlock the next stage!';
    }
}

function handleReplayStage() {
    document.getElementById('stage-clear-modal').classList.add('hidden');
    isBattling = true;
    spawnEnemy();
}

function goToHub() {
    document.getElementById('stage-clear-modal').classList.add('hidden');
    document.getElementById('game-container').classList.add('hub-mode');
    document.getElementById('hub-nav').classList.remove('hidden');
    isBattling = false; // Stay paused
}

function returnFromHub() {
    document.getElementById('game-container').classList.remove('hub-mode');
    document.getElementById('hub-nav').classList.add('hidden');
    isBattling = true;
    spawnEnemy();
}

// --- MAP & WORLDS ---
function showMap() {
    document.getElementById('map-view').classList.remove('hidden');
    document.getElementById('map-world').innerText = formatNumber(state.world);
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
            node.onclick = () => {
                state.stage = i;
                state.wave = 1;
                closeMap();
                returnFromHub(); // Ensures we jump right into battle from map
            };
        }
        grid.appendChild(node);
    }
}

function closeMap() {
    document.getElementById('map-view').classList.add('hidden');
    // We do NOT set isBattling=true here, because they might be looking at the map from the Hub.
}

function triggerWorldTransition() {
    isBattling = false;
    state.world++;
    state.stage = 1;
    state.highestStage = 1;
    state.wave = 1;
    
    document.getElementById('trans-world-num').innerText = formatNumber(state.world);
    const transDiv = document.getElementById('falling-transition');
    transDiv.classList.remove('hidden');
    
    setTimeout(() => {
        transDiv.classList.add('hidden');
        saveGame();
        isBattling = true;
        spawnEnemy();
    }, 3000);
}

// --- CRAFTING / UPGRADES ---
const upgradesData = [
    { id: 'atk', name: 'Sharpen Weapon', stat: 'ATK', baseDust: 0.02, baseIron: 2, scale: 1.5, boost: 5 },
    { id: 'hp', name: 'Fortify Armor', stat: 'Max HP', baseDust: 0.1, baseIron: 2, scale: 1.5, boost: 20 },
    { id: 'def', name: 'Thick Plating', stat: 'DEF', baseDust: 0.15, baseIron: 5, scale: 1.6, boost: 2 },
    { id: 'crit', name: 'Focus Lens', stat: 'CRIT', baseDust: 0.15, baseCore: 1, scale: 2.0, boost: 1 }, 
    { id: 'regen', name: 'Healing Aura', stat: 'REGEN', baseDust: 0.2, baseCore: 2, scale: 1.8, boost: 1 }
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
        div.innerHTML = `
            <div class="craft-details">
                <h4>${u.name} (Lv.${formatNumber(level)})</h4>
                <p style="color:#4caf50; font-size:12px;">+${formatNumber(u.boost)} ${u.stat}</p>
                <p class="craft-cost">${costStr}</p>
            </div>
            <button class="craft-btn" onclick="buyUpgrade('${u.id}')">Craft</button>
        `;
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
        state.goldDust -= costDust;
        state.iron -= costIron;
        state.core -= costCore;
        
        state.upgrades[id]++;
        
        if (id === 'atk') state.stats.atk += u.boost;
        if (id === 'hp') state.stats.maxHp += u.boost;
        if (id === 'def') state.stats.def += u.boost;
        if (id === 'crit') state.stats.crit += u.boost;
        if (id === 'regen') state.stats.regen += u.boost;
        
        log(`Upgraded ${u.stat}!`, 'log-loot');
        updateDOM();
        saveGame();
    } else {
        log('Not enough materials!', 'dmg-player');
    }
}

// FX
function spawnText(target, text, cssClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${cssClass}`;
    el.innerText = text;
    el.style.left = target === 'player' ? '25%' : '75%';
    el.style.top = '40%';
    document.getElementById('fx-container').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// --- INIT ---
loadGame();
if (document.getElementById('offline-modal').classList.contains('hidden')) {
    isBattling = true; 
}
spawnEnemy();
setInterval(combatTick, 2000); 
setInterval(saveGame, 10000);

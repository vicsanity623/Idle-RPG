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
    level: 1, xp: 0, clearCounts: {}, satsClaimed: {}, // Tracked boss wins
    goldDust: 0, sats: 0, iron: 0, core: 0,
    lastSaveTime: Date.now(),
    stats: { maxHp: 100, atk: 10, def: 2, crit: 5, regen: 1 },
    upgrades: { hp: 0, atk: 0, def: 0, crit: 0, regen: 0 }
};

let currentHp = 100;
let enemy = { name: 'Slime', hp: 30, maxHp: 30, atk: 2, def: 0 };
let isBattling = false; 

// Track rewards per stage for the modal
let stageRewards = { dust: 0, xp: 0, iron: 0, core: 0 };

function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('satoshiRpgSave', JSON.stringify(state));
}

function loadGame() {
    const save = localStorage.getItem('satoshiRpgSave');
    if (save) {
        let loaded = JSON.parse(save);
        state = { ...state, ...loaded }; 
        if(!state.satsClaimed) state.satsClaimed = {}; // Fallback for old saves
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
    // Reset tracker at wave 1
    if (state.wave === 1) stageRewards = { dust: 0, xp: 0, iron: 0, core: 0 };

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
    let actualDamage = Math.max(1, rawDamage); // Math allows 1-hit kills now

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
        let eActualDamage = Math.max(1, eRawDamage);

        currentHp -= eActualDamage;
        spawnText('player', `-${formatNumber(eActualDamage)}`, 'dmg-player');

        if (currentHp <= 0) {
            currentHp = 0;
            log('Hero died. Retreating to Hub...', 'log-kill');
            currentHp = state.stats.maxHp;
            goToHub(); 
        }
        updateDOM();
    }, 700);

    updateDOM();
}

function enemyDefeated() {
    log(`Defeated ${enemy.name}!`, 'log-kill');
    
    let stageKey = `${state.world}-${state.stage}`;
    let clearCount = state.clearCounts[stageKey] || 0;
    
    // XP Calculation
    let baseXp = 15 * Math.pow(1.3, state.world - 1) * Math.pow(1.1, state.stage);
    let earnedXp = baseXp / Math.pow(2, clearCount); 
    
    if (earnedXp > 0.01) {
        state.xp += earnedXp;
        stageRewards.xp += earnedXp;
        log(`+${formatNumber(earnedXp)} XP`, 'log-loot');
        checkLevelUp();
    }
    
    // Dust Calculation
    let dustDrop = 0.5 * Math.pow(1.5, state.world - 1) * Math.pow(1.1, state.stage);
    state.goldDust += dustDrop;
    stageRewards.dust += dustDrop;
    log(`Found ${formatNumber(dustDrop)} Dust.`);
    
    // Materials
    if(Math.random() > 0.5) { state.iron++; stageRewards.iron++; }
    if(Math.random() > 0.8) { state.core++; stageRewards.core++; }

    // BOSS SATS LOGIC (Fixed to prevent farming)
    if (state.stage % 10 === 0 && state.wave === 3) {
        let bossKey = `boss_${state.world}_${state.stage}`;
        if (!state.satsClaimed[bossKey]) {
            state.sats += 10;
            state.satsClaimed[bossKey] = true;
            log('First Boss Clear! +10 Sats!', 'log-kill');
        }
    }

    state.wave++;
    if (state.wave > 3) {
        // STAGE CLEARED - SHOW MODAL
        state.clearCounts[stageKey] = clearCount + 1; 
        state.wave = 1;
        isBattling = false; // Pause combat
        
        // Populate Modal Data
        document.getElementById('modal-stage').innerText = formatNumber(state.stage);
        document.getElementById('modal-level').innerText = formatNumber(state.level);
        document.getElementById('modal-hp').innerText = formatNumber(state.stats.maxHp);
        document.getElementById('modal-atk').innerText = formatNumber(state.stats.atk);
        document.getElementById('modal-def').innerText = formatNumber(state.stats.def);
        document.getElementById('modal-crit').innerText = formatNumber(state.stats.crit);
        
        document.getElementById('modal-dust').innerText = formatNumber(stageRewards.dust);
        document.getElementById('modal-xp').innerText = formatNumber(stageRewards.xp);
        document.getElementById('modal-iron').innerText = formatNumber(stageRewards.iron);
        document.getElementById('modal-core').innerText = formatNumber(stageRewards.core);

        // Configure Next Button text
        let nextCost = getStageCost(state.stage + 1);
        let nextBtn = document.getElementById('btn-next-stage');
        if (nextCost > 0) {
            nextBtn.innerText = `Unlock Stage ${state.stage + 1} (Cost: ${formatNumber(nextCost)} ✨)`;
        } else {
            nextBtn.innerText = `Proceed to Stage ${state.stage + 1} (Free)`;
        }
        
        // Reset Mini-game UI
        document.getElementById('modal-minigame-ui').classList.add('hidden');
        document.getElementById('modal-normal-actions').classList.remove('hidden');
        document.getElementById('next-stage-error').innerText = ''; 
        
        document.getElementById('stage-clear-modal').classList.remove('hidden');
        saveGame();
        return; // Stops spawnEnemy from running immediately
    }
    
    saveGame();
    setTimeout(spawnEnemy, 1000);
}

// --- MINI-GAME LOGIC ---
let mgAnim;
let mgPos = 0;
let mgDir = 2; // Speed
let mgProgress = 0;

function startMiniGame() {
    document.getElementById('modal-normal-actions').classList.add('hidden');
    document.getElementById('modal-minigame-ui').classList.remove('hidden');
    document.getElementById('mg-feedback').innerText = "Wait for the Green Zone...";
    document.getElementById('mg-feedback').style.color = "#ccc";
    mgProgress = 0;
    document.getElementById('mg-progress-fill').style.width = '0%';
    mgPos = 0;
    mgDir = 2 + (Math.random() * 1.5); // Randomize initial speed
    mgLoop();
}

function mgLoop() {
    mgPos += mgDir;
    if (mgPos > 98) { mgPos = 98; mgDir *= -1; }
    if (mgPos < 0) { mgPos = 0; mgDir *= -1; }
    document.getElementById('mg-cursor').style.left = mgPos + '%';
    mgAnim = requestAnimationFrame(mgLoop);
}

function mgTap() {
    // Green Zone is exactly between 40% and 60%
    if (mgPos >= 40 && mgPos <= 60) {
        mgProgress += 34; // Needs 3 hits to hit 100
        document.getElementById('mg-progress-fill').style.width = mgProgress + '%';
        document.getElementById('mg-feedback').innerText = "NICE HIT!";
        document.getElementById('mg-feedback').style.color = "#4caf50";
        
        // Make it slightly faster/harder on success
        mgDir = (Math.abs(mgDir) + 0.8) * Math.sign(mgDir);

        if (mgProgress >= 100) {
            mgWin();
        }
    } else {
        document.getElementById('mg-feedback').innerText = "MISS! Try Again!";
        document.getElementById('mg-feedback').style.color = "#ff3b3b";
    }
}

function mgWin() {
    cancelAnimationFrame(mgAnim);
    let multi = Math.floor(Math.random() * 4) + 2; // Random multiplier 2x to 5x
    
    // Apply Bonus (Stage Rewards * (multi - 1) because they already got the base 1x)
    let bonusDust = stageRewards.dust * (multi - 1);
    let bonusXp = stageRewards.xp * (multi - 1);
    let bonusIron = stageRewards.iron * (multi - 1);
    let bonusCore = stageRewards.core * (multi - 1);

    state.goldDust += bonusDust;
    state.xp += bonusXp;
    state.iron += bonusIron;
    state.core += bonusCore;
    
    checkLevelUp(); // If bonus XP levels them up
    updateDOM();

    document.getElementById('mg-feedback').innerText = `SUCCESS! ${multi}X REWARDS CLAIMED!`;
    document.getElementById('mg-feedback').style.color = "#f9a826";
    log(`Mini-Game Win! Gained ${multi}x Multiplier!`, 'log-boss');
    
    saveGame();

    // Auto-advance logic after 2 seconds
    setTimeout(() => {
        document.getElementById('stage-clear-modal').classList.add('hidden');
        let nextCost = getStageCost(state.stage + 1);
        
        if (state.goldDust >= nextCost) {
            handleNextStage();
        } else {
            handleReplayStage();
        }
    }, 2000);
}

// --- NAVIGATION CONTROLS ---
function handleNextStage() {
    let nextCost = getStageCost(state.stage + 1);
    if (state.goldDust >= nextCost) {
        if (nextCost > 0) state.goldDust -= nextCost;
        state.stage++;
        if (state.stage > state.highestStage) state.highestStage = state.stage;
        
        document.getElementById('stage-clear-modal').classList.add('hidden');
        if (state.stage > 50) { triggerWorldTransition(); return; }
        
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
    isBattling = false; 
}

function returnFromHub() {
    document.getElementById('game-container').classList.remove('hub-mode');
    document.getElementById('hub-nav').classList.add('hidden');
    isBattling = true;
    spawnEnemy();
}

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
                returnFromHub(); 
            };
        }
        grid.appendChild(node);
    }
}

function closeMap() { document.getElementById('map-view').classList.add('hidden'); }

function triggerWorldTransition() {
    isBattling = false;
    state.world++; state.stage = 1; state.highestStage = 1; state.wave = 1;
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

// --- CRAFTING ---
const upgradesData = [
    { id: 'atk', name: 'Sharpen Weapon', stat: 'ATK', baseDust: 0.5, baseIron: 2, scale: 1.5, boost: 5 },
    { id: 'hp', name: 'Fortify Armor', stat: 'Max HP', baseDust: 0.5, baseIron: 2, scale: 1.5, boost: 20 },
    { id: 'def', name: 'Thick Plating', stat: 'DEF', baseDust: 0.5, baseIron: 5, scale: 1.6, boost: 2 },
    { id: 'crit', name: 'Focus Lens', stat: 'CRIT', baseDust: 1, baseCore: 1, scale: 2.0, boost: 1 }, 
    { id: 'regen', name: 'Healing Aura', stat: 'REGEN', baseDust: 2, baseCore: 2, scale: 1.8, boost: 1 }
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
        state.goldDust -= costDust; state.iron -= costIron; state.core -= costCore;
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

function spawnText(target, text, cssClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${cssClass}`;
    el.innerText = text;
    el.style.left = target === 'player' ? '25%' : '75%';
    el.style.top = '40%';
    document.getElementById('fx-container').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

loadGame();
if (document.getElementById('offline-modal').classList.contains('hidden')) isBattling = true; 
spawnEnemy();
setInterval(combatTick, 2000); 
setInterval(saveGame, 10000);

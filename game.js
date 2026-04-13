// --- STATE MANAGEMENT ---
let player = { hp: 100, maxHp: 100, atk: 10 };
let enemy = { name: 'Slime', hp: 30, maxHp: 30, atk: 2 };
let stage = 1;
let wave = 1;
let inventory = { iron: 0, core: 0 };
let satsBank = 0; // Local mock for the bank until server is needed

// --- DOM ELEMENTS ---
const elLog = document.getElementById('combat-log');
const elStage = document.getElementById('stage-display');
const elWave = document.getElementById('wave-display');
const elPlayerHp = document.getElementById('player-hp');
const elPlayerMaxHp = document.getElementById('player-max-hp');
const elPlayerHpFill = document.getElementById('player-hp-fill');
const elPlayerAtk = document.getElementById('player-atk');
const elEnemyName = document.getElementById('enemy-name');
const elEnemyHp = document.getElementById('enemy-hp');
const elEnemyMaxHp = document.getElementById('enemy-max-hp');
const elEnemyHpFill = document.getElementById('enemy-hp-fill');
const elInvIron = document.getElementById('inv-iron');
const elInvCore = document.getElementById('inv-core');
const elSats = document.getElementById('sats-balance');

const playerSprite = document.getElementById('player-sprite');
const enemySprite = document.getElementById('enemy-sprite');
const fxContainer = document.getElementById('fx-container');

// --- UTILITY FUNCTIONS ---

function updateDOM() {
    elStage.innerText = stage;
    elWave.innerText = wave;
    elPlayerHp.innerText = player.hp;
    elPlayerMaxHp.innerText = player.maxHp;
    elPlayerAtk.innerText = player.atk;
    elEnemyName.innerText = enemy.name;
    elEnemyHp.innerText = enemy.hp;
    elEnemyMaxHp.innerText = enemy.maxHp;
    elInvIron.innerText = inventory.iron;
    elInvCore.innerText = inventory.core;
    elSats.innerText = satsBank;

    // Update Health Bar Widths dynamically
    const playerHpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    elPlayerHpFill.style.width = playerHpPercent + '%';

    const enemyHpPercent = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    elEnemyHpFill.style.width = enemyHpPercent + '%';
}

function log(message, type = 'log-attack') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = message;
    elLog.appendChild(entry);
    elLog.scrollTop = elLog.scrollHeight; // Auto-scroll to bottom
}

// Spawns floating damage numbers over characters
function spawnFloatingText(target, text, cssClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${cssClass}`;
    el.innerText = text;

    // Position based on target (left for player, right for enemy)
    if (target === 'player') {
        el.style.left = '25%'; 
    } else {
        el.style.left = '75%';
    }
    el.style.top = '50%'; // Middle of battle scene

    fxContainer.appendChild(el);

    // Remove element after animation finishes (1 second)
    setTimeout(() => {
        el.remove();
    }, 1000);
}

// --- GAME LOGIC ---

function spawnEnemy() {
    const isBoss = stage % 10 === 0 && wave === 3;
    
    if (isBoss) {
        enemy = {
            name: `Boss Stage ${stage}`,
            maxHp: 100 * stage,
            hp: 100 * stage,
            atk: 5 * stage
        };
        // Change sprite visually for Boss (Uses a different dicebear seed)
        enemySprite.style.backgroundImage = "url('https://api.dicebear.com/7.x/bottts/svg?seed=Boss&backgroundColor=transparent')";
        enemySprite.style.filter = "drop-shadow(0 0 15px rgba(255,0,255,0.8))";
        enemySprite.style.transform = "scaleX(-1) scale(1.3)"; // Make boss bigger
        
        log(`WARNING: ${enemy.name} approaches!`, 'log-boss');
    } else {
        enemy = {
            name: `Monster Lvl ${stage}`,
            maxHp: 20 * stage + (wave * 5),
            hp: 20 * stage + (wave * 5),
            atk: 2 * stage
        };
        // Reset normal enemy sprite
        enemySprite.style.backgroundImage = "url('https://api.dicebear.com/7.x/bottts/svg?seed=" + stage + wave + "&backgroundColor=transparent')";
        enemySprite.style.filter = "drop-shadow(0 0 10px rgba(255,0,0,0.4))";
        enemySprite.style.transform = "scaleX(-1) scale(1)";
    }
    updateDOM();
}

function dropLoot() {
    if (Math.random() > 0.4) {
        inventory.iron += 1;
        log('Found 1 Scrap Iron!', 'log-loot');
    }
    if (Math.random() > 0.7) {
        inventory.core += 1;
        log('Found 1 Monster Core!', 'log-loot');
    }
}

function claimBossReward() {
    // Mocking the backend reward for pure visual testing
    satsBank += 10;
    log(`Victory! Earned 10 Sats.`, 'log-kill');
    updateDOM();
}

// The core turn-based combat loop
function combatTick() {
    // --- PLAYER ATTACK PHASE ---
    playerSprite.classList.add('attack-right');
    enemySprite.classList.add('take-damage');
    
    setTimeout(() => {
        playerSprite.classList.remove('attack-right');
        enemySprite.classList.remove('take-damage');
    }, 300);

    enemy.hp -= player.atk;
    spawnFloatingText('enemy', `-${player.atk}`, 'dmg-enemy');
    log(`Hero dealt ${player.atk} damage to ${enemy.name}.`);

    if (enemy.hp <= 0) {
        enemy.hp = 0;
        updateDOM();
        log(`Defeated ${enemy.name}!`, 'log-kill');
        dropLoot();
        
        if (stage % 10 === 0 && wave === 3) {
            claimBossReward();
        }

        wave++;
        if (wave > 3) {
            wave = 1;
            stage++;
            log(`Advanced to Stage ${stage}!`, 'log-loot');
        }
        
        setTimeout(spawnEnemy, 1000); // Wait a second before next enemy
        return; // End tick here
    }

    // --- ENEMY ATTACK PHASE ---
    // Delay enemy attack slightly for visual rhythm
    setTimeout(() => {
        if (enemy.hp > 0) {
            enemySprite.classList.add('attack-left');
            playerSprite.classList.add('take-damage');
            
            setTimeout(() => {
                enemySprite.classList.remove('attack-left');
                playerSprite.classList.remove('take-damage');
            }, 300);

            player.hp -= enemy.atk;
            spawnFloatingText('player', `-${enemy.atk}`, 'dmg-player');
            log(`${enemy.name} dealt ${enemy.atk} damage to you.`);

            if (player.hp <= 0) {
                player.hp = 0;
                log('You fell in battle... Reviving at Stage 1.', 'log-boss');
                stage = 1;
                wave = 1;
                player.hp = player.maxHp;
                setTimeout(spawnEnemy, 1500);
            }
            updateDOM();
        }
    }, 750); 
    
    updateDOM();
}

// --- CRAFTING (Exposed to Global Scope for HTML Buttons) ---
window.craftItem = function(item) {
    if (item === 'sword' && inventory.iron >= 5) {
        inventory.iron -= 5;
        player.atk += 10;
        log('Crafted Iron Sword! ATK +10', 'log-loot');
        spawnFloatingText('player', '+10 ATK', 'heal-text');
    } else if (item === 'potion' && inventory.core >= 2) {
        if (player.hp === player.maxHp) {
            log('HP is already full.', 'log-attack');
            return;
        }
        inventory.core -= 2;
        player.hp = Math.min(player.hp + 50, player.maxHp);
        log('Drank Potion! Healed 50 HP.', 'log-loot');
        spawnFloatingText('player', '+50 HP', 'heal-text');
    } else {
        log('Not enough materials.', 'log-attack');
    }
    updateDOM();
};

// --- INITIALIZE GAME ---
spawnEnemy();
// Run combat tick every 2 seconds to allow animations to play smoothly
setInterval(combatTick, 2000);

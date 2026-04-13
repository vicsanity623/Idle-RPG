// Change this to your iMac's IP address later (e.g., http://192.168.1.5:3000)
// For local testing, localhost works.
const SERVER_URL = 'http://localhost:3000'; 

// Game State
let player = { hp: 100, maxHp: 100, atk: 10 };
let enemy = { name: 'Slime', hp: 30, maxHp: 30, atk: 2 };
let stage = 1;
let wave = 1;
let inventory = { iron: 0, core: 0 };

// DOM Elements
const logEl = document.getElementById('combat-log');
const updateDOM = () => {
    document.getElementById('stage-display').innerText = stage;
    document.getElementById('wave-display').innerText = wave;
    document.getElementById('player-hp').innerText = player.hp;
    document.getElementById('player-max-hp').innerText = player.maxHp;
    document.getElementById('player-atk').innerText = player.atk;
    document.getElementById('enemy-name').innerText = enemy.name;
    document.getElementById('enemy-hp').innerText = enemy.hp;
    document.getElementById('enemy-max-hp').innerText = enemy.maxHp;
    document.getElementById('inv-iron').innerText = inventory.iron;
    document.getElementById('inv-core').innerText = inventory.core;
};

function log(message) {
    logEl.innerHTML += `<div>${message}</div>`;
    logEl.scrollTop = logEl.scrollHeight; // Auto-scroll
}

// Spawn Enemy Logic
function spawnEnemy() {
    let isBoss = stage % 10 === 0 && wave === 3; // Boss every 10 stages on wave 3
    
    if (isBoss) {
        enemy = {
            name: `Boss Stage ${stage}`,
            maxHp: 100 * stage,
            hp: 100 * stage,
            atk: 5 * stage
        };
        log(`<b>WARNING: A Boss approaches!</b>`);
    } else {
        enemy = {
            name: `Monster Lvl ${stage}`,
            maxHp: 20 * stage + (wave * 5),
            hp: 20 * stage + (wave * 5),
            atk: 2 * stage
        };
    }
    updateDOM();
}

// Loot Drops
function dropLoot() {
    if (Math.random() > 0.5) {
        inventory.iron += 1;
        log('Found 1 Scrap Iron!');
    }
    if (Math.random() > 0.8) {
        inventory.core += 1;
        log('Found 1 Monster Core!');
    }
}

// API Call to Node.js Backend to earn BTC/Sats
async function claimBossReward() {
    try {
        const response = await fetch(`${SERVER_URL}/api/reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: stage })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('sats-balance').innerText = data.newSats;
            log(`<span style="color: #f9a826;">Earned 10 Sats! Total: ${data.newSats}</span>`);
        }
    } catch (err) {
        log('<span style="color:red;">Error connecting to node for BTC reward.</span>');
    }
}

// Main Combat Loop (Runs every 1.5 seconds)
function combatTick() {
    // Player attacks
    enemy.hp -= player.atk;
    log(`You dealt ${player.atk} damage to ${enemy.name}.`);

    if (enemy.hp <= 0) {
        enemy.hp = 0;
        log(`Defeated ${enemy.name}!`);
        dropLoot();
        
        if (stage % 10 === 0 && wave === 3) {
            claimBossReward(); // Earn crypto on boss kills!
        }

        wave++;
        if (wave > 3) {
            wave = 1;
            stage++;
            log(`<b>Advanced to Stage ${stage}!</b>`);
        }
        spawnEnemy();
        return; // Skip enemy attack if dead
    }

    // Enemy attacks
    player.hp -= enemy.atk;
    log(`${enemy.name} dealt ${enemy.atk} damage to you.`);

    if (player.hp <= 0) {
        player.hp = 0;
        log('<span style="color:red;">You died... Reviving at Stage 1.</span>');
        // Punish death by resetting stage (roguelite mechanic)
        stage = 1;
        wave = 1;
        player.hp = player.maxHp;
        spawnEnemy();
    }
    updateDOM();
}

// Crafting Mechanics
window.craftItem = function(item) {
    if (item === 'sword' && inventory.iron >= 5) {
        inventory.iron -= 5;
        player.atk += 10;
        log('<span style="color:lightblue;">Crafted Iron Sword! ATK +10</span>');
    } else if (item === 'potion' && inventory.core >= 2) {
        inventory.core -= 2;
        player.hp = Math.min(player.hp + 50, player.maxHp);
        log('<span style="color:lightgreen;">Crafted Potion! Healed 50 HP.</span>');
    } else {
        log('<span style="color:gray;">Not enough materials to craft.</span>');
    }
    updateDOM();
}

// Start Game
spawnEnemy();
setInterval(combatTick, 1500); // 1.5 seconds per turn

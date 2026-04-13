/**
 * Idle Pal RPG - Endless Adventure Engine
 * Procedural infinite map, analog controls, manual combat, visual enhancements.
 */

// --- CONFIG & STATE ---
const TILE_SIZE = 50;
const STATES = { WANDERING: 0, BATTLING: 1, MENU: 2 };
const TYPES = {
    'Grass': { color: '#66BB6A', weak: 'Fire', strong: 'Water' },
    'Fire':  { color: '#EF5350', weak: 'Water', strong: 'Grass' },
    'Water': { color: '#42A5F5', weak: 'Grass', strong: 'Fire' }
};
const PAL_NAMES = {
    'Grass': ['LeafSaur', 'MossFox', 'VineSnake', 'PetalBear'],
    'Fire':  ['EmberTail', 'FlamePup', 'AshBird', 'LavaToad'],
    'Water': ['AquaTurtle', 'TideSeal', 'ShellCrab', 'WaveDolphin']
};

let state = {
    lastSave: Date.now(),
    gold: 0, badges: 0, stones: 0, maxLevelReached: 1,
    pals: [], activePalIndex: 0,
    upgrades: { catchRate: 0, speed: 0, heal: 0 }
};

let engine = {
    state: STATES.WANDERING,
    camX: 0, camY: 0,
    player: { x: 10, y: 10, vx: 0, vy: 0, radius: 15 },
    wildPal: null,
    itemsMap: new Map(), // spatial hash for dynamic items
    particles: [],
    floatingTexts: [],
    time: 0,
    joystick: { active: false, id: null, originX: 0, originY: 0, dx: 0, dy: 0 },
    battleCooldown: false
};

// --- PROCEDURAL GENERATION (Value Noise) ---
function hash(x, y) {
    let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return h - Math.floor(h);
}
function noise(x, y) {
    let ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    let v1 = hash(ix, iy), v2 = hash(ix + 1, iy);
    let v3 = hash(ix, iy + 1), v4 = hash(ix + 1, iy + 1);
    let i1 = v1 * (1 - fx) + v2 * fx;
    let i2 = v3 * (1 - fx) + v4 * fx;
    return i1 * (1 - fy) + i2 * fy;
}
function getTile(tx, ty) {
    let n = noise(tx * 0.15, ty * 0.15);
    // 0: Path, 1: Grass, 2: Water, 3: Tree
    if (n < 0.25) return 2; // Water
    if (n < 0.50) return 0; // Path
    if (n < 0.75) return 1; // Grass
    return 3; // Tree
}

// Item Discovery
function checkTileItem(tx, ty) {
    let key = `${tx},${ty}`;
    if (!engine.itemsMap.has(key)) {
        // 1% chance for an Evo Stone to spawn on newly discovered Path/Grass
        let t = getTile(tx, ty);
        if ((t === 0 || t === 1) && hash(tx * 3.1, ty * 7.2) < 0.01) {
            engine.itemsMap.set(key, { type: 'stone', collected: false });
        } else {
            engine.itemsMap.set(key, { type: 'none' }); // mark searched
        }
    }
    let item = engine.itemsMap.get(key);
    if (item && item.type === 'stone' && !item.collected) {
        item.collected = true;
        state.stones++;
        spawnParticles(tx*TILE_SIZE + 25, ty*TILE_SIZE + 25, '#9C27B0', 10);
        addFloatingText(300, 250, "+1 Evo Stone!", '#E040FB');
        updateUI();
    }
}

// --- ENTITIES & MECHANICS ---
function generatePal(level, isStarter = false) {
    const typesArr = Object.keys(TYPES);
    const type = typesArr[Math.floor(Math.random() * typesArr.length)];
    const name = PAL_NAMES[type][Math.floor(Math.random() * PAL_NAMES[type].length)];
    const badgeMult = 1 + (state.badges * 0.5); 
    
    return {
        id: Date.now() + Math.random(),
        name: isStarter ? "Starter " + name : name,
        type: type,
        level: level,
        exp: 0, maxExp: Math.floor(100 * Math.pow(1.1, level)),
        hp: Math.floor(50 * Math.pow(1.1, level) * badgeMult),
        maxHp: Math.floor(50 * Math.pow(1.1, level) * badgeMult),
        atk: Math.floor(10 * Math.pow(1.1, level) * badgeMult),
        def: Math.floor(5 * Math.pow(1.1, level) * badgeMult),
        evo: 0
    };
}

function evolvePal(pal) {
    if (state.stones >= 3) {
        state.stones -= 3;
        pal.evo++;
        pal.name = "Super " + pal.name.replace("Starter ", "").replace("Super ", "");
        pal.maxHp *= 2; pal.hp = pal.maxHp;
        pal.atk *= 2; pal.def *= 2;
        addFloatingText(300, 200, "EVOLVED!", '#E040FB');
        updateUI();
        saveGame();
    }
}

function checkLevelUp(pal) {
    while (pal.exp >= pal.maxExp) {
        pal.exp -= pal.maxExp;
        pal.level++;
        if(pal.level > state.maxLevelReached) state.maxLevelReached = pal.level;
        pal.maxExp = Math.floor(100 * Math.pow(1.1, pal.level));
        let scale = Math.pow(1.1, pal.level) * Math.pow(2, pal.evo) * (1 + state.badges * 0.5);
        pal.maxHp = Math.floor(50 * scale); pal.hp = pal.maxHp;
        pal.atk = Math.floor(10 * scale);
        pal.def = Math.floor(5 * scale);
        logAction(`${pal.name} reached Lvl ${pal.level}!`);
    }
}

// --- SAVE / OFFLINE ---
function saveGame() {
    state.lastSave = Date.now();
    localStorage.setItem('idlePalEndless', JSON.stringify(state));
}
function loadGame() {
    let saved = localStorage.getItem('idlePalEndless');
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
        if(!state.stones) state.stones = 0;
        if(!state.maxLevelReached) state.maxLevelReached = 1;
        calcOffline();
    } else {
        state.pals.push(generatePal(1, true));
    }
    updateUI();
}
function calcOffline() {
    let diff = Math.max(0, Math.floor((Date.now() - state.lastSave) / 1000));
if (diff < 0) {
  console.error("Negative time difference detected. Resetting last save time.");
  state.lastSave = Date.now();
  diff = 0;
}
    if (diff > 60) {
        let active = state.pals[state.activePalIndex];
        let simBattles = Math.floor(diff / 10);
        let goldGain = simBattles * Math.floor(5 * active.level);
        let xpGain = simBattles * Math.floor(15 * active.level);
        state.gold += goldGain;
        active.exp += xpGain;
        checkLevelUp(active);
        
        document.getElementById('offline-time').innerText = `${Math.floor(diff/3600)}h ${Math.floor((diff%3600)/60)}m`;
        document.getElementById('offline-gold').innerText = goldGain;
        document.getElementById('offline-xp').innerText = xpGain;
        document.getElementById('offline-modal').classList.remove('hidden');
    }
}

// --- INPUT & CONTROLS ---
const joyZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
const joyHint = document.getElementById('joystick-hint');

function handleJoyStart(e) {
    if(engine.state !== STATES.WANDERING) return;
    let touch = e.touches ? e.touches[0] : e;
    engine.joystick.active = true;
    engine.joystick.id = e.touches ? touch.identifier : 'mouse';
    engine.joystick.originX = touch.clientX;
    engine.joystick.originY = touch.clientY;
    
    joyBase.classList.remove('hidden');
    joyBase.style.left = touch.clientX + 'px';
    joyBase.style.top = touch.clientY + 'px';
    joyKnob.style.transform = `translate(-50%, -50%)`;
    joyHint.classList.add('hidden');
}
function handleJoyMove(e) {
    if(!engine.joystick.active || engine.state !== STATES.WANDERING) return;
    let touch = e.touches ? Array.from(e.touches).find(t => t.identifier === engine.joystick.id) : e;
    if(!touch) return;
    
    let dx = touch.clientX - engine.joystick.originX;
    let dy = touch.clientY - engine.joystick.originY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let maxDist = 40;
    
    if(dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    
    // Normalize for game velocity (-1 to 1)
    engine.joystick.dx = dx / maxDist;
    engine.joystick.dy = dy / maxDist;
}
function handleJoyEnd(e) {
    if(e.touches) {
        let touch = Array.from(e.changedTouches).find(t => t.identifier === engine.joystick.id);
        if(!touch) return;
    }
    engine.joystick.active = false;
    engine.joystick.dx = 0; engine.joystick.dy = 0;
    joyBase.classList.add('hidden');
}

joyZone.addEventListener('mousedown', handleJoyStart);
window.addEventListener('mousemove', handleJoyMove);
window.addEventListener('mouseup', handleJoyEnd);
joyZone.addEventListener('touchstart', handleJoyStart, {passive: false});
window.addEventListener('touchmove', handleJoyMove, {passive: false});
window.addEventListener('touchend', handleJoyEnd);

// --- COMBAT SYSTEM ---
function startBattle() {
    engine.state = STATES.BATTLING;
    engine.battleCooldown = false;
    engine.joystick.active = false; joyBase.classList.add('hidden');
    
    let active = state.pals[state.activePalIndex];
    let wildLevel = Math.max(1, active.level + Math.floor(Math.random()*3 - 1));
    engine.wildPal = generatePal(wildLevel);
    
    document.getElementById('battle-ui').classList.remove('hidden');
    updateBattleUI();
    logAction(`A wild ${engine.wildPal.name} leaps from the grass!`);
}

function processTurn(action) {
    if(engine.battleCooldown || engine.state !== STATES.BATTLING) return;
    engine.battleCooldown = true;
    let active = state.pals[state.activePalIndex];
    let wild = engine.wildPal;

    if(action === 'run') {
        logAction("Got away safely!");
        endBattle(false);
        return;
    }

    if(action === 'catch') {
        let chance = 0.2 + (state.upgrades.catchRate * 0.05);
        if(Math.random() < chance) {
            wild.hp = wild.maxHp;
            if(state.pals.length < 20) {
                state.pals.push(wild);
                logAction(`Caught ${wild.name}!`);
            } else {
                state.gold += 100;
                logAction(`Box full! Sold ${wild.name} for 100G.`);
            }
            spawnParticles(450, 200, '#FFCA28', 20);
            setTimeout(() => endBattle(true, false), 1000);
            return;
        } else {
            addFloatingText(450, 150, "Broke free!", '#fff');
        }
    }

    if(action === 'attack') {
        // Player attacks
        spawnParticles(450, 200, TYPES[active.type].color, 10);
        let mult = TYPES[active.type].strong === wild.type ? 1.5 : TYPES[active.type].weak === wild.type ? 0.5 : 1;
        let dmg = Math.max(1, Math.floor((active.atk * mult) - (wild.def * 0.5)));
        wild.hp -= dmg;
        addFloatingText(450, 180, `-${dmg}`, mult > 1 ? '#FFCA28' : '#fff');
        
        if(wild.hp <= 0) {
            wild.hp = 0; updateBattleUI();
            setTimeout(() => endBattle(true, true), 1000);
            return;
        }
    }

    // Enemy attacks back after delay
    updateBattleUI();
    setTimeout(() => {
        spawnParticles(150, 400, TYPES[wild.type].color, 10);
        let mult = TYPES[wild.type].strong === active.type ? 1.5 : TYPES[wild.type].weak === active.type ? 0.5 : 1;
        let dmg = Math.max(1, Math.floor((wild.atk * mult) - (active.def * 0.5)));
        active.hp -= dmg;
        addFloatingText(150, 380, `-${dmg}`, '#ff0000');
        
        if(active.hp <= 0) {
            active.hp = 0; updateBattleUI();
            logAction(`${active.name} fainted!`);
            setTimeout(() => endBattle(false), 1000);
        } else {
            updateBattleUI();
            engine.battleCooldown = false;
        }
    }, 800);
}

function endBattle(won, gaveExp = false) {
    document.getElementById('battle-ui').classList.add('hidden');
    if(won && gaveExp) {
        let active = state.pals[state.activePalIndex];
        let xpGain = Math.floor(20 * engine.wildPal.level);
        let goldGain = Math.floor(10 * engine.wildPal.level * (1 + state.badges * 0.5));
        active.exp += xpGain; state.gold += goldGain;
        logAction(`Won! +${goldGain}G, +${xpGain}XP`);
        checkLevelUp(active);
    }
    engine.wildPal = null;
    engine.state = STATES.WANDERING;
    engine.battleCooldown = false;
    updateUI(); saveGame();
}

document.getElementById('btn-attack').onclick = () => processTurn('attack');
document.getElementById('btn-catch').onclick = () => processTurn('catch');
document.getElementById('btn-run').onclick = () => processTurn('run');

// --- UPDATE LOOP ---
function updatePlayer(dt) {
    let speed = 150 + (state.upgrades.speed * 20);
    let px = engine.joystick.dx * speed * (dt/1000);
    let py = engine.joystick.dy * speed * (dt/1000);
    
    if(px !== 0 || py !== 0) {
        let newX = engine.player.x + px/TILE_SIZE;
        let newY = engine.player.y + py/TILE_SIZE;
        
        // Collision (Circle-to-Grid rough check)
        let r = 0.3; // player radius in tiles
        if(getTile(Math.floor(newX+r), Math.floor(engine.player.y)) !== 2 && getTile(Math.floor(newX+r), Math.floor(engine.player.y)) !== 3 &&
           getTile(Math.floor(newX-r), Math.floor(engine.player.y)) !== 2 && getTile(Math.floor(newX-r), Math.floor(engine.player.y)) !== 3) {
            engine.player.x = newX;
        }
        if(getTile(Math.floor(engine.player.x), Math.floor(newY+r)) !== 2 && getTile(Math.floor(engine.player.x), Math.floor(newY+r)) !== 3 &&
           getTile(Math.floor(engine.player.x), Math.floor(newY-r)) !== 2 && getTile(Math.floor(engine.player.x), Math.floor(newY-r)) !== 3) {
            engine.player.y = newY;
        }
        
        // Items & Encounters
        let tx = Math.floor(engine.player.x), ty = Math.floor(engine.player.y);
        checkTileItem(tx, ty);
        
        if(getTile(tx, ty) === 1) { // In Grass
            if(Math.random() < 0.05 * (dt/1000)) spawnParticles(300, 300, '#81C784', 1); // Grass rustle
            if(state.pals[state.activePalIndex].hp > 0 && Math.random() < 0.25 * (dt/1000)) {
                startBattle();
            }
        }
    }
    
    // Auto Heal
    let active = state.pals[state.activePalIndex];
    if(active.hp > 0 && active.hp < active.maxHp) {
        active.hp += (active.maxHp * 0.05) * (1 + state.upgrades.heal) * (dt/1000);
        if(active.hp > active.maxHp) active.hp = active.maxHp;
    }
}

function updateParticles(dt) {
    for(let i = engine.particles.length-1; i >= 0; i--) {
        let p = engine.particles[i];
        p.x += p.vx * (dt/10); p.y += p.vy * (dt/10);
        p.life -= dt/1000;
        if(p.life <= 0) engine.particles.splice(i, 1);
    }
    for(let i = engine.floatingTexts.length-1; i >= 0; i--) {
        let f = engine.floatingTexts[i];
        f.y -= 20 * (dt/1000); f.life -= dt/1000;
        if(f.life <= 0) engine.floatingTexts.splice(i, 1);
    }
}

// --- GRAPHICS & RENDERING ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function drawShadow(x, y, w, h, radius=50) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI*2); ctx.fill();
}

function renderWorld() {
    engine.camX = engine.player.x * TILE_SIZE - canvas.width/2;
    engine.camY = engine.player.y * TILE_SIZE - canvas.height/2;
    
    let startTX = Math.floor(engine.camX / TILE_SIZE) - 1;
    let startTY = Math.floor(engine.camY / TILE_SIZE) - 1;
    let endTX = startTX + Math.ceil(canvas.width / TILE_SIZE) + 2;
    let endTY = startTY + Math.ceil(canvas.height / TILE_SIZE) + 2;
    
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(0,0,canvas.width,canvas.height);
    
    // Draw Base Terrain (Path, Grass, Water)
    for(let y=startTY; y<=endTY; y++) {
        for(let x=startTX; x<=endTX; x++) {
            let t = getTile(x, y);
            let drawX = x * TILE_SIZE - engine.camX;
            let drawY = y * TILE_SIZE - engine.camY;
            
            if(t===0) { ctx.fillStyle = '#E6C280'; ctx.fillRect(drawX, drawY, TILE_SIZE+1, TILE_SIZE+1); } // Path
            else if(t===1) { // Grass
                ctx.fillStyle = '#66BB6A'; ctx.fillRect(drawX, drawY, TILE_SIZE+1, TILE_SIZE+1);
                ctx.fillStyle = '#43A047'; ctx.fillRect(drawX+10, drawY+10, 4, 8); ctx.fillRect(drawX+30, drawY+25, 4, 8);
            }
            else if(t===2) { // Water
                ctx.fillStyle = '#42A5F5'; ctx.fillRect(drawX, drawY, TILE_SIZE+1, TILE_SIZE+1);
                let waveOffset = Math.sin(engine.time/300 + x + y)*5;
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(drawX+10, drawY+20+waveOffset, 20, 3);
            }
        }
    }
    
    // Draw Items
    engine.itemsMap.forEach((item, key) => {
        if(item.type === 'stone' && !item.collected) {
            let [tx, ty] = key.split(',').map(Number);
            let dx = tx * TILE_SIZE - engine.camX + TILE_SIZE/2;
            let dy = ty * TILE_SIZE - engine.camY + TILE_SIZE/2 + Math.sin(engine.time/200)*3;
            if(dx > -50 && dx < 650 && dy > -50 && dy < 650) {
                drawShadow(dx, dy+15, 10, 4);
                ctx.fillStyle = '#E040FB'; ctx.beginPath(); ctx.moveTo(dx, dy-10); ctx.lineTo(dx+8, dy); ctx.lineTo(dx, dy+10); ctx.lineTo(dx-8, dy); ctx.fill();
            }
        }
    });

    // Draw Player
    let px = canvas.width/2; let py = canvas.height/2;
    drawShadow(px, py+20, 15, 6);
    ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.roundRect(px-12, py-15 + Math.sin(engine.time/150)*2, 24, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(px-8, py-5 + Math.sin(engine.time/150)*2, 16, 8); // Visor

    // Draw Trees (on top for faux depth)
    for(let y=startTY; y<=endTY; y++) {
        for(let x=startTX; x<=endTX; x++) {
            if(getTile(x, y) === 3) {
                let drawX = x * TILE_SIZE - engine.camX + TILE_SIZE/2;
                let drawY = y * TILE_SIZE - engine.camY + TILE_SIZE/2;
                drawShadow(drawX, drawY+20, 20, 8);
                ctx.fillStyle = '#2E7D32';
                ctx.beginPath(); ctx.arc(drawX, drawY-10, 25, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(drawX-10, drawY+5, 20, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(drawX+10, drawY+5, 20, 0, Math.PI*2); ctx.fill();
            }
        }
    }
}

function renderBattle() {
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(0,0,canvas.width,canvas.height);
    
    // Diagonal background split
    ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(600,0); ctx.lineTo(0,400); ctx.fill();
    
    // Platforms
    drawShadow(450, 250, 80, 20); // Enemy
    drawShadow(150, 450, 100, 25); // Player

    let active = state.pals[state.activePalIndex];
    let wild = engine.wildPal;
    let breath = Math.sin(engine.time/300) * 5;

    // Draw Enemy
    ctx.fillStyle = TYPES[wild.type].color;
    ctx.beginPath(); ctx.roundRect(400, 150 - breath, 100, 100 + breath, 15); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(430, 180 - breath, 8, 0, Math.PI*2); ctx.arc(470, 180 - breath, 8, 0, Math.PI*2); ctx.fill();

    // Draw Player Pal
    ctx.fillStyle = TYPES[active.type].color;
    ctx.beginPath(); ctx.roundRect(100, 330 - breath, 100, 100 + breath, 15); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(170, 360 - breath, 8, 0, Math.PI*2); ctx.fill(); // looking right
}

function renderOverlay() {
    ctx.font = "14px 'Press Start 2P'"; ctx.textAlign = "center";
    engine.floatingTexts.forEach(ft => {
        ctx.fillStyle = ft.color; ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillText(ft.text, ft.x, ft.y); ctx.globalAlpha = 1.0;
    });

    engine.particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
    });
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        engine.particles.push({
            x: x, y: y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 0.5 + Math.random()*0.5, size: 2+Math.random()*4, color: color
        });
    }
}
function addFloatingText(x, y, text, color) { engine.floatingTexts.push({ x, y, text, color, life: 1.0 }); }
function logAction(msg) {
    let div = document.getElementById('action-log');
    let entry = document.createElement('div'); entry.className = 'log-entry'; entry.innerText = msg;
    div.prepend(entry); if(div.children.length > 5) div.lastChild.remove();
}

// --- MAIN LOOP ---
let lastTime = 0;
function loop(time) {
    let dt = time - lastTime; lastTime = time; engine.time = time;
    
    if(engine.state === STATES.WANDERING) { updatePlayer(dt); renderWorld(); }
    else if(engine.state === STATES.BATTLING) renderBattle();
    
    updateParticles(dt); renderOverlay();
    requestAnimationFrame(loop);
}

// --- UI LOGIC ---
function updateUI() {
    document.getElementById('gold-amount').innerText = state.gold;
    document.getElementById('stone-amount').innerText = state.stones;
    document.getElementById('pending-badges').innerText = state.maxLevelReached;
    
    let u = state.upgrades;
    document.getElementById('upg-catch-lvl').innerText = u.catchRate;
    document.getElementById('upg-catch-cost').innerText = Math.floor(10 * Math.pow(1.5, u.catchRate));
    document.getElementById('upg-speed-lvl').innerText = u.speed;
    document.getElementById('upg-speed-cost').innerText = Math.floor(50 * Math.pow(2.0, u.speed));
    document.getElementById('upg-heal-lvl').innerText = u.heal;
    document.getElementById('upg-heal-cost').innerText = Math.floor(100 * Math.pow(1.8, u.heal));

    const activeBtn = document.getElementById('active-evolve-btn');
    if(state.stones >= 3 && state.pals[state.activePalIndex].evo < 2) {
        activeBtn.classList.remove('hidden');
        activeBtn.onclick = () => evolvePal(state.pals[state.activePalIndex]);
    } else activeBtn.classList.add('hidden');

    renderPals();
}
function updateBattleUI() {
    if(engine.state !== STATES.BATTLING) return;
    let active = state.pals[state.activePalIndex], wild = engine.wildPal;
    document.getElementById('player-name').innerText = `${active.name} Lv.${active.level}`;
    document.getElementById('enemy-name').innerText = `Wild ${wild.name} Lv.${wild.level}`;
    document.getElementById('player-hp-bar').style.width = `${Math.max(0, active.hp/active.maxHp*100)}%`;
    document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, wild.hp/wild.maxHp*100)}%`;
}
function renderPals() {
    let aBox = document.getElementById('active-pal-card'), iBox = document.getElementById('pal-inventory');
    aBox.innerHTML = ''; iBox.innerHTML = ''; document.getElementById('pal-count').innerText = state.pals.length;

    state.pals.forEach((pal, idx) => {
        let html = `
            <div class="pal-header">
                <span>${pal.name} <span style="font-size:10px;color:var(--text-dim)">Lv.${pal.level}</span></span>
                <span class="pal-type" style="background:${TYPES[pal.type].color};color:#000;">${pal.type}</span>
            </div>
            <div class="pal-stats">HP: ${Math.floor(pal.hp)}/${pal.maxHp} | EXP: ${Math.floor((pal.exp/pal.maxExp)*100)}%<br>ATK: ${pal.atk} | DEF: ${pal.def}</div>
        `;
        let div = document.createElement('div'); div.className = `pal-card ${idx===state.activePalIndex?'active-pal':''}`;
        div.innerHTML = html;
        if(idx === state.activePalIndex) aBox.appendChild(div);
        else { div.onclick = () => { state.activePalIndex = idx; updateUI(); saveGame(); }; iBox.appendChild(div); }
    });
}

// Sidebar Buttons
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active'); document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    };
});
function buy(type, base, m) {
    let cost = Math.floor(base * Math.pow(m, state.upgrades[type]));
    if(state.gold >= cost) { state.gold -= cost; state.upgrades[type]++; updateUI(); saveGame(); }
}
document.getElementById('btn-upg-catch').onclick = () => buy('catchRate', 10, 1.5);
document.getElementById('btn-upg-speed').onclick = () => buy('speed', 50, 2.0);
document.getElementById('btn-upg-heal').onclick = () => buy('heal', 100, 1.8);

document.getElementById('btn-prestige').onclick = () => {
    if(state.maxLevelReached < 10) return alert("Reach Lvl 10 to prestige!");
    state.badges += state.maxLevelReached;
    state.gold = 0; state.stones = 0; state.maxLevelReached = 1;
    state.upgrades = { catchRate:0, speed:0, heal:0 };
    state.pals = [generatePal(1, true)]; state.activePalIndex = 0;
    saveGame(); updateUI(); logAction(`Prestiged! Now at ${state.badges} Badges.`);
};
document.getElementById('btn-hard-reset').onclick = () => {
    if(confirm("Delete ALL progress?")) { localStorage.removeItem('idlePalEndless'); location.reload(); }
};
document.getElementById('btn-claim-offline').onclick = () => document.getElementById('offline-modal').classList.add('hidden');

setInterval(() => { if(engine.state === STATES.WANDERING) { saveGame(); updateUI(); } }, 2000);

// --- INIT ---
loadGame();
requestAnimationFrame(t => { lastTime = t; loop(t); });

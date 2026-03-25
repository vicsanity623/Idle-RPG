/**
 * entities.js
 * Contains Enemy AI, Loot logic, and World Visual Effects.
 */

// --- WORLD SYSTEMS ---
const HiveMind = {
    flankWeight: 0,
    packSize: 0,
    update: function() {
        let count = 0;
        for (let i = 0; i < entities.length; i++) {
            if (entities[i] instanceof Enemy) count++;
        }
        this.packSize = count;
        this.flankWeight = Math.min(1.0, this.packSize / 20); 
    }
};

const generateRandomGear = (level) => {
    let gearTemplates = [
        { slot: 'Head',     name: 'Helmet',     stats: { def: 5, hp: 15 } },
        { slot: 'Armor',    name: 'Chestplate', stats: { def: 8, hp: 25 } },
        { slot: 'Legs',     name: 'Greaves',    stats: { def: 6, hp: 20 } },
        { slot: 'Boots',    name: 'Boots',      stats: { def: 4, atkSpeed: 0.05 } },
        { slot: 'Weapon',   name: 'Sword',      stats: { atk: 12, critMult: 0.15 } },
        { slot: 'Ring',     name: 'Ring',       stats: { atk: 6, critChance: 3 } },
        { slot: 'Necklace', name: 'Amulet',     stats: { hp: 15, regen: 0.5 } },
        { slot: 'Earrings', name: 'Earrings',   stats: { regen: 0.4, critMult: 0.1 } }
    ];
    let chosenTemplate = gearTemplates[Math.floor(Math.random() * gearTemplates.length)];
    
    let roll = Math.random(), rarityName = 'Common', rarityColor = 'var(--rarity-common)', statMult = 1.0;
    
    if (roll < 0.03) { rarityName = 'Legendary'; rarityColor = 'var(--rarity-legendary)'; statMult = 2.2; }
    else if (roll < 0.15) { rarityName = 'Epic'; rarityColor = 'var(--rarity-epic)'; statMult = 1.7; }
    else if (roll < 0.40) { rarityName = 'Rare'; rarityColor = 'var(--rarity-rare)'; statMult = 1.3; }

    let item = {
        id: `gear_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `${rarityName} ${chosenTemplate.name}`,
        slot: chosenTemplate.slot,
        rarity: rarityName,
        color: rarityColor,
        stats: {}
    };

    for (let stat in chosenTemplate.stats) {
        let rawValue = chosenTemplate.stats[stat] * (1 + level * 0.15) * randomFloat(0.9, 1.1) * statMult;
        if (stat === 'hp' || stat === 'atk' || stat === 'def') {
            item.stats[stat] = Math.max(1, Math.round(rawValue)); 
        } else {
            item.stats[stat] = Number(rawValue.toFixed(3)); 
        }
    }

    if (rarityName === 'Legendary' && Math.random() < 0.4) { 
        const specialPool = [
            { type: 'magnet', label: 'Magnet', value: 50 },
            { type: 'greed',  label: 'Greed',  value: 20 },
            { type: 'wisdom', label: 'Wisdom', value: 15 },
            { type: 'might',  label: 'Might',  value: 10 },
            { type: 'fear',   label: 'Fear',   value: 15 }
        ];
        item.affix = specialPool[Math.floor(Math.random() * specialPool.length)];
        item.name = `${item.affix.label} ${item.name}`; 
    }

    return item;
};

// --- ENEMY CLASS ---
class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15;
        // Optimization: Increased base speed (120-170) to challenge player speed (250)
        this.speed = randomFloat(120, 170) * Math.pow(1.05, GameState.level); 
        let hpMultiplier = Math.pow(1.3, GameState.level);
        this.hp = 30 * hpMultiplier; this.maxHp = this.hp; this.damage = 5 * hpMultiplier; this.id = Math.random(); this.attackCooldown = 0;
    }

    update(dt) {
        if (!player) return;
        let dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);
        if (dist < player.radius + this.radius + 5) {
            this.attackCooldown -= dt; if (this.attackCooldown <= 0) { player.takeDamage(this.damage); this.attackCooldown = 1.0; }
        } else if (dist < 600) {
            let angleToPlayer = Math.atan2(dy, dx);
            // Optimization: Adjusted flanking angle to 45 degrees (PI/4) 
            // This ensures they always close the distance instead of walking in circles.
            let flankOffset = ((this.id > 0.5 ? 1 : -1) * (Math.PI / 4) * HiveMind.flankWeight);
            let targetAngle = angleToPlayer + flankOffset;
            
            let nextX = this.x + Math.cos(targetAngle) * this.speed * dt, nextY = this.y + Math.sin(targetAngle) * this.speed * dt;
            if (!isWall(nextX, this.y)) this.x = nextX; if (!isWall(this.x, nextY)) this.y = nextY;
        }
    }

    takeDamage(amt, isCrit) {
        let fearMultiplier = 1 + (player.getFearValue() / 100);
        let finalDamage = amt * fearMultiplier;
        this.hp -= finalDamage; 
        spawnFloatingText(this.x, this.y, isCrit ? `CRIT ${Math.floor(finalDamage)}` : Math.floor(finalDamage), isCrit ? '#ff0' : '#fff');
        if (this.hp <= 0) this.die();
    }

    die() {
        let idx = entities.indexOf(this); if(idx > -1) entities.splice(idx, 1);
        let xpReward = 10 * GameState.level;
        gainXp(Math.floor(xpReward * player.getXpMultiplier()));
        if (Math.random() < 0.6) spawnLoot(this.x, this.y, 'gold');
        if (Math.random() < 0.2) spawnLoot(this.x, this.y, 'shard');
        if (Math.random() < 0.13) spawnLoot(this.x, this.y, 'gear');
    }

    draw(ctx) {
        ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#ff0000'; ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp/this.maxHp), 4);
    }
}

// --- WORLD ENTITIES ---
class Loot {
    constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.radius = 8; this.life = 15; this.floatY = 0; this.time = Math.random() * 10; }
    update(dt) {
        this.life -= dt; if (this.life <= 0) { entities.splice(entities.indexOf(this), 1); return; }
        this.time += dt * 5; this.floatY = Math.sin(this.time) * 5;
        let dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (player && dist < player.getPickupRadius()) { 
            this.pickup(); 
            entities.splice(entities.indexOf(this), 1); 
        }
    }
    pickup() {
        if (this.type === 'gold') {
            let baseAmt = randomInt(5, 15) * GameState.level;
            let finalAmt = Math.floor(baseAmt * player.getGoldMultiplier());
            PlayerData.gold += finalAmt; 
            spawnFloatingText(this.x, this.y, `+${finalAmt} Gold`, '#ffd700');
        } else if (this.type === 'shard') {
            PlayerData.shards += 1; spawnFloatingText(this.x, this.y, `+1 Shard`, '#00e5ff');
        } else if (this.type === 'gear') {
            let newGear = generateRandomGear(GameState.level); if (!PlayerData.inventory) PlayerData.inventory = [];
            PlayerData.inventory.push(newGear); spawnFloatingText(this.x, this.y, `+ ${newGear.name}`, '#bb86fc');
        }
        if (typeof UI !== 'undefined') { UI.updateCurrencies(); if (UI.renderInventory) UI.renderInventory(); }
        if (typeof saveGame !== 'undefined') saveGame();
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'gold' ? '#ffd700' : this.type === 'shard' ? '#00e5ff' : '#bb86fc'; ctx.beginPath();
        if(this.type === 'shard') { ctx.moveTo(this.x, this.y - 10 + this.floatY); ctx.lineTo(this.x + 8, this.y + this.floatY); ctx.lineTo(this.x, this.y + 10 + this.floatY); ctx.lineTo(this.x - 8, this.y + this.floatY); }
        else ctx.arc(this.x, this.y + this.floatY, this.radius, 0, Math.PI * 2);
        ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}

// --- VISUAL EFFECTS ---
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x + (Math.random() - 0.5) * 30; this.y = y - 40; this.text = text; this.color = color;
        this.life = 1.3; this.vx = (Math.random() - 0.5) * 80; this.vy = -50 - Math.random() * 40;
    }
    update(dt) {
        this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.95;
        if(this.life <= 0) {
            let idx = floatingTexts.indexOf(this);
            if(idx > -1) floatingTexts.splice(idx, 1);
        }
    }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color; ctx.font = 'bold 18px sans-serif'; ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.fillText(this.text, this.x, this.y); ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; let angle = Math.random() * Math.PI * 2, speed = Math.random() * 100;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.life = 0.5; this.size = randomFloat(2, 5);
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; if(this.life <= 0) { let idx = particles.indexOf(this); if(idx > -1) particles.splice(idx, 1); } }
    draw(ctx) { ctx.save(); ctx.fillStyle = this.color; ctx.globalAlpha = Math.max(0, this.life * 2); ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
}

// --- DOM BINDINGS ---
window.addEventListener('DOMContentLoaded', () => {
    let refs = {
        avatar: document.getElementById('avatar-btn'),
        close:  document.querySelector('#inventory-modal .close-btn') || document.querySelector('#inventory-modal .inv-header button'),
        claim:  document.getElementById('claim-daily-btn') || document.querySelector('#daily-login button')
    };
    if (refs.avatar) refs.avatar.addEventListener('click', () => UI.toggleInventory?.());
    if (refs.close)  refs.close.addEventListener('click', () => UI.toggleInventory?.());
    if (refs.claim)  refs.claim.addEventListener('click', () => UI.claimDaily?.());
});

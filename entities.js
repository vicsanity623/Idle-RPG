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
    const effectiveLevel = Math.max(level, window.PlayerData.level || 1);

    let gearTemplates = [
        { slot: 'Head',     name: 'Helmet',     stats: { def: 20, hp: 80 } },
        { slot: 'Armor',    name: 'Chestplate', stats: { def: 25, hp: 120 } },
        { slot: 'Legs',     name: 'Greaves',    stats: { def: 22, hp: 100 } },
        { slot: 'Boots',    name: 'Boots',      stats: { def: 18, atkSpeed: 0.10 } },
        { slot: 'Weapon',   name: 'Sword',      stats: { atk: 45, critMult: 0.30 } },
        { slot: 'Ring',     name: 'Ring',       stats: { atk: 25, critChance: 8 } },
        { slot: 'Necklace', name: 'Amulet',     stats: { hp: 60, regen: 2.5 } },
        { slot: 'Earrings', name: 'Earrings',   stats: { regen: 1.8, critMult: 0.25 } }
    ];

    let chosenTemplate = gearTemplates[Math.floor(Math.random() * gearTemplates.length)];
    
    let roll = Math.random(), rarityName = 'Common', rarityColor = 'var(--rarity-common)', statMult = 1.0;
    let rarityFlatBonus = 0;

    if (roll < 0.05) { 
        rarityName = 'Legendary'; rarityColor = 'var(--rarity-legendary)'; 
        statMult = 2.5; rarityFlatBonus = 50; 
    } else if (roll < 0.15) { 
        rarityName = 'Epic'; rarityColor = 'var(--rarity-epic)'; 
        statMult = 1.8; rarityFlatBonus = 30; 
    } else if (roll < 0.45) { 
        rarityName = 'Rare'; rarityColor = 'var(--rarity-rare)'; 
        statMult = 1.4; rarityFlatBonus = 15; 
    }

    let item = {
        id: `gear_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `${rarityName} ${chosenTemplate.name}`,
        slot: chosenTemplate.slot,
        rarity: rarityName,
        color: rarityColor,
        stats: {}
    };

    for (let stat in chosenTemplate.stats) {
        let weight = (stat === 'hp') ? 5 : (stat === 'atk' || stat === 'def') ? 1 : 0.1;
        let baseStat = chosenTemplate.stats[stat] + (rarityFlatBonus * weight);
        
        let rawValue = baseStat * (1 + effectiveLevel * 0.35) * randomFloat(1.05, 1.15) * statMult;

        if (stat === 'hp' || stat === 'atk' || stat === 'def') {
            item.stats[stat] = Math.max(1, Math.round(rawValue)); 
        } else {
            item.stats[stat] = Number(rawValue.toFixed(3)); 
        }
    }

    const equipped = window.PlayerData.gear[item.slot];
    if (equipped) {
        let eqStats = equipped.stats || equipped;
        for (let stat in item.stats) {
            if (eqStats[stat] && item.stats[stat] <= eqStats[stat]) {
                let boostedVal = eqStats[stat] * 1.15; 
                if (stat === 'hp' || stat === 'atk' || stat === 'def') {
                    item.stats[stat] = Math.ceil(boostedVal);
                } else {
                    item.stats[stat] = Number(boostedVal.toFixed(3));
                }
            }
        }
    }

    return item;
};

// Helper function for UI to determine stat comparison color based on whether higher is better
// Placed here as a utility related to gear stats, which are defined and generated in this file.
function getStatDeltaColor(currentValue, equippedValue, isBetterHigher) {
    if (currentValue === equippedValue) return 'var(--color-neutral, #fff)'; // No change
    if (isBetterHigher) { // e.g., Atk, Def, HP, CritChance, CritMult, Regen
        return currentValue > equippedValue ? 'var(--color-green, #0f0)' : 'var(--color-red, #f00)';
    } else { // e.g., Atk Spd (lower is better)
        return currentValue < equippedValue ? 'var(--color-green, #0f0)' : 'var(--color-red, #f00)';
    }
}

// --- ENEMY CLASS ---
class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15;
        this.id = Math.random();
        
        const depth = GameState.level;
        const depthSpeedBonus = Math.min(1.15, 1 + (depth * 0.02)); 
        this.baseSpeed = randomFloat(230, 280) * depthSpeedBonus;
        this.speed = this.baseSpeed;
        
        let hpMultiplier = Math.pow(1.3, depth);
        this.hp = 300 * hpMultiplier; 
        this.maxHp = this.hp; 
        this.damage = (5 * hpMultiplier) * 0.6; 
        
        const types = ['semi', 'burst', 'rapid'];
        this.fireType = types[Math.floor(Math.random() * types.length)];
        this.fireCooldown = randomFloat(1.0, 3.0);
        this.burstCount = 0;
        this.isFiring = false;

        this.rageTimer = 0;
        this.isRaged = false;
        this.attackCooldown = 0;
    }

    triggerRage() {
        if (this.isRaged) return;
        this.isRaged = true;
        this.rageTimer = 5.0; 
        this.speed = this.baseSpeed * 2.5;
        spawnFloatingText(this.x, this.y - 50, "ENRAGED!", '#ff0000');
    }

    update(dt) {
        if (!player) return;

        if (this.rageTimer > 0) {
            this.rageTimer -= dt;
            if (this.rageTimer <= 0) {
                this.isRaged = false;
                this.speed = this.baseSpeed;
            }
        }

        let dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);

        if (dist < 800) {
            let angleToPlayer = Math.atan2(dy, dx);
            let aggroFactor = Math.min(1.5, 1 + (GameState.level * 0.1));
            let flankOffset = ((this.id > 0.5 ? 1 : -1) * (Math.PI / 3) * HiveMind.flankWeight * aggroFactor);
            let targetAngle = angleToPlayer + flankOffset;
            
            let moveStep = this.speed * dt;
            let nextX = this.x + Math.cos(targetAngle) * moveStep;
            let nextY = this.y + Math.sin(targetAngle) * moveStep;
            
            if (!isWall(nextX, this.y)) this.x = nextX; 
            if (!isWall(this.x, nextY)) this.y = nextY;
            
            this.handleShooting(dt, dist);
        }

        if (dist < player.radius + this.radius + 10) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                player.takeDamage(this.damage * (this.isRaged ? 1.5 : 1));
                this.attackCooldown = 0.8;
            }
        }
    }

    handleShooting(dt, dist) {
        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt * (this.isRaged ? 2 : 1);
            return;
        }

        const shootSpeed = this.isRaged ? 0.05 : 0.15;

        if (this.fireType === 'rapid') {
            this.fireProjectile();
            this.burstCount++;
            this.fireCooldown = shootSpeed; 
            if (this.burstCount >= 16) {
                this.burstCount = 0;
                this.fireCooldown = 3.0; 
            }
        } else if (this.fireType === 'burst') {
            this.fireProjectile();
            this.burstCount++;
            this.fireCooldown = 0.1;
            if (this.burstCount >= 3) {
                this.burstCount = 0;
                this.fireCooldown = 1.5;
            }
        } else {
            this.fireProjectile();
            this.fireCooldown = 1.2;
        }
    }

    fireProjectile() {
        spawnProjectile(this.x, this.y, player, this.damage, false, true);
    }

    takeDamage(amt, isCrit) {
        let fearMultiplier = 1 + (player.getFearValue() / 100);
        let finalDamage = amt * fearMultiplier;
        this.hp -= finalDamage; 
        
        if (!this.isRaged && (Math.random() < 0.15 || this.hp < this.maxHp * 0.3)) {
            this.triggerRage();
        }

        spawnFloatingText(this.x, this.y, isCrit ? `CRIT ${window.FormatNumber(finalDamage)}` : window.FormatNumber(finalDamage), isCrit ? '#ff0' : '#fff');
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
        ctx.save();
        if (this.isRaged) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'red';
            ctx.fillStyle = '#ff0000'; 
        } else {
            ctx.fillStyle = '#ff5252';
        }

        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#000'; ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = this.isRaged ? '#ff0000' : '#ff5252'; 
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp/this.maxHp), 4);
        ctx.restore();
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
            spawnFloatingText(this.x, this.y, `+${window.FormatNumber(finalAmt)} Gold`, '#ffd700');
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

// SOTA SHOCKWAVE EXPANDING RING PHYSICS
class ExpandingRing {
    constructor(x, y, color, maxRadius, life) {
        this.x = x; this.y = y; this.color = color;
        this.maxRadius = maxRadius; this.lifeMax = life; this.life = life;
        this.radius = 0;
    }
    update(dt) {
        this.life -= dt;
        this.radius = this.maxRadius * (1 - (this.life / this.lifeMax));
        if (this.life <= 0) entities.splice(entities.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4 * (this.life / this.lifeMax);
        ctx.globalAlpha = this.life / this.lifeMax;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

// --- DOM BINDINGS ---
window.addEventListener('DOMContentLoaded', () => {
    const refs = {
        avatar: document.getElementById('avatar-btn'),
        close:  document.querySelector('#inventory-modal .close-btn') || document.querySelector('#inventory-modal .inv-header button'),
        claim:  document.getElementById('claim-daily-btn') || document.querySelector('#daily-login button')
    };
    
});

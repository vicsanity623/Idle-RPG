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
        for (let stat in item.stats) {
            if (equipped[stat] && item.stats[stat] <= equipped[stat]) {
                item.stats[stat] = Math.ceil(equipped[stat] * 1.15);
            }
        }
    }

    return item;
};

// --- ENEMY CLASS ---
class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15;
        this.id = Math.random();
        
        // --- DIFFICULTY SCALING ---
        const depth = GameState.level;
        const depthSpeedBonus = Math.min(1.15, 1 + (depth * 0.02)); // Max 15% increase
        this.baseSpeed = randomFloat(130, 180) * depthSpeedBonus;
        this.speed = this.baseSpeed;
        
        let hpMultiplier = Math.pow(1.3, depth);
        this.hp = 300 * hpMultiplier; 
        this.maxHp = this.hp; 
        this.damage = (5 * hpMultiplier) * 0.6; // Slightly lowered base since they shoot now
        
        // --- SHOOTING SYSTEM ---
        const types = ['semi', 'burst', 'rapid'];
        this.fireType = types[Math.floor(Math.random() * types.length)];
        this.fireCooldown = randomFloat(1.0, 3.0);
        this.burstCount = 0;
        this.isFiring = false;

        // --- RAGE SYSTEM ---
        this.rageTimer = 0;
        this.isRaged = false;
        this.attackCooldown = 0;
    }

    triggerRage() {
        if (this.isRaged) return;
        this.isRaged = true;
        this.rageTimer = 5.0; // 5 Seconds of rage
        this.speed = this.baseSpeed * 2.5;
        spawnFloatingText(this.x, this.y - 50, "ENRAGED!", '#ff0000');
    }

    update(dt) {
        if (!player) return;

        // Rage Management
        if (this.rageTimer > 0) {
            this.rageTimer -= dt;
            if (this.rageTimer <= 0) {
                this.isRaged = false;
                this.speed = this.baseSpeed;
            }
        }

        let dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);

        // Flanking and Movement Logic
        if (dist < 800) {
            let angleToPlayer = Math.atan2(dy, dx);
            // Higher depth = smarter, tighter flanking
            let aggroFactor = Math.min(1.5, 1 + (GameState.level * 0.1));
            let flankOffset = ((this.id > 0.5 ? 1 : -1) * (Math.PI / 3) * HiveMind.flankWeight * aggroFactor);
            let targetAngle = angleToPlayer + flankOffset;
            
            let moveStep = this.speed * dt;
            let nextX = this.x + Math.cos(targetAngle) * moveStep;
            let nextY = this.y + Math.sin(targetAngle) * moveStep;
            
            if (!isWall(nextX, this.y)) this.x = nextX; 
            if (!isWall(this.x, nextY)) this.y = nextY;
            
            // Shooting logic
            this.handleShooting(dt, dist);
        }

        // Melee logic if extremely close
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
            // Rapid: 16 rounds
            this.fireProjectile();
            this.burstCount++;
            this.fireCooldown = shootSpeed; 
            if (this.burstCount >= 16) {
                this.burstCount = 0;
                this.fireCooldown = 3.0; // Long reload
            }
        } else if (this.fireType === 'burst') {
            // Burst: 3 rounds
            this.fireProjectile();
            this.burstCount++;
            this.fireCooldown = 0.1;
            if (this.burstCount >= 3) {
                this.burstCount = 0;
                this.fireCooldown = 1.5;
            }
        } else {
            // Semi
            this.fireProjectile();
            this.fireCooldown = 1.2;
        }
    }

    fireProjectile() {
        // Use the same helper from main.js, but flagged as isEnemy=true
        spawnProjectile(this.x, this.y, player, this.damage, false, true);
    }

    takeDamage(amt, isCrit) {
        let fearMultiplier = 1 + (player.getFearValue() / 100);
        let finalDamage = amt * fearMultiplier;
        this.hp -= finalDamage; 
        
        // Rage trigger on damage (25% chance) or if HP low
        if (!this.isRaged && (Math.random() < 0.25 || this.hp < this.maxHp * 0.3)) {
            this.triggerRage();
        }

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
        ctx.save();
        if (this.isRaged) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'red';
            ctx.fillStyle = '#ff0000'; // Pure red when raged
        } else {
            ctx.fillStyle = '#ff5252';
        }

        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        
        // HP Bar
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

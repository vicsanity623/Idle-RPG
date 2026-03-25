/**
 * entities.js
 * Contains Player, Enemy, Loot, and Particle logic.
 */

// --- GLOBAL CONSTANTS, CONFIG & SCALING ---
const PLAYER_ATTACK_RANGE = 200,
      dashDistance = 150,
      
      HiveMind = {
          flankWeight: 0,
          packSize: 0,
          update: function() {
              this.packSize = entities.filter(e => e instanceof Enemy).length;
              this.flankWeight = Math.min(1.0, this.packSize / 20); 
          }
      },
      
      LEVEL_SCALING = {
          hp: 0.05,    // 5% per level
          atk: 0.04,   // 4% per level
          def: 0.03,   // 3% per level
          regen: 0.02, // 2% per level
          crit: 0.01   // 1% per level
      },

      generateRandomGear = (level) => {
          let gearTemplates = [
              { slot: 'Head', name: 'Helmet', stats: { def: 2, hp: 5 } },
              { slot: 'Armor', name: 'Chestplate', stats: { def: 4, hp: 10 } },
              { slot: 'Legs', name: 'Greaves', stats: { def: 3, hp: 7 } },
              { slot: 'Boots', name: 'Boots', stats: { def: 1, atkSpeed: 0.05 } },
              { slot: 'Weapon', name: 'Sword', stats: { atk: 5, critMult: 0.1 } },
              { slot: 'Ring', name: 'Ring', stats: { atk: 2, critChance: 2 } },
              { slot: 'Necklace', name: 'Amulet', stats: { hp: 8, regen: 0.5 } },
              { slot: 'Earrings', name: 'Earrings', stats: { regen: 0.2, critMult: 0.05 } }
          ];
          let chosenTemplate = gearTemplates[Math.floor(Math.random() * gearTemplates.length)];
          
          let roll = Math.random(),
              rarityName = 'Common',
              rarityColor = 'var(--rarity-common)', 
              statMult = 1.0;

          if (roll < 0.03) { 
              rarityName = 'Legendary'; rarityColor = 'var(--rarity-legendary)'; statMult = 2.0; 
          } else if (roll < 0.15) { 
              rarityName = 'Epic'; rarityColor = 'var(--rarity-epic)'; statMult = 1.6; 
          } else if (roll < 0.40) { 
              rarityName = 'Rare'; rarityColor = 'var(--rarity-rare)'; statMult = 1.3; 
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
              let rawValue = chosenTemplate.stats[stat] * (1 + level * 0.1) * randomFloat(0.8, 1.2) * statMult;
              
              if (stat === 'hp' || stat === 'atk' || stat === 'def') {
                  item.stats[stat] = Math.floor(rawValue); // Round down for big stats
              } else {
                  item.stats[stat] = Number(rawValue.toFixed(3)); 
              }
          }
          return item;
      };

// --- PLAYER CLASS ---
class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 20; this.vx = 0; this.vy = 0; this.speed = 250; this.color = '#bb86fc';
        this.hp = this.getMaxHp();
        this.skills = [
            { id: 'pot', cdMax: 10, current: 0 }, { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 }, { id: 'dash', cdMax: 3, current: 0 }
        ];
        this.lastMoveAngle = 0; 
    }

    getGearStat(slot, statName) {
        let item = PlayerData.gear[slot];
        if (!item) return 0;
        let stats = item.stats || item;
        return stats[statName] || 0;
    }

    getMaxHp() { 
        let base = 100 + this.getGearStat('Armor', 'hp') + this.getGearStat('Head', 'hp') + 
                   this.getGearStat('Legs', 'hp') + this.getGearStat('Robe', 'hp') + 
                   this.getGearStat('Necklace', 'hp');
        return Math.floor(base * (1 + (LEVEL_SCALING.hp * (PlayerData.level - 1)))); 
    }

    getAttackPower() { 
        let base = 10 + this.getGearStat('Weapon', 'atk') + this.getGearStat('Fists', 'atk') + 
                   this.getGearStat('Ring', 'atk');
        return Math.floor(base * (1 + (LEVEL_SCALING.atk * (PlayerData.level - 1)))); 
    }

    getDefense() { 
        let base = this.getGearStat('Armor', 'def') + this.getGearStat('Head', 'def') + 
                   this.getGearStat('Legs', 'def') + this.getGearStat('Boots', 'def');
        return Math.floor(base * (1 + (LEVEL_SCALING.def * (PlayerData.level - 1)))); 
    }

    getRegen() { 
        let base = this.getGearStat('Robe', 'regen') + this.getGearStat('Necklace', 'regen') + 
                   this.getGearStat('Earrings', 'regen');
        return base * (1 + (LEVEL_SCALING.regen * (PlayerData.level - 1))); 
    }

    getCritChance() { 
        let base = 5 + this.getGearStat('Fists', 'critChance') + this.getGearStat('Ring', 'critChance');
        let total = base * (1 + (LEVEL_SCALING.crit * (PlayerData.level - 1)));
        return Math.min(75, total); 
    }

    getCritMultiplier() { 
        let levelBonus = (PlayerData.level - 1) * 0.01;
        return 1.5 + levelBonus + this.getGearStat('Weapon', 'critMult') + this.getGearStat('Earrings', 'critMult'); 
    }

    getAttackSpeedFactor() {
        let levelBonus = (PlayerData.level - 1) * 0.005; 
        return Math.max(0.3, 1.0 - levelBonus - this.getGearStat('Boots', 'atkSpeed'));
    }

    update(dt) {
        if (this.hp < this.getMaxHp()) this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
            this.lastMoveAngle = Input.joystick.angle; 
        } else { this.vx = 0; this.vy = 0; }

        let nextX = this.x + this.vx * dt, nextY = this.y + this.vy * dt;
        if (!isWall(nextX, this.y)) this.x = nextX;
        if (!isWall(this.x, nextY)) this.y = nextY;

        this.handleSkills(dt); this.updateFog();
        UI.updateStats();
    }

    updateFog() {
        let col = Math.floor(this.x / TILE_SIZE), row = Math.floor(this.y / TILE_SIZE);
        for(let r = row-4; r <= row+4; r++) for(let c = col-4; c <= col+4; c++) if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });
        if (this.skills[1].current <= 0) {
            let target = this.getNearestEnemy(PLAYER_ATTACK_RANGE);
            if (target) {
                let damage = this.getAttackPower(), isCrit = Math.random() * 100 < this.getCritChance();
                if (isCrit) damage *= this.getCritMultiplier();
                spawnProjectile(this.x, this.y, target, damage, isCrit);
                this.skills[1].current = this.skills[1].cdMax * this.getAttackSpeedFactor(); 
            }
        }
        if (this.skills[2].current <= 0) {
            entities.forEach(e => { if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 120) e.takeDamage(this.getAttackPower() * 0.4, false); });
            spawnAura(this.x, this.y); this.skills[2].current = this.skills[2].cdMax;
        }
        if (this.hp < this.getMaxHp() * 0.4 && this.skills[0].current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * 0.4);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0'); this.skills[0].current = this.skills[0].cdMax;
        }
        if (Input.dashPressed && this.skills[3].current <= 0) {
            let targetX = this.x + Math.cos(this.lastMoveAngle) * dashDistance, targetY = this.y + Math.sin(this.lastMoveAngle) * dashDistance;
            if (!isWall(targetX, targetY)) { this.x = targetX; this.y = targetY; spawnFloatingText(this.x, this.y, "DASH!", '#00ffff'); this.skills[3].current = this.skills[3].cdMax; }
            Input.dashPressed = false; 
        }
        UI.updateHotbar(this.skills);
    }

    getNearestEnemy(range) {
        let nearest = null, minDist = range;
        entities.forEach(e => { if (e instanceof Enemy) { let d = Math.hypot(this.x - e.x, this.y - e.y); if (d < minDist) { minDist = d; nearest = e; } } });
        return nearest;
    }

    takeDamage(amt) {
        let finalDamage = Math.max(1, amt - Math.min(amt * 0.8, this.getDefense()));
        this.hp -= finalDamage; spawnFloatingText(this.x, this.y - 20, `-${Math.floor(finalDamage)}`, '#f00');
        if (this.hp <= 0) die();
    }

    draw(ctx) {
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
}

// --- ENEMY CLASS ---
class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15;
        this.speed = randomFloat(80, 130) * Math.pow(1.02, GameState.level); 
        let hpMultiplier = Math.pow(1.3, GameState.level);
        this.hp = 30 * hpMultiplier; this.maxHp = this.hp; this.damage = 5 * hpMultiplier; this.id = Math.random(); this.attackCooldown = 0;
    }
    update(dt) {
        if (!player) return;
        let dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);
        if (dist < player.radius + this.radius + 5) {
            this.attackCooldown -= dt; if (this.attackCooldown <= 0) { player.takeDamage(this.damage); this.attackCooldown = 1.0; }
        } else if (dist < 600) {
            let targetAngle = Math.atan2(dy, dx) + ((this.id > 0.5 ? 1 : -1) * (Math.PI / 2) * HiveMind.flankWeight);
            let nextX = this.x + Math.cos(targetAngle) * this.speed * dt, nextY = this.y + Math.sin(targetAngle) * this.speed * dt;
            if (!isWall(nextX, this.y)) this.x = nextX; if (!isWall(this.x, nextY)) this.y = nextY;
        }
    }
    takeDamage(amt, isCrit) {
        this.hp -= amt; spawnFloatingText(this.x, this.y, isCrit ? `CRIT ${Math.floor(amt)}` : Math.floor(amt), isCrit ? '#ff0' : '#fff');
        if (this.hp <= 0) this.die();
    }
    die() {
        let idx = entities.indexOf(this); if(idx > -1) entities.splice(idx, 1);
        gainXp(10 * GameState.level);
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

// --- LOOT CLASS ---
class Loot {
    constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.radius = 8; this.life = 15; this.floatY = 0; this.time = Math.random() * 10; }
    update(dt) {
        this.life -= dt; if (this.life <= 0) { entities.splice(entities.indexOf(this), 1); return; }
        this.time += dt * 5; this.floatY = Math.sin(this.time) * 5;
        if (player && Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius + 10) { this.pickup(); entities.splice(entities.indexOf(this), 1); }
    }
    pickup() {
        if (this.type === 'gold') {
            let amt = randomInt(5, 15) * GameState.level; PlayerData.gold += amt; spawnFloatingText(this.x, this.y, `+${amt} Gold`, '#ffd700');
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

// --- VISUAL CLASSES ---
class FloatingText {
    constructor(x, y, text, color) {
        // 1. Initial Offset: Start slightly away from the player center
        // This prevents the text from appearing directly on top of the avatar
        this.x = x + (Math.random() - 0.5) * 30;
        this.y = y - 40; 
        
        this.text = text;
        this.color = color;
        this.life = 1.3; // Increased lifetime slightly for better readability
        
        // 2. Burst Velocity: Gives text a random direction to "pop" into
        // vx = horizontal spread, vy = vertical float
        this.vx = (Math.random() - 0.5) * 80; 
        this.vy = -50 - Math.random() * 40;
    }

    update(dt) {
        this.life -= dt;
        
        // 3. Apply physics-like movement
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 4. Air Friction: Slow down the horizontal "burst" over time 
        // so the text eventually just floats straight up
        this.vx *= 0.95; 
        
        // 5. Cleanup
        if (this.life <= 0) {
            let idx = floatingTexts.indexOf(this);
            if (idx > -1) floatingTexts.splice(idx, 1);
        }
    }

    draw(ctx) {
        ctx.save();
        // 6. Smooth Fade Out: Opacity tied to remaining life
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 18px sans-serif'; // Slightly larger for clarity
        
        // 7. Text Shadow: Ensures readability on any floor tile color
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; let angle = Math.random() * Math.PI * 2, speed = Math.random() * 100;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.life = 0.5; this.size = randomFloat(2, 5);
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; if(this.life <= 0) particles.splice(particles.indexOf(this), 1); }
    draw(ctx) { ctx.save(); ctx.fillStyle = this.color; ctx.globalAlpha = Math.max(0, this.life * 2); ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
}

// --- UI EVENT LISTENERS BINDING ---
window.addEventListener('DOMContentLoaded', () => {
    let refs = {
        avatar: document.getElementById('avatar-btn'),
        close:  document.querySelector('#inventory-modal .close-btn') || document.querySelector('#inventory-modal .inv-header button'),
        claim:  document.getElementById('claim-daily-btn') || document.querySelector('#daily-login button')
    };

    if (refs.avatar) refs.avatar.addEventListener('click', () => UI.toggleInventory?.());
    if (refs.close)  refs.close.addEventListener('click', () => UI.toggleInventory?.());
    if (refs.claim)  refs.claim.addEventListener('click', () => UI.claimDaily?.());
    
    Object.entries(refs).forEach(([k, v]) => { if (!v) console.warn(`Binding Warning: '${k}' element not found in DOM.`); });
});

/**
 * entities.js
 * Contains Player, Enemy, Loot, and Particle logic.
 */

// --- GLOBAL CONSTANTS & CONFIG ---
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
          let item = {
              id: `gear_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: `${chosenTemplate.name} of Level ${level}`,
              slot: chosenTemplate.slot,
              stats: {}
          };
          for (let stat in chosenTemplate.stats) {
              item.stats[stat] = Math.floor(chosenTemplate.stats[stat] * (1 + level * 0.1) * randomFloat(0.8, 1.8));
          }
          return item;
      };

// --- PLAYER CLASS ---
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.vx = 0;
        this.vy = 0;
        this.speed = 250; 
        this.color = '#bb86fc';

        this.hp = this.getMaxHp();
        this.skills = [
            { id: 'pot', cdMax: 10, current: 0 },
            { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 }
        ];
        this.lastMoveAngle = 0; 
    }

    getMaxHp() { 
        let g = PlayerData.gear;
        return Math.floor(100 + (PlayerData.level * 20) + 
            (g.Armor?.hp || 0) + (g.Head?.hp || 0) + 
            (g.Legs?.hp || 0) + (g.Robe?.hp || 0) + 
            (g.Necklace?.hp || 0)); 
    }

    getAttackPower() { 
        let g = PlayerData.gear;
        return Math.floor(10 + (PlayerData.level * 2) + 
            (g.Weapon?.atk || 0) + (g.Fists?.atk || 0) + 
            (g.Ring?.atk || 0)); 
    }

    getDefense() { 
        let g = PlayerData.gear;
        return Math.floor((g.Armor?.def || 0) + (g.Head?.def || 0) + 
            (g.Legs?.def || 0) + (g.Boots?.def || 0)); 
    }

    getRegen() { 
        let g = PlayerData.gear;
        return (g.Robe?.regen || 0) + (g.Necklace?.regen || 0) + 
            (g.Earrings?.regen || 0); 
    }

    getCritChance() { 
        let g = PlayerData.gear;
        let base = 5 + (g.Fists?.critChance || 0) + (g.Ring?.critChance || 0);
        return Math.min(75, base); 
    }

    getCritMultiplier() { 
        let g = PlayerData.gear;
        return 1.5 + (g.Weapon?.critMult || 0) + (g.Earrings?.critMult || 0); 
    }

    getAttackSpeedFactor() {
        let g = PlayerData.gear;
        return Math.max(0.3, 1.0 - (g.Boots?.atkSpeed || 0));
    }

    update(dt) {
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
            this.lastMoveAngle = Input.joystick.angle; 
        } else {
            this.vx = 0; this.vy = 0;
        }

        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;
        if (!isWall(nextX, this.y)) this.x = nextX;
        if (!isWall(this.x, nextY)) this.y = nextY;

        this.handleSkills(dt);
        this.updateFog();

        if (portal && Math.hypot(this.x - portal.x, this.y - portal.y) < this.radius + portal.radius) {
            levelUpDungeon();
        }
        UI.updateStats();
    }

    updateFog() {
        let col = Math.floor(this.x / TILE_SIZE);
        let row = Math.floor(this.y / TILE_SIZE);
        for(let r = row-4; r <= row+4; r++) {
            for(let c = col-4; c <= col+4; c++) {
                if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
            }
        }
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });

        if (this.skills[1].current <= 0) {
            let target = this.getNearestEnemy(PLAYER_ATTACK_RANGE);
            if (target) {
                let damage = this.getAttackPower();
                let isCrit = Math.random() * 100 < this.getCritChance();
                if (isCrit) damage *= this.getCritMultiplier();
                target.takeDamage(damage, isCrit);
                spawnProjectile(this.x, this.y, target.x, target.y);
                this.skills[1].current = this.skills[1].cdMax * this.getAttackSpeedFactor(); 
            }
        }

        if (this.skills[2].current <= 0) {
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 120) {
                    e.takeDamage(this.getAttackPower() * 0.4, false);
                }
            });
            spawnAura(this.x, this.y);
            this.skills[2].current = this.skills[2].cdMax;
        }

        if (this.hp < this.getMaxHp() * 0.4 && this.skills[0].current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * 0.4);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0');
            this.skills[0].current = this.skills[0].cdMax;
        }

        if (Input.dashPressed && this.skills[3].current <= 0) {
            let dashAngle = this.lastMoveAngle; 
            let targetX = this.x + Math.cos(dashAngle) * dashDistance;
            let targetY = this.y + Math.sin(dashAngle) * dashDistance;

            if (!isWall(targetX, targetY)) {
                this.x = targetX;
                this.y = targetY;
                spawnFloatingText(this.x, this.y, "DASH!", '#00ffff');
                this.skills[3].current = this.skills[3].cdMax; 
            }
            Input.dashPressed = false; 
        }

        UI.updateHotbar(this.skills);
    }

    getNearestEnemy(range) {
        let nearest = null; let minDist = range;
        entities.forEach(e => {
            if (e instanceof Enemy) {
                let d = Math.hypot(this.x - e.x, this.y - e.y);
                if (d < minDist) { minDist = d; nearest = e; }
            }
        });
        return nearest;
    }

    takeDamage(amt) {
        let reduction = Math.min(amt * 0.8, this.getDefense());
        let finalDamage = Math.max(1, amt - reduction);
        this.hp -= finalDamage;
        spawnFloatingText(this.x, this.y - 20, `-${Math.floor(finalDamage)}`, '#f00');
        if (this.hp <= 0) die();
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
}

// --- ENEMY CLASS ---
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.speed = randomFloat(80, 130) * Math.pow(1.02, GameState.level); 
        let hpMultiplier = Math.pow(1.3, GameState.level);
        this.hp = 30 * hpMultiplier;
        this.maxHp = this.hp;
        this.damage = 5 * hpMultiplier;
        this.id = Math.random(); 
        this.attackCooldown = 0;
    }

    update(dt) {
        if (!player) return;
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.hypot(dx, dy);

        if (dist < player.radius + this.radius + 5) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                player.takeDamage(this.damage);
                this.attackCooldown = 1.0;
            }
        } else if (dist < 600) {
            let angleToPlayer = Math.atan2(dy, dx);
            let flankOffset = (this.id > 0.5 ? 1 : -1) * (Math.PI / 2) * HiveMind.flankWeight;
            let targetAngle = angleToPlayer + flankOffset;
            let vx = Math.cos(targetAngle) * this.speed;
            let vy = Math.sin(targetAngle) * this.speed;
            let nextX = this.x + vx * dt;
            let nextY = this.y + vy * dt;
            if (!isWall(nextX, this.y)) this.x = nextX;
            if (!isWall(this.x, nextY)) this.y = nextY;
        }
    }

    takeDamage(amt, isCrit) {
        this.hp -= amt;
        let color = isCrit ? '#ff0' : '#fff';
        let text = isCrit ? `CRIT ${Math.floor(amt)}` : Math.floor(amt);
        spawnFloatingText(this.x, this.y, text, color);
        if (this.hp <= 0) this.die();
    }

    die() {
        let idx = entities.indexOf(this);
        if(idx > -1) entities.splice(idx, 1);
        gainXp(10 * GameState.level);
        if (Math.random() < 0.6) spawnLoot(this.x, this.y, 'gold');
        if (Math.random() < 0.2) spawnLoot(this.x, this.y, 'shard');
        if (Math.random() < 0.13) spawnLoot(this.x, this.y, 'gear');
    }

    draw(ctx) {
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (this.hp/this.maxHp), 4);
    }
}

// --- LOOT CLASS ---
class Loot {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.radius = 8; this.life = 15; this.floatY = 0;
        this.time = Math.random() * 10;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) { entities.splice(entities.indexOf(this), 1); return; }
        this.time += dt * 5;
        this.floatY = Math.sin(this.time) * 5;
        if (player && Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius + 10) {
            this.pickup();
            entities.splice(entities.indexOf(this), 1);
        }
    }
    pickup() {
        if (this.type === 'gold') {
            let amt = randomInt(5, 15) * GameState.level;
            PlayerData.gold += amt;
            spawnFloatingText(this.x, this.y, `+${amt} Gold`, '#ffd700');
        } else if (this.type === 'shard') {
            PlayerData.shards += 1;
            spawnFloatingText(this.x, this.y, `+1 Shard`, '#00e5ff');
        } else if (this.type === 'gear') {
            let newGear = generateRandomGear(GameState.level);
            if (!PlayerData.inventory) { 
                PlayerData.inventory = [];
            }
            PlayerData.inventory.push(newGear);
            spawnFloatingText(this.x, this.y, `+ ${newGear.name}`, '#bb86fc');
            
            if (typeof UI !== 'undefined' && typeof UI.updateInventoryDisplay === 'function') {
                UI.updateInventoryDisplay();
            }
        }
        if (typeof UI !== 'undefined' && UI.updateCurrencies) UI.updateCurrencies();
        if (typeof saveGame !== 'undefined') saveGame();
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'gold' ? '#ffd700' : this.type === 'shard' ? '#00e5ff' : '#bb86fc';
        ctx.beginPath();
        if(this.type === 'shard') {
            ctx.moveTo(this.x, this.y - 10 + this.floatY);
            ctx.lineTo(this.x + 8, this.y + this.floatY);
            ctx.lineTo(this.x, this.y + 10 + this.floatY);
            ctx.lineTo(this.x - 8, this.y + this.floatY);
        } else {
            ctx.arc(this.x, this.y + this.floatY, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}

// --- VISUAL CLASSES ---
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = 1.0; this.vy = -30;
    }
    update(dt) {
        this.life -= dt; this.y += this.vy * dt;
        if(this.life <= 0) floatingTexts.splice(floatingTexts.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 100;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.5; this.size = randomFloat(2, 5);
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= dt;
        if(this.life <= 0) particles.splice(particles.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life * 2);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}
// --- UI EVENT LISTENERS BINDING ---
// Restores missing inline onclick HTML functionality
window.addEventListener('DOMContentLoaded', () => {
    
    // 1. Open Inventory (Avatar Button)
    let avatarBtn = document.getElementById('avatar-btn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined' && UI.toggleInventory) UI.toggleInventory();
        });
    }
    
    // 2. Close Inventory (The 'X' Button)
    // Safely targets the close button in the modal header
    let closeInventoryBtn = document.querySelector('#inventory-modal .close-btn') || 
                            document.getElementById('close-inventory') ||
                            document.querySelector('#inventory-modal .inv-header button'); 
                            
    if (closeInventoryBtn) {
        closeInventoryBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined' && UI.toggleInventory) UI.toggleInventory();
        });
    }
    
    // 3. Daily Login Claim
    let dailyLogin = document.getElementById('daily-login');
    if (dailyLogin) {
        let claimBtn = dailyLogin.querySelector('button') || dailyLogin;
        claimBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined' && UI.claimDaily) UI.claimDaily();
        });
    }
});

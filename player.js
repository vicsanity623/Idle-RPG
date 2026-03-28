/**
 * player.js
 * Isolated Hero Logic, Stat Scaling Formulas & Auto-Cast Skill Entities
 */

// --- HERO-SPECIFIC CONSTANTS ---
const PLAYER_ATTACK_RANGE = 280,
      DASH_DISTANCE = 550,
      LEVEL_SCALING = {
          hp:    0.05, 
          atk:   0.04, 
          def:   0.03, 
          regen: 0.02, 
          crit:  0.01  
      };

class Player {
    constructor(x, y) {
        this.x = x; 
        this.y = y; 
        this.radius = 18; 
        this.vx = 0; 
        this.vy = 0; 
        this.speed = 250; 
        this.color = '#bb86fc';
        
        // --- 1. INITIALIZE ARRAYS & READ FROM SAVE DATA ---
        // FIX: Grab saved skills so you don't lose them on page refresh!
        this.skillPoints = window.PlayerData.skillPoints || 0;
        this.learnedSkills = window.PlayerData.learnedSkills || [];
        
        this.skills = [
            { id: 'heal', cdMax: 17,  current: 0 }, 
            { id: 'atk',  cdMax: 0.7, current: 0 },
            { id: 'aura', cdMax: 5,   current: 0 }, 
            { id: 'dash', cdMax: 3,   current: 0 }
        ];
        this.lastMoveAngle = 0; 
        
        // Expanded Skill Timers & Trackers
        this.skillCooldowns = Array(30).fill(0); 
        this.invincibleTimer = 0;
        this.rageTimer = 0;
        this.zenTimer = 0;
        this.pipeBombTimer = 0;
        this.pipeBombAbsorbed = 0;
        this.scorchActiveTimer = 0;

        // --- 2. CALCULATE HP (Safe because learnedSkills now exists) ---
        this.hp = this.getMaxHp();
    }

    getAffixValue(affixType) {
        let total = 0;
        for (let slot in PlayerData.gear) {
            let item = PlayerData.gear[slot];
            if (item && item.affix && item.affix.type === affixType) total += item.affix.value;
        }
        return total;
    }

    getGearStat(slot, statName) {
        let item = PlayerData.gear[slot];
        if (!item) return 0;
        let stats = item.stats || item;
        return stats[statName] || 0;
    }

    // --- CHARACTER STAT FORMULAS (Updated w/ Passives) ---
    getMaxHp() { 
        let base = 100 + this.getGearStat('Armor', 'hp') + this.getGearStat('Head', 'hp') + this.getGearStat('Legs', 'hp') + this.getGearStat('Robe', 'hp') + this.getGearStat('Necklace', 'hp');
        let final = Math.floor(base * (1 + (LEVEL_SCALING.hp * (PlayerData.level - 1)))); 
        if (this.hasSkill(15)) final = Math.floor(final * 1.50); // Vitality Surge
        if (this.hasSkill(25)) final = Math.floor(final * 1.25); // Ascension
        return final;
    }

    getAttackPower() { 
        let base = 12 + this.getGearStat('Weapon', 'atk') + this.getGearStat('Fists', 'atk') + this.getGearStat('Ring', 'atk');
        if (this.hasSkill(1)) base += 5;
        let scaledAtk = base * (1 + (LEVEL_SCALING.atk * (PlayerData.level - 1)));
        if (this.hasSkill(2)) scaledAtk *= 1.10;
        let mightBonus = 1 + (this.getAffixValue('might') / 100);
        
        let final = Math.floor(scaledAtk * mightBonus); 
        if (this.rageTimer > 0) final *= 2; 
        if (this.zenTimer > 0) final *= 10;
        if (this.hasSkill(25)) final = Math.floor(final * 1.25); // Ascension
        return final;
    }

    getPickupRadius() {
        let base = 80 + this.getAffixValue('magnet');
        if (this.hasSkill(18)) base += 200; // Magnetic Field
        return base;
    }

    getGoldMultiplier() {
        let base = 1 + (this.getAffixValue('greed') / 100);
        if (this.hasSkill(19)) base += 0.5; // Wealth Magnet
        return base;
    }

    getXpMultiplier() {
        let base = 1 + (this.getAffixValue('wisdom') / 100);
        if (this.hasSkill(20)) base += 0.5; // Scholar's Insight
        return base;
    }

    getFearValue() { return this.getAffixValue('fear'); }

    getDefense() { 
        let base = this.getGearStat('Armor', 'def') + this.getGearStat('Head', 'def') + this.getGearStat('Legs', 'def') + this.getGearStat('Boots', 'def');
        let final = Math.floor(base * (1 + (LEVEL_SCALING.def * (PlayerData.level - 1)))); 
        if (this.hasSkill(16)) final = Math.floor(final * 1.50); // Iron Skin
        if (this.hasSkill(25)) final = Math.floor(final * 1.25); // Ascension
        return final;
    }

    getRegen() { 
        let base = this.getGearStat('Robe', 'regen') + this.getGearStat('Necklace', 'regen') + this.getGearStat('Earrings', 'regen');
        if (this.hasSkill(4)) base += 5;
        let final = base * (1 + (LEVEL_SCALING.regen * (PlayerData.level - 1))); 
        if (this.hasSkill(25)) final *= 1.25; // Ascension
        return final;
    }

    getCritChance() { 
        if (this.rageTimer > 0) return 100; // Rage forces 100% crit
        let base = 5 + this.getGearStat('Fists', 'critChance') + this.getGearStat('Ring', 'critChance');
        let total = base * (1 + (LEVEL_SCALING.crit * (PlayerData.level - 1)));
        if (this.hasSkill(25)) total *= 1.25; 
        return Math.min(75, total); 
    }

    getCritMultiplier() { 
        let levelBonus = (PlayerData.level - 1) * 0.01;
        let base = 1.5 + levelBonus + this.getGearStat('Weapon', 'critMult') + this.getGearStat('Earrings', 'critMult'); 
        if (this.rageTimer > 0) base += 5.0; // Rage adds massive crit damage
        if (this.hasSkill(25)) base *= 1.25; 
        return base;
    }

    getAttackSpeedFactor() {
        let levelBonus = (PlayerData.level - 1) * 0.005; 
        let base = Math.max(0.3, 1.0 - levelBonus - this.getGearStat('Boots', 'atkSpeed'));
        if (this.zenTimer > 0) base = base / 5; // Zen 500% speed
        return base;
    }
    
    getCombatPower() {
        let baseSum = (this.getMaxHp() / 5) + this.getAttackPower() + this.getDefense() + (this.getRegen() * 10) + (this.getCritChance() * this.getCritMultiplier());
        return baseSum * (1 / this.getAttackSpeedFactor());
    }

    // --- PLAYER SYSTEMS ---

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

        this.handleSkills(dt);
        this.updateFog();
    }

    updateFog() {
        let col = Math.floor(this.x / TILE_SIZE), row = Math.floor(this.y / TILE_SIZE);
        for(let r = row-4; r <= row+4; r++) {
            for(let c = col-4; c <= col+4; c++) {
                if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
            }
        }
    }

    handleSkills(dt) {
        // Core 4 Hotbar Skills
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
            let targetX = this.x + Math.cos(this.lastMoveAngle) * DASH_DISTANCE, targetY = this.y + Math.sin(this.lastMoveAngle) * DASH_DISTANCE;
            if (!isWall(targetX, targetY)) { 
                this.x = targetX; this.y = targetY; 
                spawnFloatingText(this.x, this.y, "DASH!", '#00ffff'); this.skills[3].current = this.skills[3].cdMax; 
            }
            Input.dashPressed = false; 
        }
        UI.updateHotbar(this.skills);

        // --- EXPANDED SKILLS PROCESSING ---
        for(let i=0; i<this.skillCooldowns.length; i++) {
            if (this.skillCooldowns[i] > 0) this.skillCooldowns[i] -= dt;
        }

        // 5 Invincibility
        if (this.hasSkill(5) && this.skillCooldowns[5] <= 0) {
            this.invincibleTimer = 3; this.skillCooldowns[5] = 14;
            spawnFloatingText(this.x, this.y, "INVINCIBLE", '#fff');
        }
        // 6 Scorch Trail
        if (this.hasSkill(6) && this.skillCooldowns[6] <= 0) {
            this.scorchActiveTimer = 5; this.skillCooldowns[6] = 9;
        }
        if (this.scorchActiveTimer > 0) {
            this.scorchActiveTimer -= dt;
            if (Math.random() < 0.25) entities.push(new ScorchTrailEntity(this.x, this.y, this.getAttackPower() * 0.5));
        }
        // 7 Heat Wave
        if (this.hasSkill(7) && this.skillCooldowns[7] <= 0) {
            spawnFloatingText(this.x, this.y, "HEAT WAVE", '#ff5500');
            spawnAura(this.x, this.y, '#ff5500');
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x-e.x, this.y-e.y) < 250) {
                    e.takeDamage(this.getAttackPower() * 3, true);
                    let ang = Math.atan2(e.y - this.y, e.x - this.x);
                    e.x += Math.cos(ang) * 120; e.y += Math.sin(ang) * 120;
                }
            });
            this.skillCooldowns[7] = 17;
        }
        // 8 Blink
        if (this.hasSkill(8) && this.skillCooldowns[8] <= 0) {
            let nearest = this.getNearestEnemy(600);
            if (nearest) {
                this.x = nearest.x + 40; this.y = nearest.y + 40;
                this.invincibleTimer = 2; this.skillCooldowns[8] = 8;
                spawnFloatingText(this.x, this.y, "BLINK", '#bb86fc');
            }
        }
        // 9 Rage
        if (this.hasSkill(9) && this.skillCooldowns[9] <= 0) {
            this.rageTimer = 3; this.skillCooldowns[9] = 6;
            spawnFloatingText(this.x, this.y, "RAGE", '#ff0000');
        }
        // 10 Twister
        if (this.hasSkill(10) && this.skillCooldowns[10] <= 0) {
            entities.push(new TwisterEntity(this.x, this.y, this.getAttackPower() * 5, 0));
            entities.push(new TwisterEntity(this.x, this.y, this.getAttackPower() * 5, Math.PI));
            this.skillCooldowns[10] = 12;
        }
        // 11 Summon
        if (this.hasSkill(11) && this.skillCooldowns[11] <= 0) {
            entities.push(new SummonCloneEntity(this.x, this.y, this.getAttackPower() * 9));
            this.skillCooldowns[11] = 13;
        }
        // 12 Rain Fire
        if (this.hasSkill(12) && this.skillCooldowns[12] <= 0) {
            for(let i=0; i<6; i++) {
                let tx = this.x + (Math.random() - 0.5)*500;
                let ty = this.y + (Math.random() - 0.5)*500;
                entities.push(new RainFireEntity(tx, ty, this.getAttackPower() * 2));
            }
            this.skillCooldowns[12] = 10;
        }
        // 13 Zen
        if (this.hasSkill(13) && this.skillCooldowns[13] <= 0) {
            this.zenTimer = 5; this.skillCooldowns[13] = 12;
            spawnFloatingText(this.x, this.y, "ZEN", '#fff');
        }
        // 14 Pipe Bomb
        if (this.hasSkill(14) && this.skillCooldowns[14] <= 0) {
            this.pipeBombTimer = 5; this.pipeBombAbsorbed = 0; this.skillCooldowns[14] = 20;
            spawnFloatingText(this.x, this.y, "ABSORBING", '#ff0');
        }

        if (this.pipeBombTimer > 0) {
            this.pipeBombTimer -= dt;
            if (this.pipeBombTimer <= 0) {
                spawnFloatingText(this.x, this.y, "BOOM!", '#ff0');
                spawnAura(this.x, this.y, '#ffff00');
                entities.forEach(e => {
                    if (e instanceof Enemy && Math.hypot(this.x-e.x, this.y-e.y) < 300) {
                        e.takeDamage(this.pipeBombAbsorbed * 2, true); 
                    }
                });
            }
        }

        // 17 Vampire Aura
        if (this.hasSkill(17)) {
            let nearby = 0;
            entities.forEach(e => { if (e instanceof Enemy && Math.hypot(this.x-e.x, this.y-e.y) < 200) nearby++; });
            if (nearby > 0) this.hp = Math.min(this.getMaxHp(), this.hp + (nearby * 5 * dt));
        }

        // 22 Frost Nova
        if (this.hasSkill(22) && this.skillCooldowns[22] <= 0) {
            spawnFloatingText(this.x, this.y, "FROST NOVA", '#00ffff');
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x-e.x, this.y-e.y) < 250) {
                    if (!e.frozen) { e.frozen = true; e.freezeTimer = 3; e.oldSpeed = e.speed; e.speed = 0; }
                }
            });
            this.skillCooldowns[22] = 15;
        }

        // Global Enemy Unfreeze Helper
        entities.forEach(e => {
            if (e instanceof Enemy && e.frozen) {
                e.freezeTimer -= dt;
                if (e.freezeTimer <= 0) { e.frozen = false; e.speed = e.oldSpeed; }
            }
        });

        // 23 Dagger Shield
        if (this.hasSkill(23) && this.skillCooldowns[23] <= 0) {
            entities.push(new DaggerShieldEntity(this, this.getAttackPower()));
            this.skillCooldowns[23] = 10;
        }

        // 24 Executioner
        if (this.hasSkill(24)) {
            entities.forEach(e => {
                if (e instanceof Enemy && e.hp < e.maxHp * 0.15 && Math.hypot(this.x-e.x, this.y-e.y) < 200) {
                    spawnFloatingText(e.x, e.y, "EXECUTED", '#555');
                    e.takeDamage(e.hp + 100, true);
                }
            });
        }

        // Timers & Visuals
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
        if (this.rageTimer > 0) {
            this.rageTimer -= dt;
            this.color = '#ff0000';
        } else if (this.zenTimer > 0) {
            this.zenTimer -= dt;
            this.color = '#ffffff';
        } else {
            this.color = '#bb86fc';
        }
    }

    hasSkill(skillId) { return this.learnedSkills.includes(skillId); }
    canLearnSkill(skillId, cost, prereqId) {
        if (this.hasSkill(skillId)) return false;
        if (this.skillPoints < cost) return false;
        if (prereqId !== 0 && !this.hasSkill(prereqId)) return false;
        return true;
    }
    learnSkill(skillId, cost, prereqId) {
        if (this.canLearnSkill(skillId, cost, prereqId)) {
            this.skillPoints -= cost; this.learnedSkills.push(skillId);
            if (skillId === 3) this.speed *= 1.10;
            return true;
        }
        return false;
    }

    getNearestEnemy(range) {
        let nearest = null, minDist = range;
        entities.forEach(e => { if (e instanceof Enemy) { let d = Math.hypot(this.x - e.x, this.y - e.y); if (d < minDist) { minDist = d; nearest = e; } } });
        return nearest;
    }

    takeDamage(amt) {
        if (this.pipeBombTimer > 0) {
            this.pipeBombAbsorbed += amt;
            spawnFloatingText(this.x, this.y - 20, `ABSORBED`, '#0f0');
            return;
        }
        if (this.invincibleTimer > 0) {
            spawnFloatingText(this.x, this.y - 20, `BLOCKED`, '#888');
            return;
        }
        
        let finalDamage = Math.max(1, amt - Math.min(amt * 0.8, this.getDefense()));
        this.hp -= finalDamage; 
        spawnFloatingText(this.x, this.y - 20, `-${window.FormatNumber(finalDamage)}`, '#f00');
        if (this.hp <= 0) die();
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }
}

// --- AUTO-CAST ENTITY CLASSES ---
class ScorchTrailEntity {
    constructor(x, y, damage) { this.x = x; this.y = y; this.damage = damage; this.life = 5; }
    update(dt) {
        this.life -= dt;
        entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.x, e.y - this.y) < 25) e.takeDamage(this.damage * dt, false); });
        if (this.life <= 0) entities.splice(entities.indexOf(this), 1);
    }
    draw(ctx) { ctx.fillStyle = `rgba(255, 69, 0, ${this.life/5})`; ctx.beginPath(); ctx.arc(this.x, this.y, 20, 0, Math.PI*2); ctx.fill(); }
}

class TwisterEntity {
    constructor(x, y, damage, angleOffset) {
        this.damage = damage; this.angle = angleOffset; this.radius = 0; this.life = 5; this.cx = x; this.cy = y;
        this.x = x; this.y = y;
    }
    update(dt) {
        this.life -= dt; this.angle += dt * 8; this.radius += dt * 60;
        this.x = this.cx + Math.cos(this.angle) * this.radius; this.y = this.cy + Math.sin(this.angle) * this.radius;
        entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.x, e.y - this.y) < 40) e.takeDamage(this.damage * dt, false); });
        if (this.life <= 0) entities.splice(entities.indexOf(this), 1);
    }
    draw(ctx) { ctx.fillStyle = 'rgba(200, 200, 255, 0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, 35, 0, Math.PI*2); ctx.fill(); }
}

class SummonCloneEntity {
    constructor(x, y, damage) { this.x = x; this.y = y; this.damage = damage; this.life = 6; this.chain = 0; this.target = null; }
    update(dt) {
        this.life -= dt;
        if (this.chain >= 5 || this.life <= 0) { entities.splice(entities.indexOf(this), 1); return; }
        if (!this.target || this.target.hp <= 0) this.target = player.getNearestEnemy(1000);
        if (this.target) {
            let dx = this.target.x - this.x, dy = this.target.y - this.y, dist = Math.hypot(dx, dy);
            if (dist < 40) {
                this.target.takeDamage(this.damage, true); this.chain++; this.target = null;
            } else { this.x += (dx/dist) * 900 * dt; this.y += (dy/dist) * 900 * dt; }
        }
    }
    draw(ctx) { ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(this.x, this.y, player.radius * 4, 0, Math.PI*2); ctx.fill(); }
}

class RainFireEntity {
    constructor(x, y, damage) { this.tx = x; this.ty = y; this.damage = damage; this.x = x - 200; this.y = y - 800; this.speed = 1500; }
    update(dt) {
        let dx = this.tx - this.x, dy = this.ty - this.y, dist = Math.hypot(dx, dy);
        if (dist < 50) {
            spawnAura(this.tx, this.ty, '#ff5500');
            entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.tx, e.y - this.ty) < 150) e.takeDamage(this.damage, false); });
            entities.splice(entities.indexOf(this), 1);
        } else { this.x += (dx/dist) * this.speed * dt; this.y += (dy/dist) * this.speed * dt; }
    }
    draw(ctx) { ctx.fillStyle = '#ff5500'; ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI*2); ctx.fill(); }
}

class DaggerShieldEntity {
    constructor(playerRef, damage) { this.p = playerRef; this.damage = damage; this.life = 4; this.angle = 0; this.x = 0; this.y = 0; }
    update(dt) {
        this.life -= dt; this.angle += dt * 8;
        this.x = this.p.x + Math.cos(this.angle) * 80; this.y = this.p.y + Math.sin(this.angle) * 80;
        entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.x, e.y - this.y) < 30) e.takeDamage(this.damage * dt * 5, false); });
        if (this.life <= 0) entities.splice(entities.indexOf(this), 1);
    }
    draw(ctx) {
        ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.p.x - Math.cos(this.angle)*80, this.p.y - Math.sin(this.angle)*80, 10, 0, Math.PI*2); ctx.fill();
    }
}
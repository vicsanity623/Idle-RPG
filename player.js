/**
 * player.js
 * Isolated Hero Logic & Stat Scaling Formulas
 */

// --- HERO-SPECIFIC CONSTANTS ---
const PLAYER_ATTACK_RANGE = 280,
      DASH_DISTANCE = 550,
      LEVEL_SCALING = {
          hp:    0.05, // 5% per level
          atk:   0.04, // 4% per level
          def:   0.03, // 3% per level
          regen: 0.02, // 2% per level
          crit:  0.01  // 1% per level
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
        this.hp = this.getMaxHp();
        this.skillPoints = 0;
        this.learnedSkills = [];
        this.skills = [
            { id: 'heal', cdMax: 17,  current: 0 }, 
            { id: 'atk',  cdMax: 0.7, current: 0 },
            { id: 'aura', cdMax: 5,   current: 0 }, 
            { id: 'dash', cdMax: 3,   current: 0 }
        ];
        this.lastMoveAngle = 0; 
    }

    // --- LEGENDARY AFFIX ENGINE ---
    // Scans all equipped gear for special stats (Might, Greed, etc.)
    getAffixValue(affixType) {
        let total = 0;
        for (let slot in PlayerData.gear) {
            let item = PlayerData.gear[slot];
            if (item && item.affix && item.affix.type === affixType) {
                total += item.affix.value;
            }
        }
        return total;
    }

    // Normalized Stat Reader (Reads Starter Gear vs Found Gear)
    getGearStat(slot, statName) {
        let item = PlayerData.gear[slot];
        if (!item) return 0;
        let stats = item.stats || item;
        return stats[statName] || 0;
    }

    // --- CHARACTER STAT FORMULAS ---

    getMaxHp() { 
        let base = 100 + this.getGearStat('Armor', 'hp') + this.getGearStat('Head', 'hp') + 
                   this.getGearStat('Legs', 'hp') + this.getGearStat('Robe', 'hp') + 
                   this.getGearStat('Necklace', 'hp');
        return Math.floor(base * (1 + (LEVEL_SCALING.hp * (PlayerData.level - 1)))); 
    }

    getAttackPower() { 
        let base = 12 + this.getGearStat('Weapon', 'atk') + this.getGearStat('Fists', 'atk') + 
                   this.getGearStat('Ring', 'atk');
        if (this.hasSkill(1)) base += 5;
        let scaledAtk = base * (1 + (LEVEL_SCALING.atk * (PlayerData.level - 1)));
        if (this.hasSkill(2)) scaledAtk *= 1.10;
        let mightBonus = 1 + (this.getAffixValue('might') / 100);
        return Math.floor(scaledAtk * mightBonus); 
    }

    getPickupRadius() {
        return 80 + this.getAffixValue('magnet');
    }

    getGoldMultiplier() {
        return 1 + (this.getAffixValue('greed') / 100);
    }

    getXpMultiplier() {
        return 1 + (this.getAffixValue('wisdom') / 100);
    }

    getFearValue() {
        return this.getAffixValue('fear');
    }

    getDefense() { 
        let base = this.getGearStat('Armor', 'def') + this.getGearStat('Head', 'def') + 
                   this.getGearStat('Legs', 'def') + this.getGearStat('Boots', 'def');
        return Math.floor(base * (1 + (LEVEL_SCALING.def * (PlayerData.level - 1)))); 
    }

    getRegen() { 
        let base = this.getGearStat('Robe', 'regen') + this.getGearStat('Necklace', 'regen') + 
                   this.getGearStat('Earrings', 'regen');
        if (this.hasSkill(4)) base += 5;
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
    
    getCombatPower() {
        // We divide HP by 5 and multiply Regen by 10 to balance the weight of stats
        let baseSum = (this.getMaxHp() / 5) + 
                      this.getAttackPower() + 
                      this.getDefense() + 
                      (this.getRegen() * 10) + 
                      (this.getCritChance() * this.getCritMultiplier());
                      
        // Multiply the whole sum by the Attack Frequency (Attacks per second)
        let attackFreq = 1 / this.getAttackSpeedFactor();
        
        return baseSum * attackFreq;
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
                this.x = targetX; 
                this.y = targetY; 
                spawnFloatingText(this.x, this.y, "DASH!", '#00ffff'); 
                this.skills[3].current = this.skills[3].cdMax; 
            }
            Input.dashPressed = false; 
        }
        UI.updateHotbar(this.skills);
    }

    hasSkill(skillId) {
        return this.learnedSkills.includes(skillId);
    }

    canLearnSkill(skillId, cost, prereqId) {
        if (this.hasSkill(skillId)) return false;
        if (this.skillPoints < cost) return false;
        if (prereqId !== 0 && !this.hasSkill(prereqId)) return false;
        return true;
    }

    learnSkill(skillId, cost, prereqId) {
        if (this.canLearnSkill(skillId, cost, prereqId)) {
            this.skillPoints -= cost;
            this.learnedSkills.push(skillId);
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
        let finalDamage = Math.max(1, amt - Math.min(amt * 0.8, this.getDefense()));
        this.hp -= finalDamage; 
        // Applied window.FormatNumber to Player damage taken popups
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
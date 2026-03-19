/**
 * entities.js
 * Contains Player, Enemy, Loot, and Particle logic.
 */

// Assume SkillsData is defined globally or imported, mapping skill IDs to their effects.
// Example structure for SkillsData:
const SkillsData = {
    'hp_mastery': { type: 'hp', value: 100 },
    'atk_boost': { type: 'attack', value: 15 },
    'def_training': { type: 'defense', value: 5 },
    'regen_aura': { type: 'regen', value: 0.5 },
    'crit_focus': { type: 'critChance', value: 3 },
    'crit_power': { type: 'critMultiplier', value: 0.1 },
    'swift_strikes': { type: 'attackSpeedFactor', value: 0.05 }, // Reduces factor by 0.05
    // Add more skill definitions here as needed
};

// --- HIVE MIND AI ---
const HiveMind = {
    flankWeight: 0,
    packSize: 0,
    update: function() {
        this.packSize = entities.filter(e => e instanceof Enemy).length;
        this.flankWeight = Math.min(1.0, this.packSize / 20); 
    }
};

// --- PLAYER CLASS ---
class Player {
    // This Player class now fully supports the Interactive Skill Tree Stat Preview feature
    // via its getProjectedStats method, allowing other modules to query projected stats.
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.vx = 0;
        this.vy = 0;
        this.speed = 250;
        this.color = '#bb86fc';

        this.skills = [
            { id: 'pot', cdMax: 10, current: 0 },
            { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 }
        ];
        this.skillHpBonus = 0; // Initialize skill HP bonus
        this.skillAtkBonus = 0; // NEW: Initialize skill Attack bonus
        this.skillDefBonus = 0; // NEW: Initialize skill Defense bonus
        this.skillRegenBonus = 0; // NEW: Initialize skill Regen bonus
        this.skillCritChanceBonus = 0; // NEW: Initialize skill Crit Chance bonus
        this.skillCritMultiplierBonus = 0; // NEW: Initialize skill Crit Multiplier bonus
        this.skillAttackSpeedFactorBonus = 0; // NEW: Initialize skill Attack Speed Factor bonus
        this.applySkillEffects(); // Apply skill effects on initialization
        this.hp = this.getMaxHp(); // Calculate HP *after* skill effects are applied
    }

    getMaxHp() { 
        const g = PlayerData.gear;
        return Math.floor(100 + (PlayerData.level * 20) + 
            (g.Armor.hp || 0) + (g.Head.hp || 0) + 
            (g.Legs.hp || 0) + (g.Robe.hp || 0) + 
            (g.Necklace.hp || 0) + this.skillHpBonus); // Added skillHpBonus
    }

    getAttackPower() { 
        const g = PlayerData.gear;
return Math.floor(10 + (PlayerData.level * 2) +
            (g.Weapon.atk || 0) + (g.Fists.atk || 0) +
            (g.Ring.atk || 0) + this.skillAtkBonus); // NEW: Added skillAtkBonus
    }

    getDefense() { 
        const g = PlayerData.gear;
return Math.floor((g.Armor.def || 0) + (g.Head.def || 0) +
            (g.Legs.def || 0) + (g.Boots.def || 0) + this.skillDefBonus); // NEW: Added skillDefBonus
    }

    getRegen() { 
        const g = PlayerData.gear;
return (g.Robe.regen || 0) + (g.Necklace.regen || 0) +
            (g.Earrings.regen || 0) + this.skillRegenBonus; // NEW: Added skillRegenBonus
    }

    getCritChance() { 
        const g = PlayerData.gear;
        let base = 5 + (g.Fists.critChance || 0) + (g.Ring.critChance || 0) + this.skillCritChanceBonus; // NEW: Added skillCritChanceBonus
        return Math.min(75, base); 
    }

    getCritMultiplier() { 
        const g = PlayerData.gear;
        return 1.5 + (g.Weapon.critMult || 0) + (g.Earrings.critMult || 0) + this.skillCritMultiplierBonus; // NEW: Added skillCritMultiplierBonus 
    }

    getAttackSpeedFactor() {
        const g = PlayerData.gear;
        return Math.max(0.3, 1.0 - (g.Boots.atkSpeed || 0) - this.skillAttackSpeedFactorBonus); // NEW: Added skillAttackSpeedFactorBonus
    }

    /**
     * NEW: Helper method to calculate all skill bonuses based on a given list of skill IDs.
     * This centralizes the logic for applying skill effects.
     * @param {string[]} skillList - An array of skill IDs to calculate bonuses for.
     * @returns {object} An object containing all calculated bonuses.
     */
    _calculateSkillBonuses(skillList) {
        let hpBonus = 0;
        let atkBonus = 0;
        let defBonus = 0;
        let regenBonus = 0;
        let critChanceBonus = 0;
        let critMultiplierBonus = 0;
        let attackSpeedFactorBonus = 0;

        if (!skillList) return { hpBonus, atkBonus, defBonus, regenBonus, critChanceBonus, critMultiplierBonus, attackSpeedFactorBonus };

        skillList.forEach(skillId => {
            const skillEffect = SkillsData[skillId];
            if (skillEffect) {
                if (skillEffect.type === 'hp') {
                    hpBonus += skillEffect.value;
                } else if (skillEffect.type === 'attack') {
                    atkBonus += skillEffect.value;
                } else if (skillEffect.type === 'defense') {
                    defBonus += skillEffect.value;
                } else if (skillEffect.type === 'regen') {
                    regenBonus += skillEffect.value;
                } else if (skillEffect.type === 'critChance') {
                    critChanceBonus += skillEffect.value;
                } else if (skillEffect.type === 'critMultiplier') {
                    critMultiplierBonus += skillEffect.value;
                } else if (skillEffect.type === 'attackSpeedFactor') {
                    attackSpeedFactorBonus += skillEffect.value;
                }
            }
        });
        return { hpBonus, atkBonus, defBonus, regenBonus, critChanceBonus, critMultiplierBonus, attackSpeedFactorBonus };
    }

    /**
     * Refactored: Applies all passive skill effects based on PlayerData.learnedSkills.
     */
    applySkillEffects() {
        // Reset all skill bonuses before applying new ones
        this.skillHpBonus = 0;
        this.skillAtkBonus = 0;
        this.skillDefBonus = 0;
        this.skillRegenBonus = 0;
        this.skillCritChanceBonus = 0;
        this.skillCritMultiplierBonus = 0;
        this.skillAttackSpeedFactorBonus = 0;

        // Use PlayerData.activePassiveSkills for currently applied bonuses, managed by skillSelector.js
        const bonuses = this._calculateSkillBonuses(PlayerData.activePassiveSkills || []);
        this.skillHpBonus = bonuses.hpBonus;
        this.skillAtkBonus = bonuses.atkBonus;
        this.skillDefBonus = bonuses.defBonus;
        this.skillRegenBonus = bonuses.regenBonus;
        this.skillCritChanceBonus = bonuses.critChanceBonus;
        this.skillCritMultiplierBonus = bonuses.critMultiplierBonus;
        this.skillAttackSpeedFactorBonus = bonuses.attackSpeedFactorBonus;
    }

    /**
     * NEW: Calculates and returns the player's current stats and projected stats
     * if a specific skill were to be learned. Used for interactive skill tree previews.
     * @param {string} skillIdToSimulate - The ID of the skill to simulate learning.
     * @returns {object} An object containing 'current' and 'projected' stats.
     */
    // This method is a core component of the interactive skill tree preview feature.
    getProjectedStats(skillIdToSimulate) {
        // Store current skill bonuses to revert after simulation
        const originalSkillHpBonus = this.skillHpBonus;
        const originalSkillAtkBonus = this.skillAtkBonus;
        const originalSkillDefBonus = this.skillDefBonus;
        const originalSkillRegenBonus = this.skillRegenBonus;
        const originalSkillCritChanceBonus = this.skillCritChanceBonus;
        const originalSkillCritMultiplierBonus = this.skillCritMultiplierBonus;
        const originalSkillAttackSpeedFactorBonus = this.skillAttackSpeedFactorBonus;

        // Calculate bonuses with the simulated skill, based on currently active passive skills
        const tempActivePassiveSkills = [...(PlayerData.activePassiveSkills || [])]; // Use activePassiveSkills
        if (skillIdToSimulate && !tempActivePassiveSkills.includes(skillIdToSimulate)) {
            tempActivePassiveSkills.push(skillIdToSimulate);
        }
        const simulatedBonuses = this._calculateSkillBonuses(tempActivePassiveSkills);

        // Temporarily apply simulated bonuses to the player object
        this.skillHpBonus = simulatedBonuses.hpBonus;
        this.skillAtkBonus = simulatedBonuses.atkBonus;
        this.skillDefBonus = simulatedBonuses.defBonus;
        this.skillRegenBonus = simulatedBonuses.regenBonus;
        this.skillCritChanceBonus = simulatedBonuses.critChanceBonus;
        this.skillCritMultiplierBonus = simulatedBonuses.critMultiplierBonus;
        this.skillAttackSpeedFactorBonus = simulatedBonuses.attackSpeedFactorBonus;

        // Calculate projected stats using the temporarily applied bonuses
        const projectedStats = {
            hp: this.getMaxHp(),
            attack: this.getAttackPower(),
            defense: this.getDefense(),
            regen: this.getRegen(),
            critChance: this.getCritChance(),
            critMultiplier: this.getCritMultiplier(),
            attackSpeedFactor: this.getAttackSpeedFactor()
        };

        // Revert player object's skill bonuses to their original state
        this.skillHpBonus = originalSkillHpBonus;
        this.skillAtkBonus = originalSkillAtkBonus;
        this.skillDefBonus = originalSkillDefBonus;
        this.skillRegenBonus = originalSkillRegenBonus;
        this.skillCritChanceBonus = originalSkillCritChanceBonus;
        this.skillCritMultiplierBonus = originalSkillCritMultiplierBonus;
        this.skillAttackSpeedFactorBonus = originalSkillAttackSpeedFactorBonus;

        // Calculate current stats (after reverting, ensuring they reflect the actual learned skills)
        const currentStats = {
            hp: this.getMaxHp(),
            attack: this.getAttackPower(),
            defense: this.getDefense(),
            regen: this.getRegen(),
            critChance: this.getCritChance(),
            critMultiplier: this.getCritMultiplier(),
            attackSpeedFactor: this.getAttackSpeedFactor()
        };

        return { current: currentStats, projected: projectedStats };
    }

    update(dt) {
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
        } else {
            this.vx = 0; this.vy = 0;
        }

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;
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
        const col = Math.floor(this.x / TILE_SIZE);
        const row = Math.floor(this.y / TILE_SIZE);
        for(let r = row-4; r <= row+4; r++) {
            for(let c = col-4; c <= col+4; c++) {
                if(r>=0 && r<MAP_SIZE && c>=0 && c<MAP_SIZE) exploredGrid[r][c] = true;
            }
        }
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });

        // REF NO: Magic Number Refactor by Pyob
        const PLAYER_ATTACK_RANGE = 200; 

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
        UI.updateHotbar(this.skills);
    }

    getNearestEnemy(range) {
        let nearest = null; let minDist = range;
        entities.forEach(e => {
            if (e instanceof Enemy) {
                const d = Math.hypot(this.x - e.x, this.y - e.y);
                if (d < minDist) { minDist = d; nearest = e; }
            }
        });
        return nearest;
    }

    takeDamage(amt) {
        const reduction = Math.min(amt * 0.8, this.getDefense());
        const finalDamage = Math.max(1, amt - reduction);
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
        const hpMultiplier = Math.pow(1.1, GameState.level);
        this.hp = 30 * hpMultiplier;
        this.maxHp = this.hp;
        this.damage = 5 * hpMultiplier;
        this.id = Math.random(); 
        this.attackCooldown = 0;
    }

    update(dt) {
        if (!player) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < player.radius + this.radius + 5) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                player.takeDamage(this.damage);
                this.attackCooldown = 1.0;
            }
        } else if (dist < 600) {
            const angleToPlayer = Math.atan2(dy, dx);
            const flankOffset = (this.id > 0.5 ? 1 : -1) * (Math.PI / 2) * HiveMind.flankWeight;
            const targetAngle = angleToPlayer + flankOffset;
            let vx = Math.cos(targetAngle) * this.speed;
            let vy = Math.sin(targetAngle) * this.speed;
            const nextX = this.x + vx * dt;
            const nextY = this.y + vy * dt;
            if (!isWall(nextX, this.y)) this.x = nextX;
            if (!isWall(this.x, nextY)) this.y = nextY;
        }
    }

    takeDamage(amt, isCrit) {
        this.hp -= amt;
        const color = isCrit ? '#ff0' : '#fff';
        const text = isCrit ? `CRIT ${Math.floor(amt)}` : Math.floor(amt);
        spawnFloatingText(this.x, this.y, text, color);
        if (this.hp <= 0) this.die();
    }

    die() {
        const idx = entities.indexOf(this);
        if(idx > -1) entities.splice(idx, 1);
        gainXp(10 * GameState.level);
        if (Math.random() < 0.6) spawnLoot(this.x, this.y, 'gold');
        if (Math.random() < 0.2) spawnLoot(this.x, this.y, 'shard');
        if (Math.random() < 0.05) spawnLoot(this.x, this.y, 'gear');
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
            const amt = randomInt(5, 15) * GameState.level;
            PlayerData.gold += amt;
            spawnFloatingText(this.x, this.y, `+${amt} Gold`, '#ffd700');
        } else if (this.type === 'shard') {
            PlayerData.shards += 1;
            spawnFloatingText(this.x, this.y, `+1 Shard`, '#00e5ff');
        } else if (this.type === 'gear') {
            PlayerData.shards += 5; 
            spawnFloatingText(this.x, this.y, `+5 Shards (Gear)`, '#bb86fc');
        }
        UI.updateCurrencies();
        saveGame();
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
        ctx.textAlign = 'center'; // Center the text horizontally
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100;
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
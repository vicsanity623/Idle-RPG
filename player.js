/**
 * player.js
 * Isolated Hero Logic, Stat Scaling Formulas & Auto-Cast Skill Entities
 */

// --- HERO-SPECIFIC CONSTANTS ---
const PLAYER_ATTACK_RANGE = 280,
    DASH_DISTANCE = 550,
    LEVEL_SCALING = {
        hp: 0.05,
        atk: 0.04,
        def: 0.03,
        regen: 0.02,
        crit: 0.01
    };

// Placeholder for missing global ACTIVE_SKILLS_CONFIG to prevent ReferenceError.
// In a fully modularized application, this would typically be imported from a shared config.
const ACTIVE_SKILLS_CONFIG = {
    5: { cd: 10 }, // Invincibility
    6: { cd: 8 },  // Scorch Trail
    7: { cd: 15 }, // Heat Wave
    8: { cd: 12 }, // Blink
    9: { cd: 20 }, // Rage
    10: { cd: 18 },// Twister
    11: { cd: 25 },// Summon
    12: { cd: 30 },// Rain Fire
    13: { cd: 22 },// Zen
    14: { cd: 15 },// Pipe Bomb
    22: { cd: 10 },// Frost Nova
    23: { cd: 12 },// Dagger Shield
    // Add other active skills as needed based on their IDs
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
        const playerData = window.PlayerData || {};
        this.skillPoints = playerData.skillPoints || 0;
        this.learnedSkills = playerData.learnedSkills || [];

        this.skills = [
            { id: 'heal', cdMax: 17, current: 0 },
            { id: 'atk', cdMax: 0.7, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 }
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

        // --- BLINK MULTI-STRIKE STATE ---
        this.isBlinking = false;
        this.blinkCount = 0;
        this.blinkTimer = 0;

        // --- 2. CALCULATE HP ---
        this.hp = this.getMaxHp();
    }

    // --- PHASE 2: SKILL AMPLIFICATION HELPER ---
    // Reads how many times a skill was upgraded at the Workbench
    getAmp(skillId) {
        if (window.PlayerData && window.PlayerData.skillAmps && window.PlayerData.skillAmps[skillId]) {
            return window.PlayerData.skillAmps[skillId];
        }
        return 0;
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
        let base = 300 + this.getGearStat('Armor', 'hp') + this.getGearStat('Head', 'hp') + this.getGearStat('Legs', 'hp') + this.getGearStat('Robe', 'hp') + this.getGearStat('Necklace', 'hp');
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
        if (this.rageTimer > 0) final *= 1.5;
        if (this.zenTimer > 0) final *= 3.0;
        if (this.hasSkill(25)) final = Math.floor(final * 1.25); // Ascension
        return Math.floor(final);
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

    update(dt) {
        if (this.hp < this.getMaxHp()) this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);

        // --- BLINK OVERRIDE ---
        if (this.isBlinking) {
            this.handleBlinkSequence(dt);
            return;
        }

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
        for (let r = row - 4; r <= row + 4; r++) {
            for (let c = col - 4; c <= col + 4; c++) {
                if (r >= 0 && r < MAP_SIZE && c >= 0 && c < MAP_SIZE) exploredGrid[r][c] = true;
            }
        }
    }

    handleBlinkSequence(dt) {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
            if (this.blinkCount > 0) {
                let nearest = this.getNearestEnemy(800);
                if (nearest) {
                    entities.push(new BlinkGhostEntity(this.x, this.y, this.color));

                    let angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                    let landX = nearest.x - Math.cos(angle) * 40;
                    let landY = nearest.y - Math.sin(angle) * 40;

                    if (isWall(landX, landY)) { landX = nearest.x; landY = nearest.y; }

                    this.x = landX; this.y = landY;

                    if (typeof spawnSotaParticles === 'function') {
                        spawnSotaParticles(this.x, this.y, '#00ffff', 15, 300);
                        spawnSotaParticles(this.x, this.y, '#ff00ff', 15, 300);
                    }
                    entities.push(new ExpandingRing(this.x, this.y, '#00ffff', 100, 0.2));

                    spawnFloatingText(this.x, this.y - 30, "OMNISLASH!", '#ff00ff');
                    nearest.takeDamage(this.getAttackPower() * 4, true);

                    this.blinkCount--;
                    this.blinkTimer = 0.25;
                } else {
                    this.isBlinking = false;
                }
            } else {
                this.isBlinking = false;
            }
        }
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if (s.current > 0) s.current -= dt; });
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

        UI.updateHotbar();

        for (let i = 0; i < this.skillCooldowns.length; i++) {
            if (this.skillCooldowns[i] > 0) this.skillCooldowns[i] -= dt;
        }

        // --- SKILL AMPLIFICATION INTEGRATION ---

        // 5 Invincibility (+0.5s duration per amp)
        if (this.hasSkill(5) && this.skillCooldowns[5] <= 0) {
            this.invincibleTimer = 3 + (this.getAmp(5) * 0.5);
            this.skillCooldowns[5] = ACTIVE_SKILLS_CONFIG[5].cd;
            spawnFloatingText(this.x, this.y, "INVINCIBLE", '#fff');
            entities.push(new ExpandingRing(this.x, this.y, '#ffd700', 100, 0.4));
        }

        // 6 Scorch Trail (+20% damage per amp)
        if (this.hasSkill(6) && this.skillCooldowns[6] <= 0) {
            this.scorchActiveTimer = 5; this.skillCooldowns[6] = ACTIVE_SKILLS_CONFIG[6].cd;
        }
        if (this.scorchActiveTimer > 0) {
            this.scorchActiveTimer -= dt;
            if (Math.random() < 0.25) {
                let scorchDmg = this.getAttackPower() * (0.5 + (this.getAmp(6) * 0.2));
                entities.push(new ScorchTrailEntity(this.x, this.y, scorchDmg));
            }
        }

        // 7 Heat Wave (+100% damage per amp)
        if (this.hasSkill(7) && this.skillCooldowns[7] <= 0) {
            spawnFloatingText(this.x, this.y, "HEAT WAVE", '#ff5500');
            spawnSotaParticles(this.x, this.y, '#ff5500', 50, 400);
            entities.push(new ExpandingRing(this.x, this.y, '#ff5500', 300, 0.5));
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 250) {
                    let hwDmg = this.getAttackPower() * (3 + this.getAmp(7));
                    e.takeDamage(hwDmg, true);
                    let ang = Math.atan2(e.y - this.y, e.x - this.x);
                    e.x += Math.cos(ang) * 120; e.y += Math.sin(ang) * 120;
                }
            });
            this.skillCooldowns[7] = ACTIVE_SKILLS_CONFIG[7].cd;
        }

        // 8 Blink (+1 Extra Strike per amp)
        if (this.hasSkill(8) && this.skillCooldowns[8] <= 0 && !this.isBlinking) {
            let nearest = this.getNearestEnemy(800);
            if (nearest) {
                this.isBlinking = true;
                this.blinkCount = 3 + this.getAmp(8); // AMP INJECTION    
                this.blinkTimer = 0;
                this.invincibleTimer = 2.0;
                this.skillCooldowns[8] = ACTIVE_SKILLS_CONFIG[8].cd;
            }
        }

        // 9 Rage (+0.5s duration per amp)
        if (this.hasSkill(9) && this.skillCooldowns[9] <= 0) {
            this.rageTimer = 3 + (this.getAmp(9) * 0.5);
            this.skillCooldowns[9] = ACTIVE_SKILLS_CONFIG[9].cd;
            spawnFloatingText(this.x, this.y, "RAGE", '#ff0000');
            entities.push(new ExpandingRing(this.x, this.y, '#ff0000', 150, 0.3));
        }

        // 10 Twister (+100% damage per amp)
        if (this.hasSkill(10) && this.skillCooldowns[10] <= 0) {
            let twistDmg = this.getAttackPower() * (5 + this.getAmp(10));
            entities.push(new TwisterEntity(this.x, this.y, twistDmg, 0));
            entities.push(new TwisterEntity(this.x, this.y, twistDmg, Math.PI));
            this.skillCooldowns[10] = ACTIVE_SKILLS_CONFIG[10].cd;
        }

        // 11 Summon (+200% damage, +1 Chain target per amp)
        if (this.hasSkill(11) && this.skillCooldowns[11] <= 0) {
            let sumDmg = this.getAttackPower() * (9 + (this.getAmp(11) * 2));
            let sumChains = 5 + this.getAmp(11);
            entities.push(new SummonCloneEntity(this.x, this.y, sumDmg, sumChains));
            this.skillCooldowns[11] = ACTIVE_SKILLS_CONFIG[11].cd;
            spawnSotaParticles(this.x, this.y, '#ff0000', 40, 300);
        }

        // 12 Rain Fire (+1 Meteor & +50% damage per amp)
        if (this.hasSkill(12) && this.skillCooldowns[12] <= 0) {
            let meteorCount = 6 + this.getAmp(12);
            let meteorDmg = this.getAttackPower() * (2 + (this.getAmp(12) * 0.5));
            for (let i = 0; i < meteorCount; i++) {
                let tx = this.x + (Math.random() - 0.5) * 500;
                let ty = this.y + (Math.random() - 0.5) * 500;
                entities.push(new RainFireEntity(tx, ty, meteorDmg));
            }
            this.skillCooldowns[12] = ACTIVE_SKILLS_CONFIG[12].cd;
        }

        // 13 Zen (+0.5s duration per amp)
        if (this.hasSkill(13) && this.skillCooldowns[13] <= 0) {
            this.zenTimer = 5 + (this.getAmp(13) * 0.5);
            this.skillCooldowns[13] = ACTIVE_SKILLS_CONFIG[13].cd;
            spawnFloatingText(this.x, this.y, "ZEN", '#fff');
            entities.push(new ExpandingRing(this.x, this.y, '#ffffff', 200, 0.5));
        }

        // 14 Pipe Bomb (+50% reflected damage per amp)
        if (this.hasSkill(14) && this.skillCooldowns[14] <= 0) {
            this.pipeBombTimer = 5; this.pipeBombAbsorbed = 0; this.skillCooldowns[14] = ACTIVE_SKILLS_CONFIG[14].cd;
            spawnFloatingText(this.x, this.y, "ABSORBING", '#ff0');
            entities.push(new ExpandingRing(this.x, this.y, '#ffff00', 150, 5.0));
        }

        if (this.pipeBombTimer > 0) {
            this.pipeBombTimer -= dt;
            if (this.pipeBombTimer <= 0) {
                spawnFloatingText(this.x, this.y, "BOOM!", '#ff0');
                spawnSotaParticles(this.x, this.y, '#ffff00', 80, 500);
                entities.push(new ExpandingRing(this.x, this.y, '#ffff00', 400, 0.6));

                let bombMult = 2 + (this.getAmp(14) * 0.5);
                entities.forEach(e => {
                    if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 300) {
                        e.takeDamage(this.pipeBombAbsorbed * bombMult, true);
                    }
                });
            }
        }

        if (this.hasSkill(17)) {
            let nearby = 0;
            entities.forEach(e => { if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 200) nearby++; });
            if (nearby > 0) this.hp = Math.min(this.getMaxHp(), this.hp + (nearby * 5 * dt));
        }

        // 22 Frost Nova (+0.5s freeze time per amp)
        if (this.hasSkill(22) && this.skillCooldowns[22] <= 0) {
            spawnFloatingText(this.x, this.y, "FROST NOVA", '#00ffff');
            spawnSotaParticles(this.x, this.y, '#00ffff', 60, 300);
            entities.push(new ExpandingRing(this.x, this.y, '#00ffff', 250, 0.4));
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 250) {
                    let freezeDuration = 3 + (this.getAmp(22) * 0.5);
                    if (!e.frozen) { e.frozen = true; e.freezeTimer = freezeDuration; e.oldSpeed = e.speed; e.speed = 0; }
                }
            });
            this.skillCooldowns[22] = ACTIVE_SKILLS_CONFIG[22].cd;
        }

        entities.forEach(e => {
            if (e instanceof Enemy && e.frozen) {
                e.freezeTimer -= dt;
                if (e.freezeTimer <= 0) { e.frozen = false; e.speed = e.oldSpeed; }
            }
        });

        // 23 Dagger Shield (Damage scaling per amp)
        if (this.hasSkill(23) && this.skillCooldowns[23] <= 0) {
            let daggerDmg = this.getAttackPower() * (1 + (this.getAmp(23) * 0.2));
            entities.push(new DaggerShieldEntity(this, daggerDmg));
            this.skillCooldowns[23] = ACTIVE_SKILLS_CONFIG[23].cd;
        }

        // 24 Executioner (+2% execution threshold per amp)
        if (this.hasSkill(24)) {
            entities.forEach(e => {
                let execThreshold = 0.15 + (this.getAmp(24) * 0.02);
                if (e instanceof Enemy && e.hp < e.maxHp * execThreshold && Math.hypot(this.x - e.x, this.y - e.y) < 200) {
                    spawnFloatingText(e.x, e.y, "EXECUTED", '#555');
                    spawnSotaParticles(e.x, e.y, '#555', 20, 200);
                    e.takeDamage(e.hp + 100, true);
                }
            });
        }

        // Timers & Visuals
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

        if (this.isBlinking) {
            this.color = '#00ffff';
        } else if (this.rageTimer > 0) {
            this.rageTimer -= dt;
            this.color = '#ff0000';
            if (Math.random() < 0.2) spawnSotaParticles(this.x, this.y, '#ff0000', 1, 100);
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
            this.skillPoints -= cost;
            this.learnedSkills.push(skillId);
            if (skillId === 3) this.speed *= 1.10;

            if (typeof UI !== 'undefined' && UI.buildHotbar) UI.buildHotbar();
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

        let dx = this.isBlinking ? (Math.random() - 0.5) * 10 : 0;
        let dy = this.isBlinking ? (Math.random() - 0.5) * 10 : 0;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + dx, this.y + dy, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    resetSkills() {
        this.learnedSkills = [];
        this.skillPoints = Math.max(0, (window.PlayerData ? window.PlayerData.level : 1) - 1); // Refunds all earned points
        if (window.PlayerData && typeof window.PlayerData.gold === 'number') {
            window.PlayerData.gold = Math.max(0, window.PlayerData.gold - 1000); // Deducts currency (placeholder)
            if (typeof updateCurrencies === 'function') updateCurrencies();
        }
        if (typeof refreshSkillTreeUI === 'function') refreshSkillTreeUI();
        if (typeof UI !== 'undefined' && UI.buildHotbar) UI.buildHotbar();
    }
}

// --- NEW GHOST ENTITY ---
class BlinkGhostEntity {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 0.5;
        this.markedForDeletion = false;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 0.5);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- AUTO-CAST ENTITY CLASSES ---
class ScorchTrailEntity {
    constructor(x, y, damage) { this.x = x; this.y = y; this.damage = damage; this.life = 5; this.markedForDeletion = false; }
    update(dt) {
        if (this.markedForDeletion) return;
        this.life -= dt;
        entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.x, e.y - this.y) < 25) e.takeDamage(this.damage * dt, false); });
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) { ctx.fillStyle = `rgba(255, 69, 0, ${this.life / 5})`; ctx.beginPath(); ctx.arc(this.x, this.y, 20, 0, Math.PI * 2); ctx.fill(); }
}

class TwisterEntity {
    constructor(x, y, damage, angleOffset) {
        this.damage = damage; this.angle = angleOffset; this.radius = 0; this.life = 5; this.cx = x; this.cy = y;
        this.x = x; this.y = y; this.markedForDeletion = false;
    }
    update(dt) {
        if (this.markedForDeletion) return;
        this.life -= dt; this.angle += dt * 8; this.radius += dt * 60;
        this.x = this.cx + Math.cos(this.angle) * this.radius; this.y = this.cy + Math.sin(this.angle) * this.radius;
        entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.x, e.y - this.y) < 40) e.takeDamage(this.damage * dt, false); });
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) { ctx.fillStyle = 'rgba(200, 200, 255, 0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, 35, 0, Math.PI * 2); ctx.fill(); }
}

class SummonCloneEntity {
    constructor(x, y, damage, maxChains) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.life = 6;
        this.chain = 0;
        this.maxChains = maxChains || 5;
        this.target = null;
        this.markedForDeletion = false;
    }

    update(dt) {
        if (this.markedForDeletion) return;
        this.life -= dt;

        if (this.chain >= this.maxChains || this.life <= 0) {
            this.markedForDeletion = true;
            return;
        }

        if (!this.target || this.target.hp <= 0) {
            this.target = player.getNearestEnemy(1000);
        }

        if (this.target) {
            let dx = this.target.x - this.x;
            let dy = this.target.y - this.y;
            let dist = Math.hypot(dx, dy);

            if (dist < 40) {
                let impactX = this.target.x;
                let impactY = this.target.y;

                this.target.takeDamage(this.damage, true);

                if (typeof spawnSotaParticles === 'function') {
                    spawnSotaParticles(impactX, impactY, '#ff0000', 15, 200);
                }

                this.chain++;
                this.target = null;
            } else {
                this.x += (dx / dist) * 900 * dt;
                this.y += (dy / dist) * 900 * dt;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, player.radius * 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class RainFireEntity {
    constructor(x, y, damage) {
        this.tx = x; this.ty = y; this.damage = damage;
        this.x = x - 200; this.y = y - 800; this.speed = 1500;
        this.markedForDeletion = false;
    }
    update(dt) {
        if (this.markedForDeletion) return;
        let dx = this.tx - this.x, dy = this.ty - this.y, dist = Math.hypot(dx, dy);
        if (dist < 50) {
            if (typeof spawnSotaParticles === 'function') spawnSotaParticles(this.tx, this.ty, '#ff5500', 30, 300);
            entities.push(new ExpandingRing(this.tx, this.ty, '#ff5500', 150, 0.3));

            entities.forEach(e => { if (e instanceof Enemy && Math.hypot(e.x - this.tx, e.y - this.ty) < 150) e.takeDamage(this.damage, false); });
            this.markedForDeletion = true;
        } else { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
    }
    draw(ctx) { ctx.fillStyle = '#ff5500'; ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI * 2); ctx.fill(); }
}

class DaggerShieldEntity {
    constructor(playerRef, damage) {
        this.p = playerRef; this.damage = damage; this.life = 4;
        this.angle = 0; this.x = 0; this.y = 0; this.x2 = 0; this.y2 = 0;
        this.markedForDeletion = false;
    }
    update(dt) {
        if (this.markedForDeletion) return;
        this.life -= dt; this.angle += dt * 8;
        this.x = this.p.x + Math.cos(this.angle) * 80; this.y = this.p.y + Math.sin(this.angle) * 80;
        this.x2 = this.p.x - Math.cos(this.angle) * 80;
        this.y2 = this.p.y - Math.sin(this.angle) * 80;
        entities.forEach(e => {
            if (e instanceof Enemy) {
                if (Math.hypot(e.x - this.x, e.y - this.y) < 30) e.takeDamage(this.damage * dt * 5, false);
                if (Math.hypot(e.x - this.x2, e.y - this.y2) < 30) e.takeDamage(this.damage * dt * 5, false);
            }
        });
        if (this.life <= 0) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x2, this.y2, 10, 0, Math.PI * 2); ctx.fill();
    }
}

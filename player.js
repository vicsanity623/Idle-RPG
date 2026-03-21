/**
 * player.js
 * Defines the Player class and its core logic.
 */

// Player class needs access to global PlayerData and getAggregatedTalentEffects from main.js
// Assuming PlayerData, SKILL_TREE_NODES, and getAggregatedTalentEffects are globally available
// (e.g., defined in main.js and loaded before player.js in index.html)

class Player {
    /**
     * @param {number} x - Initial X position.
     * @param {number} y - Initial Y position.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 200; // pixels per second
        this.hp = this.getMaxHp();
        this.maxHp = this.getMaxHp(); // Initial max HP
        this.isAlive = true;
        this.attackCooldown = 0;
        this.attackSpeed = 1.0; // Base attacks per second
        this.lastAttackTime = 0;
    }

    /**
     * Calculates the player's maximum HP, including gear and talent bonuses.
     * @returns {number}
     */
    getMaxHp() {
        let baseHp = 100;
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].hp) baseHp += PlayerData.gear[type].hp;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseHp + talentEffects.hp;
    }

    /**
     * Calculates the player's attack power, including gear and talent bonuses.
     * @returns {number}
     */
    getAttackPower() {
        let baseAtk = 10;
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].atk) baseAtk += PlayerData.gear[type].atk;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseAtk + talentEffects.atk;
    }

    /**
     * Calculates the player's defense, including gear and talent bonuses.
     * @returns {number}
     */
    getDefense() {
        let baseDef = 0;
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].def) baseDef += PlayerData.gear[type].def;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseDef + talentEffects.def;
    }

    /**
     * Calculates the player's HP regeneration per second, including gear and talent bonuses.
     * @returns {number}
     */
    getRegen() {
        let baseRegen = 0.1; // Base regen
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].regen) baseRegen += PlayerData.gear[type].regen;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseRegen + talentEffects.regen;
    }

    /**
     * Calculates the player's critical hit chance, including gear and talent bonuses.
     * @returns {number} Percentage (e.g., 10 for 10%)
     */
    getCritChance() {
        let baseCritChance = 5; // Base 5% crit chance
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].critChance) baseCritChance += PlayerData.gear[type].critChance;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseCritChance + talentEffects.critChance;
    }

    /**
     * Calculates the player's critical hit multiplier, including gear and talent bonuses.
     * @returns {number} Multiplier (e.g., 1.5 for 150% damage)
     */
    getCritMultiplier() {
        let baseCritMult = 1.5; // Base 1.5x crit multiplier
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].critMult) baseCritMult += PlayerData.gear[type].critMult;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseCritMult + talentEffects.critMult;
    }

    /**
     * Calculates the player's attack speed bonus (reduction in cooldown), including gear and talent bonuses.
     * @returns {number} Factor (e.g., 0.02 for 2% cooldown reduction)
     */
    getAttackSpeedBonus() {
        let baseAtkSpeed = 0;
        for (const type in PlayerData.gear) {
            if (PlayerData.gear[type].atkSpeed) baseAtkSpeed += PlayerData.gear[type].atkSpeed;
        }
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return baseAtkSpeed + talentEffects.atkSpeed;
    }

    /**
     * Calculates the player's gold find bonus, including talent bonuses.
     * @returns {number} Percentage (e.g., 0.05 for 5% more gold)
     */
    getGoldFindBonus() {
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return talentEffects.goldFind;
    }

    /**
     * Calculates the player's XP gain bonus, including talent bonuses.
     * @returns {number} Percentage (e.g., 0.10 for 10% more XP)
     */
    getXpGainBonus() {
        const talentEffects = getAggregatedTalentEffects(PlayerData.unlockedTalents);
        return talentEffects.xpGain;
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        const damageTaken = Math.max(1, amount - this.getDefense());
        this.hp -= damageTaken;
        spawnFloatingText(this.x, this.y - 20, Math.floor(damageTaken).toString(), 'red');
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            die();
        }
        UI.updateStats();
    }

    update(dt) {
        if (!this.isAlive) return;

        // Update max HP in case gear/talents changed
        this.maxHp = this.getMaxHp();
        // Regenerate HP
        this.hp = Math.min(this.maxHp, this.hp + this.getRegen() * dt);

        // Movement
        if (Input.joystick.active) {
            const moveX = Math.cos(Input.joystick.angle) * this.speed * dt;
            const moveY = Math.sin(Input.joystick.angle) * this.speed * dt;

            const newX = this.x + moveX;
            const newY = this.y + moveY;

            // Simple collision detection (check corners of player bounding box)
            const halfSize = this.radius * 0.7; // Use a slightly smaller box for collision
            const corners = [
                { x: newX - halfSize, y: newY - halfSize },
                { x: newX + halfSize, y: newY - halfSize },
                { x: newX - halfSize, y: newY + halfSize },
                { x: newX + halfSize, y: newY + halfSize }
            ];

            let canMoveX = true;
            let canMoveY = true;

            for (const corner of corners) {
                if (isWall(corner.x, this.y)) canMoveX = false;
                if (isWall(this.x, corner.y)) canMoveY = false;
            }

            if (canMoveX) this.x = newX;
            if (canMoveY) this.y = newY;
        }

        // Attack logic (auto-attack nearest enemy)
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
            const enemies = entities.filter(e => e instanceof Enemy && e.isAlive);
            if (enemies.length > 0) {
                let nearestEnemy = null;
                let minDist = Infinity;
                for (const enemy of enemies) {
                    const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEnemy = enemy;
                    }
                }

                if (nearestEnemy && minDist < 500) { // Attack range
                    spawnProjectile(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
                    // Calculate actual attack speed based on bonus
                    const effectiveAttackSpeed = this.attackSpeed * (1 + this.getAttackSpeedBonus());
                    this.attackCooldown = 1.0 / effectiveAttackSpeed;
                }
            }
        }

        // Check for portal interaction
        if (portal && Math.hypot(this.x - portal.x, this.y - portal.y) < this.radius + portal.radius) {
            levelUpDungeon();
        }

        // Explore map
        const pRow = Math.floor(this.y / TILE_SIZE);
        const pCol = Math.floor(this.x / TILE_SIZE);
        for (let r = Math.max(0, pRow - 2); r <= Math.min(MAP_SIZE - 1, pRow + 2); r++) {
            for (let c = Math.max(0, pCol - 2); c <= Math.min(MAP_SIZE - 1, pCol + 2); c++) {
                exploredGrid[r][c] = true;
            }
        }

        UI.updateStats();
        UI.updateCurrencies();
    }

    draw(ctx) {
        if (!this.isAlive) return;
        ctx.save();
        ctx.fillStyle = '#bb86fc';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#03dac6';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}
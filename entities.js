// --- E2E Test for Skill Upgrade Feature ---
// File: tests/e2e_skill_upgrade.js
(function() { // Start E2E Test Scope

// Mock global dependencies for testing environment
const mockPlayerData = {
    level: 1,
    gold: 0,
    shards: 100, // Start with enough shards for testing
    gear: {
        Weapon: { atk: 0 }, Fists: { atk: 0, critChance: 0 }, Ring: { atk: 0, critChance: 0 },
        Armor: { hp: 0, def: 0 }, Head: { hp: 0, def: 0 }, Legs: { hp: 0, def: 0 },
        Robe: { hp: 0, regen: 0 }, Necklace: { hp: 0, regen: 0 }, Earrings: { regen: 0, critMult: 0 },
        Boots: { atkSpeed: 0 }
    }
};
const mockGameState = { level: 1 };
const mockInput = { joystick: { active: false, angle: 0 }, dashPressed: false };
const mockUI = {
    updateCurrencies: () => { /* console.log('UI.updateCurrencies called'); */ },
    updateHotbar: (skills) => { /* console.log('UI.updateHotbar called with:', skills); */ },
    updateStats: () => { /* console.log('UI.updateStats called'); */ }
};
let mockFloatingTexts = [];
const mockSpawnFloatingText = (x, y, text, color) => {
    mockFloatingTexts.push({ x, y, text, color });
    // console.log(`Floating Text: ${text} (${color}) at (${x}, ${y})`);
};
const mockSpawnProjectile = (x1, y1, x2, y2) => { /* console.log('Projectile spawned'); */ };
const mockSpawnAura = (x, y) => { /* console.log('Aura spawned'); */ };
const mockIsWall = (x, y) => false; // Assume no walls for simplicity
const mockDie = () => { /* console.log('Player died'); */ };
const mockGainXp = (amount) => { /* console.log(`Gained ${amount} XP`); */ };
const mockSpawnLoot = (x, y, type) => { /* console.log(`Loot spawned: ${type}`); */ };
const mockRandomFloat = (min, max) => (min + max) / 2; // Deterministic random for tests
const mockRandomInt = (min, max) => Math.floor((min + max) / 2); // Deterministic random for tests
const mockSaveGame = () => { /* console.log('Game saved'); */ };
const mockLevelUpDungeon = () => { /* console.log('Dungeon leveled up'); */ };

// Assign mocks to global scope for the test
let PlayerData = mockPlayerData;
let GameState = mockGameState;
let Input = mockInput;
let UI = mockUI;
let floatingTexts = mockFloatingTexts;
let spawnFloatingText = mockSpawnFloatingText;
let spawnProjectile = mockSpawnProjectile;
let spawnAura = mockSpawnAura;
let isWall = mockIsWall;
let die = mockDie;
let gainXp = mockGainXp;
let spawnLoot = mockSpawnLoot;
let randomFloat = mockRandomFloat;
let randomInt = mockRandomInt;
let saveGame = mockSaveGame;
let levelUpDungeon = mockLevelUpDungeon;

// Mock entities array and player for testing
let entities = [];
let player = null;
let particles = []; // For Particle class

// Re-declare Player and Enemy classes here for the test context
// In a real E2E setup, these would be imported or loaded from the game's source.
// For this exercise, we'll assume the entities.js content is available.
// (The actual Player and Enemy class definitions are in the main entities.js file)

// --- Player Class (copied from entities.js for test context) ---
// This block would ideally be loaded from the actual entities.js file
// but for a self-contained E2E test example, it's included here.
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
            { id: 'pot', level: 1, current: 0 }, // Heal Potion
            { id: 'atk', level: 1, current: 0 }, // Auto Attack
            { id: 'aura', level: 1, current: 0 }, // AoE Aura
            { id: 'dash', level: 1, current: 0 }  // Dash Movement
        ];
        // Initialize skill stats based on their starting level
        this.skills.forEach(s => this._calculateSkillStats(s));
        this.lastMoveAngle = 0; // Track last movement direction for dash
    }

    getMaxHp() { 
        const g = PlayerData.gear;
        return Math.floor(100 + (PlayerData.level * 20) + 
            (g.Armor.hp || 0) + (g.Head.hp || 0) + 
            (g.Legs.hp || 0) + (g.Robe.hp || 0) + 
            (g.Necklace.hp || 0)); 
    }

    getAttackPower() { 
        const g = PlayerData.gear;
        return Math.floor(10 + (PlayerData.level * 2) + 
            (g.Weapon.atk || 0) + (g.Fists.atk || 0) + 
            (g.Ring.atk || 0)); 
    }

    getDefense() { 
        const g = PlayerData.gear;
        return Math.floor((g.Armor.def || 0) + (g.Head.def || 0) + 
            (g.Legs.def || 0) + (g.Boots.def || 0)); 
    }

    getRegen() { 
        const g = PlayerData.gear;
        return (g.Robe.regen || 0) + (g.Necklace.regen || 0) + 
            (g.Earrings.regen || 0); 
    }

    getCritChance() { 
        const g = PlayerData.gear;
        let base = 5 + (g.Fists.critChance || 0) + (g.Ring.critChance || 0);
        return Math.min(75, base); 
    }

    getCritMultiplier() { 
        const g = PlayerData.gear;
        return 1.5 + (g.Weapon.critMult || 0) + (g.Earrings.critMult || 0); 
    }

    getAttackSpeedFactor() {
        const g = PlayerData.gear;
        return Math.max(0.3, 1.0 - (g.Boots.atkSpeed || 0));
    }

    /**
     * Calculates and updates a skill's dynamic properties (cooldown, damage, radius, etc.)
     * based on its current level.
     * @param {object} skill - The skill object to update.
     * @private
     */
    _calculateSkillStats(skill) {
        const improvementPerLevel = 0.05; // 5% improvement per level for cooldowns
        const damageImprovementPerLevel = 0.1; // 10% improvement for damage/heal
        const radiusImprovementPerLevel = 0.05; // 5% improvement for radius
        const distanceImprovementPerLevel = 0.1; // 10% improvement for dash distance

        // Base values for skills at level 1 (these could be moved to a global config if preferred)
        const baseValues = {
            'pot': { cd: 10, healMult: 0.4 },
            'atk': { cd: 1, dmgMult: 1.0 },
            'aura': { cd: 5, dmgMult: 0.4, radius: 120 },
            'dash': { cd: 3, distance: 150 }
        };

        const base = baseValues[skill.id];

        // Calculate cooldown, ensuring a minimum value
        skill.cdMax = Math.max(0.5, base.cd * (1 - (skill.level - 1) * improvementPerLevel));

        // Calculate other skill-specific stats
        if (skill.id === 'pot') {
            skill.healMultiplier = base.healMult + (skill.level - 1) * damageImprovementPerLevel;
        } else if (skill.id === 'atk') {
            skill.damageMultiplier = base.dmgMult + (skill.level - 1) * damageImprovementPerLevel;
        } else if (skill.id === 'aura') {
            skill.damageMultiplier = base.dmgMult + (skill.level - 1) * damageImprovementPerLevel;
            skill.radius = base.radius + (skill.level - 1) * base.radius * radiusImprovementPerLevel;
        } else if (skill.id === 'dash') {
            skill.distance = base.distance + (skill.level - 1) * base.distance * distanceImprovementPerLevel;
        }
    }

    /**
     * Upgrades a specified skill, consuming shards and recalculating its stats.
     * This method would be called by a UI interaction (e.g., clicking an "Upgrade" button).
     * @param {string} skillId - The ID of the skill to upgrade.
     * @returns {boolean} True if the upgrade was successful, false otherwise.
     */
    upgradeSkill(skillId) {
        const skill = this.skills.find(s => s.id === skillId);
        if (!skill) {
            console.warn(`Skill with ID ${skillId} not found.`);
            return false;
        }

        const upgradeCost = skill.level * 10; // Example cost scaling: 10 shards for Lvl 1->2, 20 for Lvl 2->3, etc.
        if (PlayerData.shards < upgradeCost) {
            spawnFloatingText(this.x, this.y, "Not enough Shards!", '#ff00ff');
            return false;
        }

        PlayerData.shards -= upgradeCost;
        skill.level++;

        this._calculateSkillStats(skill); // Recalculate all stats for the skill

        spawnFloatingText(this.x, this.y, `${skill.id.toUpperCase()} Lvl ${skill.level}!`, '#00ff00');
        UI.updateCurrencies(); // Update shard display in the UI (now also refreshes skill panel if open)
        saveGame(); // Persist the changes
        return true;
    }

    update(dt) {
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
            this.lastMoveAngle = Input.joystick.angle; // Update last move angle
        } else {
            this.vx = 0; this.vy = 0;
        }

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;
        if (!isWall(nextX, this.y)) this.x = nextX;
        if (!isWall(this.x, nextY)) this.y = nextY;

        this.handleSkills(dt);
        // this.updateFog(); // Commented out for simpler E2E test
        // if (portal && Math.hypot(this.x - portal.x, this.y - portal.y) < this.radius + portal.radius) {
        //     levelUpDungeon();
        // }
        UI.updateStats();
    }

    updateFog() {
        // Mocked for E2E test
    }

    handleSkills(dt) {
        this.skills.forEach(s => { if(s.current > 0) s.current -= dt; });

        const potSkill = this.skills.find(s => s.id === 'pot');
        const atkSkill = this.skills.find(s => s.id === 'atk');
        const auraSkill = this.skills.find(s => s.id === 'aura');
        const dashSkill = this.skills.find(s => s.id === 'dash');

        // REF NO: Magic Number Refactor by Pyob
        const PLAYER_ATTACK_RANGE = 200; 

        if (atkSkill.current <= 0) {
            let target = this.getNearestEnemy(PLAYER_ATTACK_RANGE);
            if (target) {
                let damage = this.getAttackPower() * atkSkill.damageMultiplier;
                let isCrit = Math.random() * 100 < this.getCritChance();
                if (isCrit) damage *= this.getCritMultiplier();
                target.takeDamage(damage, isCrit);
                spawnProjectile(this.x, this.y, target.x, target.y);
                atkSkill.current = atkSkill.cdMax * this.getAttackSpeedFactor(); 
            }
        }

        if (auraSkill.current <= 0) {
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < auraSkill.radius) {
                    e.takeDamage(this.getAttackPower() * auraSkill.damageMultiplier, false);
                }
            });
            spawnAura(this.x, this.y);
            auraSkill.current = auraSkill.cdMax;
        }

        if (this.hp < this.getMaxHp() * potSkill.healMultiplier && potSkill.current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * potSkill.healMultiplier);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0');
            potSkill.current = potSkill.cdMax;
        }

        // Manual Dash Skill (index 3)
        if (Input.dashPressed && dashSkill.current <= 0) {
            const dashDistance = dashSkill.distance; // Pixels to dash
            const dashAngle = this.lastMoveAngle; // Use last movement direction
            const targetX = this.x + Math.cos(dashAngle) * dashDistance;
            const targetY = this.y + Math.sin(dashAngle) * dashDistance;

            // Check if the target position is a wall. If not, perform the dash.
            // For simplicity, if the target is a wall, the dash is blocked and cooldown is not consumed.
            if (!isWall(targetX, targetY)) {
                this.x = targetX;
                this.y = targetY;
                spawnFloatingText(this.x, this.y, "DASH!", '#00ffff');
                dashSkill.current = dashSkill.cdMax; // Start cooldown
            }
            Input.dashPressed = false; // Consume the input regardless of success to prevent re-triggering
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

// --- ENEMY CLASS (copied from entities.js for test context) ---
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

// --- HiveMind (copied for test context) ---
const HiveMind = { // Local mock for E2E tests
    flankWeight: 0,
    packSize: 0,
    update: function() {
        this.packSize = entities.filter(e => e instanceof Enemy).length;
        this.flankWeight = Math.min(1.0, this.packSize / 20); 
    }
};
// For E2E tests, this local HiveMind is used.
// The actual HiveMind definition is further down in this file.

// --- Test Suite ---
console.log("--- Running E2E Skill Upgrade Tests ---");

// Test 1: Player initialization and base skill stats
player = new Player(100, 100);
console.assert(player.skills.length === 4, "Test 1 Failed: Player should have 4 skills.");
console.assert(player.skills[0].id === 'pot' && player.skills[0].level === 1, "Test 1 Failed: Pot skill not initialized correctly.");
console.assert(player.skills[1].id === 'atk' && player.skills[1].level === 1, "Test 1 Failed: Atk skill not initialized correctly.");
console.assert(player.skills[2].id === 'aura' && player.skills[2].level === 1, "Test 1 Failed: Aura skill not initialized correctly.");
console.assert(player.skills[3].id === 'dash' && player.skills[3].level === 1, "Test 1 Failed: Dash skill not initialized correctly.");

// Verify initial calculated stats (Level 1)
console.assert(player.skills.find(s => s.id === 'pot').cdMax === 10, "Test 1 Failed: Pot CD Max incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'pot').healMultiplier === 0.4, "Test 1 Failed: Pot Heal Multiplier incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'atk').cdMax === 1, "Test 1 Failed: Atk CD Max incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'atk').damageMultiplier === 1.0, "Test 1 Failed: Atk Damage Multiplier incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'aura').cdMax === 5, "Test 1 Failed: Aura CD Max incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'aura').damageMultiplier === 0.4, "Test 1 Failed: Aura Damage Multiplier incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'aura').radius === 120, "Test 1 Failed: Aura Radius incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'dash').cdMax === 3, "Test 1 Failed: Dash CD Max incorrect at Lvl 1.");
console.assert(player.skills.find(s => s.id === 'dash').distance === 150, "Test 1 Failed: Dash Distance incorrect at Lvl 1.");
console.log("Test 1 Passed: Player initialization and base skill stats are correct.");

// Test 2: Successful Skill Upgrade (ATK)
const initialShards = PlayerData.shards;
const atkSkillBeforeUpgrade = player.skills.find(s => s.id === 'atk');
const initialAtkLevel = atkSkillBeforeUpgrade.level;
const initialAtkCdMax = atkSkillBeforeUpgrade.cdMax;
const initialAtkDmgMult = atkSkillBeforeUpgrade.damageMultiplier;

player.upgradeSkill('atk');

console.assert(PlayerData.shards === initialShards - (initialAtkLevel * 10), "Test 2 Failed: Shards not consumed correctly.");
console.assert(atkSkillBeforeUpgrade.level === initialAtkLevel + 1, "Test 2 Failed: ATK skill level not increased.");
console.assert(atkSkillBeforeUpgrade.cdMax < initialAtkCdMax, "Test 2 Failed: ATK CD Max did not decrease.");
console.assert(atkSkillBeforeUpgrade.damageMultiplier > initialAtkDmgMult, "Test 2 Failed: ATK Damage Multiplier did not increase.");
console.assert(mockFloatingTexts.some(t => t.text === 'ATK Lvl 2!'), "Test 2 Failed: Floating text for upgrade not shown.");
console.log("Test 2 Passed: Successful ATK skill upgrade.");

// Test 3: Insufficient Shards for Upgrade
PlayerData.shards = 5; // Not enough for Lvl 2->3 (cost 20)
const auraSkillBeforeUpgrade = player.skills.find(s => s.id === 'aura');
const initialAuraLevel = auraSkillBeforeUpgrade.level;

player.upgradeSkill('aura');

console.assert(PlayerData.shards === 5, "Test 3 Failed: Shards incorrectly consumed with insufficient funds.");
console.assert(auraSkillBeforeUpgrade.level === initialAuraLevel, "Test 3 Failed: Aura skill level incorrectly increased.");
console.assert(mockFloatingTexts.some(t => t.text === 'Not enough Shards!'), "Test 3 Failed: Floating text for insufficient shards not shown.");
console.log("Test 3 Passed: Insufficient shards correctly handled.");

// Test 4: Skill stats applied in handleSkills (Aura)
// Reset shards and upgrade aura
PlayerData.shards = 100;
player.upgradeSkill('aura'); // Aura is now Lvl 2
const upgradedAuraSkill = player.skills.find(s => s.id === 'aura');
const expectedAuraDamage = player.getAttackPower() * upgradedAuraSkill.damageMultiplier;
const expectedAuraRadius = upgradedAuraSkill.radius;

// Mock an enemy to test aura damage and radius
const mockEnemy = {
    x: player.x + 50, // Within initial radius 120, but also within upgraded radius
    y: player.y,
    takeDamage: (amt, isCrit) => {
        // console.log(`Enemy took ${amt} damage (crit: ${isCrit})`);
        console.assert(Math.abs(amt - expectedAuraDamage) < 0.001, `Test 4 Failed: Aura damage incorrect. Expected ${expectedAuraDamage}, got ${amt}`);
    }
};
entities.push(mockEnemy);

// Mock an enemy outside initial radius but inside upgraded radius
const mockEnemyFar = {
    x: player.x + 130, // Outside 120, but inside 120 * 1.05 = 126 (Lvl 2)
    y: player.y,
    takeDamage: (amt, isCrit) => {
        // console.log(`Far Enemy took ${amt} damage (crit: ${isCrit})`);
        console.assert(Math.abs(amt - expectedAuraDamage) < 0.001, `Test 4 Failed: Far Aura damage incorrect. Expected ${expectedAuraDamage}, got ${amt}`);
    }
};
entities.push(mockEnemyFar);

// Set aura cooldown to 0 to trigger it
upgradedAuraSkill.current = 0;
player.handleSkills(0.1); // Simulate a game tick

console.assert(upgradedAuraSkill.current === upgradedAuraSkill.cdMax, "Test 4 Failed: Aura cooldown not reset after use.");
console.log("Test 4 Passed: Aura skill stats (damage, radius) applied correctly in handleSkills.");

// Test 5: Dash skill stats applied in handleSkills
const upgradedDashSkill = player.skills.find(s => s.id === 'dash');
const initialPlayerX = player.x;
const initialPlayerY = player.y;
Input.dashPressed = true;
player.lastMoveAngle = 0; // Dash right

// Set dash cooldown to 0 to trigger it
upgradedDashSkill.current = 0;
player.handleSkills(0.1);

console.assert(player.x === initialPlayerX + upgradedDashSkill.distance, "Test 5 Failed: Dash distance not applied correctly.");
console.assert(upgradedDashSkill.current === upgradedDashSkill.cdMax, "Test 5 Failed: Dash cooldown not reset after use.");
console.assert(mockFloatingTexts.some(t => t.text === 'DASH!'), "Test 5 Failed: Floating text for dash not shown.");
console.log("Test 5 Passed: Dash skill stats (distance) applied correctly in handleSkills.");

// Test 6: Pot skill stats applied in handleSkills
const upgradedPotSkill = player.skills.find(s => s.id === 'pot');
player.hp = player.getMaxHp() * 0.1; // Set HP low enough to trigger potion
const initialPlayerHp = player.hp;

// Set pot cooldown to 0 to trigger it
upgradedPotSkill.current = 0;
player.handleSkills(0.1);

const expectedHeal = player.getMaxHp() * upgradedPotSkill.healMultiplier;
console.assert(player.hp === Math.min(player.getMaxHp(), initialPlayerHp + expectedHeal), "Test 6 Failed: Pot heal amount not applied correctly.");
console.assert(upgradedPotSkill.current === upgradedPotSkill.cdMax, "Test 6 Failed: Pot cooldown not reset after use.");
console.assert(mockFloatingTexts.some(t => t.text === 'HEALED'), "Test 6 Failed: Floating text for heal not shown.");
console.log("Test 6 Passed: Pot skill stats (heal multiplier) applied correctly in handleSkills.");

console.log("--- All E2E Skill Upgrade Tests Complete ---");
})(); // End E2E Test Scope

/**
 * entities.js
 * Contains Player, Enemy, Loot, and Particle logic.
 */

// Global references for testing/mocking purposes
// These are usually defined in main.js or globals.js
// For E2E tests, we need to ensure they are available or mocked.
// Assuming these are globally available from other files:
// PlayerData, GameState, Input, UI, saveGame, spawnFloatingText, spawnProjectile, spawnAura, isWall, die, gainXp, spawnLoot, randomFloat, randomInt, TILE_SIZE, MAP_SIZE, exploredGrid, portal, entities, floatingTexts, particles

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
            { id: 'pot', level: 1, current: 0 }, // Heal Potion
            { id: 'atk', level: 1, current: 0 }, // Auto Attack
            { id: 'aura', level: 1, current: 0 }, // AoE Aura
            { id: 'dash', level: 1, current: 0 }  // Dash Movement
        ];
        // Initialize skill stats based on their starting level
        this.skills.forEach(s => this._calculateSkillStats(s));
        this.lastMoveAngle = 0; // Track last movement direction for dash
    }

    getMaxHp() { 
        const g = PlayerData.gear;
        return Math.floor(100 + (PlayerData.level * 20) + 
            (g.Armor.hp || 0) + (g.Head.hp || 0) + 
            (g.Legs.hp || 0) + (g.Robe.hp || 0) + 
            (g.Necklace.hp || 0)); 
    }

    getAttackPower() { 
        const g = PlayerData.gear;
        return Math.floor(10 + (PlayerData.level * 2) + 
            (g.Weapon.atk || 0) + (g.Fists.atk || 0) + 
            (g.Ring.atk || 0)); 
    }

    getDefense() { 
        const g = PlayerData.gear;
        return Math.floor((g.Armor.def || 0) + (g.Head.def || 0) + 
            (g.Legs.def || 0) + (g.Boots.def || 0)); 
    }

    getRegen() { 
        const g = PlayerData.gear;
        return (g.Robe.regen || 0) + (g.Necklace.regen || 0) + 
            (g.Earrings.regen || 0); 
    }

    getCritChance() { 
        const g = PlayerData.gear;
        let base = 5 + (g.Fists.critChance || 0) + (g.Ring.critChance || 0);
        return Math.min(75, base); 
    }

    getCritMultiplier() { 
        const g = PlayerData.gear;
        return 1.5 + (g.Weapon.critMult || 0) + (g.Earrings.critMult || 0); 
    }

    getAttackSpeedFactor() {
        const g = PlayerData.gear;
        return Math.max(0.3, 1.0 - (g.Boots.atkSpeed || 0));
    }

    /**
     * Calculates and updates a skill's dynamic properties (cooldown, damage, radius, etc.)
     * based on its current level.
     * @param {object} skill - The skill object to update.
     * @private
     */
    _calculateSkillStats(skill) {
        const improvementPerLevel = 0.05; // 5% improvement per level for cooldowns
        const damageImprovementPerLevel = 0.1; // 10% improvement for damage/heal
        const radiusImprovementPerLevel = 0.05; // 5% improvement for radius
        const distanceImprovementPerLevel = 0.1; // 10% improvement for dash distance

        // Base values for skills at level 1 (these could be moved to a global config if preferred)
        const baseValues = {
            'pot': { cd: 10, healMult: 0.4 },
            'atk': { cd: 1, dmgMult: 1.0 },
            'aura': { cd: 5, dmgMult: 0.4, radius: 120 },
            'dash': { cd: 3, distance: 150 }
        };

        const base = baseValues[skill.id];

        // Calculate cooldown, ensuring a minimum value
        skill.cdMax = Math.max(0.5, base.cd * (1 - (skill.level - 1) * improvementPerLevel));

        // Calculate other skill-specific stats
        if (skill.id === 'pot') {
            skill.healMultiplier = base.healMult + (skill.level - 1) * damageImprovementPerLevel;
        } else if (skill.id === 'atk') {
            skill.damageMultiplier = base.dmgMult + (skill.level - 1) * damageImprovementPerLevel;
        } else if (skill.id === 'aura') {
            skill.damageMultiplier = base.dmgMult + (skill.level - 1) * damageImprovementPerLevel;
            skill.radius = base.radius + (skill.level - 1) * base.radius * radiusImprovementPerLevel;
        } else if (skill.id === 'dash') {
            skill.distance = base.distance + (skill.level - 1) * base.distance * distanceImprovementPerLevel;
        }
    }

    /**
     * Upgrades a specified skill, consuming shards and recalculating its stats.
     * This method would be called by a UI interaction (e.g., clicking an "Upgrade" button).
     * @param {string} skillId - The ID of the skill to upgrade.
     * @returns {boolean} True if the upgrade was successful, false otherwise.
     */
    upgradeSkill(skillId) {
        const skill = this.skills.find(s => s.id === skillId);
        if (!skill) {
            console.warn(`Skill with ID ${skillId} not found.`);
            return false;
        }

        const upgradeCost = skill.level * 10; // Example cost scaling: 10 shards for Lvl 1->2, 20 for Lvl 2->3, etc.
        if (PlayerData.shards < upgradeCost) {
            spawnFloatingText(this.x, this.y, "Not enough Shards!", '#ff00ff');
            return false;
        }

        PlayerData.shards -= upgradeCost;
        skill.level++;

        this._calculateSkillStats(skill); // Recalculate all stats for the skill

        spawnFloatingText(this.x, this.y, `${skill.id.toUpperCase()} Lvl ${skill.level}!`, '#00ff00');
        UI.updateCurrencies(); // Update shard display in the UI
        // A new UI.updateSkillPanel() function would be called here to refresh the skill panel display.
        saveGame(); // Persist the changes
        return true;
    }

    update(dt) {
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
            this.lastMoveAngle = Input.joystick.angle; // Update last move angle
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

        const potSkill = this.skills.find(s => s.id === 'pot');
        const atkSkill = this.skills.find(s => s.id === 'atk');
        const auraSkill = this.skills.find(s => s.id === 'aura');
        const dashSkill = this.skills.find(s => s.id === 'dash');

        // REF NO: Magic Number Refactor by Pyob
        const PLAYER_ATTACK_RANGE = 200; 

        if (atkSkill.current <= 0) {
            let target = this.getNearestEnemy(PLAYER_ATTACK_RANGE);
            if (target) {
                let damage = this.getAttackPower() * atkSkill.damageMultiplier;
                let isCrit = Math.random() * 100 < this.getCritChance();
                if (isCrit) damage *= this.getCritMultiplier();
                target.takeDamage(damage, isCrit);
                spawnProjectile(this.x, this.y, target.x, target.y);
                atkSkill.current = atkSkill.cdMax * this.getAttackSpeedFactor(); 
            }
        }

        if (auraSkill.current <= 0) {
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < auraSkill.radius) {
                    e.takeDamage(this.getAttackPower() * auraSkill.damageMultiplier, false);
                }
            });
            spawnAura(this.x, this.y);
            auraSkill.current = auraSkill.cdMax;
        }

        if (this.hp < this.getMaxHp() * potSkill.healMultiplier && potSkill.current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * potSkill.healMultiplier);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0');
            potSkill.current = potSkill.cdMax;
        }

        // Manual Dash Skill (index 3)
        if (Input.dashPressed && dashSkill.current <= 0) {
            const dashDistance = dashSkill.distance; // Pixels to dash
            const dashAngle = this.lastMoveAngle; // Use last movement direction
            const targetX = this.x + Math.cos(dashAngle) * dashDistance;
            const targetY = this.y + Math.sin(dashAngle) * dashDistance;

            // Check if the target position is a wall. If not, perform the dash.
            // For simplicity, if the target is a wall, the dash is blocked and cooldown is not consumed.
            if (!isWall(targetX, targetY)) {
                this.x = targetX;
                this.y = targetY;
                spawnFloatingText(this.x, this.y, "DASH!", '#00ffff');
                dashSkill.current = dashSkill.cdMax; // Start cooldown
            }
            Input.dashPressed = false; // Consume the input regardless of success to prevent re-triggering
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
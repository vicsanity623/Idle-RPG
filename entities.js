/**
 * Game Entities Module
 * Standards: ES6 Classes, Optimized Math, State-Driven Animations
 */

class Entity {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.hp = 100;
        this.maxHp = 100;
        this.target = null;
        this.isDead = false;
    }

    // High-performance distance check (Squared)
    distSq(other) {
        return (this.x - other.x) ** 2 + (this.y - other.y) ** 2;
    }

    // Standard distance for UI/Logic
    distanceTo(other) {
        return Math.sqrt(this.distSq(other));
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 20, 300);
        this.hp = 1000;
        this.maxHp = 1000;
        this.mp = 200;
        this.maxMp = 200;
        this.mpRegen = 10; // Per second

        this.level = 1;
        this.xp = 0;
        this.maxXp = 500;
        this.gold = 0;

        this.attackRange = 125;
        this.attackCooldown = 0.6; // Seconds between attacks
        this.attackTimer = 0;

        this.inventory = [];
        this.equipment = {
            head: null, armor: null, hands: null,
            legs: null, cape: null, amulet: null,
            ring1: null, ring2: null
        };

        // Cached Stats (Performance)
        this.baseStats = {
            atkSpeed: 100, skillSpeed: 100, attack: 10, magicAtk: 0, weaponAtk: 0,
            fatalityRate: 0, critRate: 5, magicCritRate: 0, bashRate: 0, magicBashRate: 0,
            accuracy: 100, magicAccuracy: 100,

            maxHp: 1000, defense: 0, basicAtkRes: 0, skillDmgRes: 0, finalDmgRes: 0,
            dmgReduction: 0, evade: 5, block: 0,

            moveSpeed: 100, cdReduction: 0, hpRecovery: 1, hpPotionRcvRate: 100,
            maxHpPotionCap: 1000, mpRecovery: 10,

            immobileHitRate: 0, immobileRes: 0,
            statusTimeInc: 0, statusTimeDec: 0, statusHitRate: 0, statusRes: 0,
            weakTimeInc: 0, weakTimeDec: 0, weakHitRate: 0, weakRes: 0,

            maxQuests: 5, maxDailyCorps: 3
        };
        this.stats = { ...this.baseStats };

        this.state = 'idle';
        this.facingRight = true;
        this.autoQuest = false;
        this.autoAttack = false;
        this.forceAttackTriggered = false;
        this.respawnTimer = 0;

        this.skills = [
            {
                id: 'spirit_spear', name: 'Spirit Spear', type: 'projectile',
                rarity: 'uncommon', category: 'Active',
                damageMult: 2.8, mpCost: 22, cooldown: 11, timer: 0,
                level: 2, active: true,
                desc: "Summons a Spear of Souls and throws it at the target, dealing 280% damage and converts part of the damage dealt to heal you.",
                icon: '🏹'
            },
            {
                id: 'liston_cutoff', name: 'Liston: Cut Off', type: 'aoe',
                rarity: 'uncommon', category: 'Active', // FIX: Change to Active so it shows on HUD
                damageMult: 2.3, mpCost: 15, cooldown: 12, timer: 0,
                level: 2, active: true,
                desc: "Summons a fragment of Specter Liston to perform a spinning attack that deals 230% damage to nearby enemies.",
                icon: '⚔️'
            },
            {
                id: 'cannibal_devour', name: 'Cannibal: Devour', type: 'buff',
                rarity: 'rare', category: 'Active',
                damageMult: 1.5, mpCost: 45, cooldown: 15, timer: 0,
                level: 2, active: true,
                desc: "Consumes a portion of the enemy's essence, instantly healing you and increasing power.",
                icon: '🦷'
            },
            {
                id: 'soul_walker', name: 'Soul Walker', type: 'passive',
                rarity: 'uncommon', category: 'Passive',
                damageMult: 0, mpCost: 0, cooldown: 0, timer: 0,
                level: 2, active: true,
                desc: "The longer the battle continues, the more you resonate with the Specter, increasing Movement Speed by 7%.",
                icon: '👻',
                stats: { moveSpeed: 7 }
            },
            {
                id: 'phantom_rage', name: 'Phantom Rage', type: 'buff',
                rarity: 'rare', category: 'Passive',
                damageMult: 0, mpCost: 0, cooldown: 0, timer: 0,
                level: 2, active: true,
                desc: "Increases Attack Speed and Critical Rate as your HP decreases.",
                icon: '💢'
            },
            {
                id: 'lightning_bullet', name: 'Lightning Bullet', type: 'projectile',
                rarity: 'epic', category: 'Active',
                damageMult: 3.5, mpCost: 60, cooldown: 8, timer: 0,
                level: 1, active: true,
                desc: "Fires a concentrated bolt of lightning that chains to nearby enemies.",
                icon: '⚡'
            }
        ];

        this.recalculateStats();

        // Animation Engine
        this.spriteScale = 0.25;
        this.currentFrame = 0;
        this.animTimer = 0;
        this.animations = {
            idle: { frames: this.loadFrames('assets/idle', 'idle', 10), speed: 0.12 },
            run: { frames: this.loadFrames('assets/run', 'run', 8), speed: 0.08 },
            attack: { frames: this.loadFrames('assets/attack', 'atk', 9), speed: 0.03 }
        };
    }

    loadFrames(folder, prefix, count) {
        return Array.from({ length: count }, (_, i) => {
            const img = new Image();
            const num = i.toString().padStart(2, '0');
            img.src = `${folder}/${prefix}${num}.png`;
            return img;
        });
    }

    recalculateStats() {
        this.stats = { ...this.baseStats };
        this.stats.attack = this.level * 10;
        this.stats.maxHp = 1000 + ((this.level - 1) * 150);
        this.maxMp = 200 + ((this.level - 1) * 20);

        const lvlMult = Math.pow(1.015, this.level - 1);
        for (const key in this.stats) {
            if (key !== 'attack' && key !== 'maxHp' && key !== 'moveSpeed' && key !== 'maxQuests' && key !== 'maxDailyCorps') {
                if (typeof this.stats[key] === 'number') {
                    if (this.stats[key] === 0) {
                        this.stats[key] = Math.floor((this.level - 1) * 0.5); // Provide a tiny flat boost for zero-base stats
                    } else {
                        this.stats[key] = Math.floor(this.stats[key] * lvlMult);
                    }
                }
            }
        }

        Object.values(this.equipment).forEach(item => {
            if (item && item.stats) {
                for (const key in item.stats) {
                    if (this.stats[key] !== undefined) {
                        this.stats[key] += item.stats[key];
                    }
                }
            }
        });

        // Apply Skill Passives
        if (this.skills) {
            this.skills.forEach(skill => {
                if (skill.active && skill.category === 'Passive' && skill.stats) {
                    for (const key in skill.stats) {
                        if (this.stats[key] !== undefined) {
                            this.stats[key] += skill.stats[key];
                        }
                    }
                }
            });
        }

        // --- ANTI-BREAKING STAT CAPS ---
        // Max Movement Speed: 400 (Base 100)
        this.stats.moveSpeed = Math.min(this.stats.moveSpeed, 400);
        // Max CDR: 60%
        this.stats.cdReduction = Math.min(this.stats.cdReduction, 60);
        // Max Attack Speed: 0.1s cooldown (Lower is faster)
        this.attackCooldown = Math.max(0.1, 0.4 - (this.stats.cdReduction / 200));
        // Max Critical Rate: 80%
        this.stats.critRate = Math.min(this.stats.critRate, 80); // critRate is guaranteed to be a number due to baseStats and recalculation logic

        this.hp = Math.min(this.hp, this.stats.maxHp);
        this.maxHp = this.stats.maxHp;
    }

    gainXp(amount) {
        if (typeof Game !== 'undefined' && Game.isNight) amount *= 2;
        if (typeof Game !== 'undefined' && Game.inChallengeMode) Game.challengeRewards.xp += amount;
        this.xp += amount;
        if (this.xp >= this.maxXp) {
            this.level++;
            this.xp -= this.maxXp;
            this.maxXp = Math.floor(this.maxXp * 1.6);
            this.recalculateStats();
            this.hp = this.maxHp;
            this.mp = this.maxMp;
            Game.spawnDamageText(this.x, this.y - 60, "LEVEL UP!", "#f1c40f");
        }
        if (typeof UI !== 'undefined') UI.updateXpBar(this);
    }

    pickUpItem(item) {
        if (item.type === 'gold') {
            let goldVal = item.value;
            if (typeof Game !== 'undefined' && Game.isNight) goldVal *= 2;
            this.gold += goldVal;
            if (typeof Game !== 'undefined' && Game.inChallengeMode) Game.challengeRewards.gold += goldVal;
            if (typeof UI !== 'undefined') UI.showLootNotification(`+${goldVal} Gold`, 'rarity-legendary');
        } else {
            if (typeof Game !== 'undefined' && Game.inChallengeMode) {
                if (item.type === 'rune') Game.challengeRewards.runes += (item.count || 1);
                else if (item.type === 'equipment') Game.challengeRewards.equipment.push(item);
            }
            if (item.stackable) {
                let existing = this.inventory.find(i => i.name === item.name);
                if (existing) existing.count += (item.count || 1);
                else this.inventory.push(item);
            } else {
                this.inventory.push(item);
            }
            UI.showLootNotification(`Picked up: ${item.name}`, `rarity-${item.rarity}`);
        }
        UI.updateInventory(this);
    }

    update(dt, enemies) {
        if (this.isDead) {
            this.respawnTimer += dt;
            if (this.respawnTimer >= 10) this.respawn();
            return;
        }

        // Regen & Timers
        this.mp = Math.min(this.maxMp, this.mp + (this.stats.mpRecovery || 10) * dt);
        if (this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + (this.stats.hpRecovery || 0) * dt);
        }
        if (this.attackTimer > 0) this.attackTimer -= dt;
        this.skills.forEach(s => { if (s.timer > 0) s.timer -= dt; });

        this.handleMovement(dt, enemies);

        // Ensure dead targets are dropped before combat logic
        if (this.target && this.target.isDead) this.target = null;

        this.handleCombat(enemies);
        this.handleAnimation(dt);
    }

    handleMovement(dt, enemies) {
        if (this.state === 'attack') return;

        let moving = false;
        let vx = 0, vy = 0;

        // Joystick Logic (Highest priority)
        if (typeof UI !== 'undefined' && UI.joystick && UI.joystick.active) {
            this.autoQuest = false;
            vx = UI.joystick.vector.x;
            vy = UI.joystick.vector.y;
            moving = true;
        }
        // Auto-Quest or Auto-Attack Logic
        else if (this.autoQuest || this.autoAttack) {
            if (!this.target || this.target.isDead) {
                this.target = this.findClosestEnemy(enemies, 2000);
            }
            if (this.target) {
                const dist = this.distanceTo(this.target);
                if (dist > this.attackRange - 20) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    vx = Math.cos(angle);
                    vy = Math.sin(angle);
                    moving = true;
                }
            }
        }

        if (moving) {
            this.state = 'run';
            const currentSpeed = this.speed * ((this.stats.moveSpeed || 100) / 100);
            this.x += vx * currentSpeed * dt;
            this.y += vy * currentSpeed * dt;
            this.facingRight = vx >= 0;
            // Boundary Clamping
            this.x = Math.max(this.radius, Math.min(this.x, Game.WORLD_SIZE - this.radius));
            this.y = Math.max(this.radius, Math.min(this.y, Game.WORLD_SIZE - this.radius));
        } else {
            this.state = 'idle';
        }
    }

    handleCombat(enemies) {
        if (this.state === 'attack') {
            this.forceAttackTriggered = false;
            return;
        }

        // Auto-Targeting
        if (!this.target || this.target.isDead) {
            this.target = this.findClosestEnemy(enemies, 800);
        }

        // Auto-Cast Skills (Sequential Turn-Taking Logic)
        if ((this.autoAttack || this.autoQuest) && typeof Game !== 'undefined') {
            // Find ALL available skills first
            const availableSkills = this.skills.filter(skill =>
                skill.active &&
                skill.category === 'Active' &&
                skill.timer <= 0 &&
                this.mp >= skill.mpCost
            );

            // Cast the first one that meets range requirements
            for (const skill of availableSkills) {
                if (this.target) {
                    const dist = this.distanceTo(this.target);
                    let canCast = false;

                    if (skill.id === 'spirit_spear' || skill.id === 'lightning_bullet') {
                        if (dist <= 800) canCast = true;
                    } else if (skill.id === 'liston_cutoff' && dist <= 180) {
                        canCast = true;
                    } else if (skill.id === 'cannibal_devour' && this.hp < this.maxHp * 0.9) {
                        canCast = true;
                    }

                    if (canCast) {
                        Game.castSkill(skill.id);
                        break; // Cast only one skill per turn to ensure they "take turns"
                    }
                }
            }
        }

        let attacked = false;
        if (this.target && this.distanceTo(this.target) <= this.attackRange) {
            // Only perform basic attack if within range and auto-attack is on or forced
            if (this.autoAttack || this.autoQuest || this.forceAttackTriggered) {
                this.performAttack(enemies);
                attacked = true;
            }
        }

        // Force manual attack logic (if player clicks button)
        if (!attacked && this.forceAttackTriggered) {
            // Check if ANY enemy is in range for manual click
            const closest = this.findClosestEnemy(enemies, this.attackRange);
            if (closest) {
                this.performAttack(enemies);
            }
        }

        this.forceAttackTriggered = false;
    }

    performAttack(enemies) {
        if (this.attackTimer > 0) return;

        this.state = 'attack';
        this.currentFrame = 0;
        this.attackTimer = this.attackCooldown;
        if (this.target) this.facingRight = this.target.x > this.x;

        // Damage resolution (Triggered at middle of animation)
        setTimeout(() => {
            const rangeSq = (this.attackRange + 20) ** 2;
            enemies.forEach(e => {
                if (!e.isDead && this.distSq(e) <= rangeSq) {
                    const isFacing = this.facingRight ? (e.x > this.x - 10) : (e.x < this.x + 10);
                    if (isFacing) {
                        let isCrit = Math.random() * 100 < (this.stats.critRate || 0);
                        let finalDmg = this.stats.attack;
                        if (isCrit) {
                            finalDmg *= 1.5; // Base 150% crit damage
                            finalDmg *= (1 + (this.stats.fatalityRate || 0) / 100);
                        }
                        
                        e.takeDamage(finalDmg, this, isCrit);
                        // Small knockback
                        e.x += this.facingRight ? 15 : -15;
                    }
                }
            });
        }, (this.animations.attack.speed * this.animations.attack.frames.length) * 500);
    }

    handleAnimation(dt) {
        const anim = this.animations[this.state];
        this.animTimer += dt;

        if (this.animTimer >= anim.speed) {
            this.animTimer = 0;
            this.currentFrame++;

            if (this.currentFrame >= anim.frames.length) {
                if (this.state === 'attack') this.state = 'idle';
                this.currentFrame = 0;
            }
        }
    }

    findClosestEnemy(enemies, maxRange) {
        let closest = null;
        let minDistSq = maxRange * maxRange;
        enemies.forEach(e => {
            const dSq = this.distSq(e);
            if (dSq < minDistSq && !e.isDead) {
                minDistSq = dSq;
                closest = e;
            }
        });
        return closest;
    }

    respawn() {
        this.isDead = false;
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.x = Game.WORLD_SIZE / 2;
        this.y = Game.WORLD_SIZE / 2;
        this.state = 'idle';
        this.respawnTimer = 0;
    }

    getDrawInfo() {
        const anim = this.animations[this.state];
        const img = anim.frames[this.currentFrame];
        if (!img || !img.complete || img.naturalWidth === 0) return null;

        const w = img.width * this.spriteScale;
        const h = img.height * this.spriteScale;
        return {
            image: img,
            drawWidth: w,
            drawHeight: h,
            drawX: this.x - w / 2,
            drawY: this.y - h
        };
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 20, 110);
        this.hp = 300;
        this.maxHp = 300;
        this.aggroRangeSq = 250 * 250;
        this.attackRange = 45;
        this.attackPower = 25;
        this.isBoss = false;
        this.name = "Sleepless Ghost";
        this.origin = { x, y };
        this.attackTimer = 0;
        this.attackCooldown = 1.5;
    }

    getDrawInfo() {
        return {
            image: Game.images.ghost,
            drawWidth: this.isBoss ? 200 : 50,
            drawHeight: this.isBoss ? 200 : 50
        };
    }

    update(dt, player) {
        if (this.isDead || player.isDead) return;

        if (this.attackTimer > 0) this.attackTimer -= dt;

        const dSq = this.distSq(player);
        if (dSq <= this.aggroRangeSq || (typeof Game !== 'undefined' && Game.inChallengeMode)) {
            this.target = player;
            if (dSq > this.attackRange ** 2) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
            } else if (this.attackTimer <= 0) {
                this.attackPlayer(player);
            }
        } else {
            // Idle Wander (Time-based movement for stability)
            if (Math.random() < 0.01) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 50;
                this.x = Math.max(0, Math.min(Game.WORLD_SIZE, this.x + Math.cos(angle) * dist));
                this.y = Math.max(0, Math.min(Game.WORLD_SIZE, this.y + Math.sin(angle) * dist));
            }
        }
    }

    attackPlayer(player) {
        // Evade check
        if (Math.random() * 100 < (player.stats.evade || 0)) {
            Game.spawnDamageText(player.x, player.y - 30, "Evade!", "#a8e6cf");
            this.attackTimer = this.attackCooldown;
            return;
        }

        let dmg = this.attackPower || 25;
        
        // Block check (50% damage reduction)
        let isBlocked = false;
        if (Math.random() * 100 < (player.stats.block || 0)) {
            dmg *= 0.5;
            isBlocked = true;
        }

        // Flat Defense reduction
        if (player.stats.defense) {
            dmg -= player.stats.defense;
        }
        
        // Percentage Damage reduction
        if (player.stats.dmgReduction) {
            dmg = dmg * (1 - (player.stats.dmgReduction / 100));
        }

        dmg = Math.max(1, Math.floor(dmg));

        player.hp = Math.max(0, player.hp - dmg);
        if (isBlocked) {
            Game.spawnDamageText(player.x, player.y - 45, "Block!", "#f1c40f");
        }
        Game.spawnDamageText(player.x, player.y - 30, dmg.toString(), "#ff4444");
        
        if (player.hp <= 0) player.isDead = true;
        this.attackTimer = this.attackCooldown;
    }

    takeDamage(amount, source, isCrit = false) {
        this.hp -= amount;
        const color = isCrit ? "#ffaa00" : "#ffffff";
        const text = isCrit ? `CRIT ${Math.floor(amount)}!` : Math.floor(amount).toString();
        Game.spawnDamageText(this.x, this.y - 30, text, color);
        this.target = source;

        // Track boss damage
        if (this.isBoss && source) {
            source.currentBossDmg = (source.currentBossDmg || 0) + amount;
            if (source.currentBossDmg > (source.maxBossDmg || 0)) {
                source.maxBossDmg = source.currentBossDmg;
            }
        }

        if (this.hp <= 0 && !this.isDead) {
            this.isDead = true;
            if (typeof Game !== 'undefined') Game.kills++;
            let xpReward = this.isBoss ? 5000 * (1 + (source.bossRank || 0) * 0.5) : 120;
            source.gainXp(xpReward);
            this.dropLoot(source);
        }
    }

    dropLoot(source) {
        const roll = Math.random();
        
        if (this.isBoss) {
            // Boss scaling gold
            let rank = (source && source.bossRank) || 0;
            let goldAmount = Math.floor(5000 * (1 + rank * 0.5));
            let goldItem = new LootItem(this.x, this.y, 'gold');
            goldItem.value = goldAmount; // override rng value
            if (typeof Game !== 'undefined') Game.lootItems.push(goldItem);
            
            // 0.001% chance for Legendary equipment drop
            if (Math.random() < 0.00001) {
                let legItem = new LootItem(this.x, this.y, 'equipment');
                legItem.rarity = 'legendary';
                legItem.generateProperties(); // re-roll with guaranteed legendary rarity
                if (typeof Game !== 'undefined') Game.lootItems.push(legItem);
                if (typeof UI !== 'undefined') UI.showLootNotification("LEGENDARY BOSS DROP!", "rarity-legendary");
            }
            
            // Standard boss drops
            if (typeof Game !== 'undefined') {
                Game.spawnLoot(this.x, this.y, 'equipment');
                Game.spawnLoot(this.x, this.y, 'rune');
            }
        } else {
            if (roll < 0.70) Game.spawnLoot(this.x, this.y, 'gold');
            if (roll < 0.05) Game.spawnLoot(this.x, this.y, 'equipment'); // Reduced from 0.15
            if (roll < 0.10) Game.spawnLoot(this.x, this.y, 'potion');
            if (roll < 0.05) Game.spawnLoot(this.x, this.y, 'rune');
        }
    }
}

class LootItem {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 60;
        this.isPickedUp = false;

        // Rarity Logic
        const r = Math.random();
        this.rarity = r > 0.98 ? 'legendary' : r > 0.88 ? 'epic' : r > 0.7 ? 'rare' : 'common';
        this.stackable = (type !== 'equipment');

        this.generateProperties();
    }

    generateProperties() {
        switch (this.type) {
            case 'gold':
                this.name = "Gold";
                this.icon = '💰';
                this.value = Math.floor(Math.random() * 50) + 20;
                break;
            case 'potion':
                this.name = Math.random() > 0.5 ? "Health Potion" : "Mana Potion";
                this.icon = this.name === "Health Potion" ? '❤️' : '💧';
                this.count = 1;
                break;
            case 'equipment':
                const slots = ["head", "armor", "hands", "legs", "cape", "amulet", "ring1", "ring2"];
                const icons = { head: '🪖', armor: '🛡️', hands: '🧤', legs: '👖', cape: '🦹', amulet: '📿', ring1: '💍', ring2: '💍' };
                this.slot = slots[Math.floor(Math.random() * slots.length)];
                this.icon = icons[this.slot];
                this.name = `${this.rarity.toUpperCase()} ${this.slot.toUpperCase()}`;
                const mult = this.rarity === 'legendary' ? 5 : this.rarity === 'epic' ? 3 : 1;
                this.stats = {
                    attack: (Math.floor(Math.random() * 10) + 5) * mult,
                    defense: Math.floor(Math.random() * 5) * mult
                };

                // Add random sub-stats
                const possibleSubStats = [
                    'atkSpeed', 'skillSpeed', 'magicAtk', 'weaponAtk', 'critRate', 'magicCritRate', 'bashRate', 'accuracy',
                    'maxHp', 'evade', 'block', 'dmgReduction', 'moveSpeed', 'cdReduction', 'hpRecovery', 'mpRecovery',
                    'statusRes', 'weakRes', 'immobileRes'
                ];
                const numSubStats = this.rarity === 'legendary' ? 4 : this.rarity === 'epic' ? 3 : this.rarity === 'rare' ? 2 : 1;

                const shuffled = possibleSubStats.sort(() => 0.5 - Math.random());
                for (let i = 0; i < numSubStats; i++) {
                    const stat = shuffled[i];
                    // Most stats are small values or percentages (1-15), maxHp should be higher
                    if (stat === 'maxHp') {
                        this.stats[stat] = (Math.floor(Math.random() * 50) + 20) * mult;
                    } else {
                        this.stats[stat] = Math.floor(Math.random() * 10 * mult) + mult;
                    }
                }
                break;
            case 'rune':
                this.name = "Ancient Rune";
                this.icon = '💠';
                this.count = 1;
                break;
        }
    }
}

class NPC extends Entity {
    constructor(x, y, name) {
        super(x, y, 30, 0);
        this.name = name;
    }
}

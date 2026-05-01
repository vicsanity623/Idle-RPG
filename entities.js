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
        this.mpRegen = 2; // Per second
        
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
        this.stats = { attack: 10, defense: 0 };
        
        this.state = 'idle'; 
        this.facingRight = true;
        this.autoQuest = false;
        this.respawnTimer = 0;

        // Animation Engine
        this.spriteScale = 0.25;
        this.currentFrame = 0;
        this.animTimer = 0;
        this.animations = {
            idle: { frames: this.loadFrames('assets/idle', 'idle', 10), speed: 0.12 },
            run:  { frames: this.loadFrames('assets/run', 'run', 8), speed: 0.08 },
            attack: { frames: this.loadFrames('assets/attack', 'atk', 9), speed: 0.06 }
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
        let gearAtk = 0;
        let gearDef = 0;
        Object.values(this.equipment).forEach(item => {
            if (item && item.stats) {
                gearAtk += (item.stats.attack || 0);
                gearDef += (item.stats.defense || 0);
            }
        });
        this.stats.attack = (this.level * 10) + gearAtk;
        this.stats.defense = gearDef;
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.maxXp) {
            this.level++;
            this.xp -= this.maxXp;
            this.maxXp = Math.floor(this.maxXp * 1.6);
            this.maxHp += 150;
            this.hp = this.maxHp;
            this.recalculateStats();
            Game.spawnDamageText(this.x, this.y - 60, "LEVEL UP!", "#f1c40f");
        }
        if (typeof UI !== 'undefined') UI.updateXpBar(this);
    }

    pickUpItem(item) {
        if (item.type === 'gold') {
            this.gold += item.value;
            UI.showLootNotification(`+${item.value} Gold`, 'rarity-legendary');
        } else {
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
        this.mp = Math.min(this.maxMp, this.mp + this.mpRegen * dt);
        if (this.attackTimer > 0) this.attackTimer -= dt;

        this.handleMovement(dt, enemies);
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
        // Auto-Quest Logic
        else if (this.autoQuest) {
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
            this.x += vx * this.speed * dt;
            this.y += vy * this.speed * dt;
            this.facingRight = vx >= 0;
            // Boundary Clamping
            this.x = Math.max(this.radius, Math.min(this.x, Game.WORLD_SIZE - this.radius));
            this.y = Math.max(this.radius, Math.min(this.y, Game.WORLD_SIZE - this.radius));
        } else {
            this.state = 'idle';
        }
    }

    handleCombat(enemies) {
        if (this.state === 'attack') return;

        // Auto-Targeting
        if (!this.target || this.target.isDead) {
            this.target = this.findClosestEnemy(enemies, 400);
        }

        if (this.target && this.distanceTo(this.target) <= this.attackRange) {
            this.performAttack(enemies);
        }
    }

    performAttack(enemies) {
        if (this.mp < 5 || this.attackTimer > 0) return;

        this.mp -= 5;
        this.state = 'attack';
        this.currentFrame = 0;
        this.attackTimer = this.attackCooldown;
        if (this.target) this.facingRight = this.target.x > this.x;

        // Damage resolution (Triggered at middle of animation)
        setTimeout(() => {
            const rangeSq = (this.attackRange + 20) ** 2;
            enemies.forEach(e => {
                if (this.distSq(e) <= rangeSq) {
                    const isFacing = this.facingRight ? (e.x > this.x - 10) : (e.x < this.x + 10);
                    if (isFacing) {
                        e.takeDamage(this.stats.attack, this);
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
        if (!img || !img.complete) return null;

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
        this.attackCooldown = 1.5;
        this.attackTimer = 0;
        this.origin = { x, y };
    }

    update(dt, player) {
        if (this.isDead || player.isDead) return;

        if (this.attackTimer > 0) this.attackTimer -= dt;

        const dSq = this.distSq(player);
        if (dSq <= this.aggroRangeSq) {
            this.target = player;
            if (dSq > this.attackRange ** 2) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
            } else if (this.attackTimer <= 0) {
                this.attackPlayer(player);
            }
        } else {
            // Idle Wander
            if (Math.random() < 0.005) {
                this.x = this.origin.x + (Math.random() - 0.5) * 100;
                this.y = this.origin.y + (Math.random() - 0.5) * 100;
            }
        }
    }

    attackPlayer(player) {
        player.hp = Math.max(0, player.hp - 25);
        Game.spawnDamageText(player.x, player.y - 30, "25", "#ff4444");
        if (player.hp <= 0) player.isDead = true;
        this.attackTimer = this.attackCooldown;
    }

    takeDamage(amount, source) {
        this.hp -= amount;
        Game.spawnDamageText(this.x, this.y - 30, Math.floor(amount).toString(), "#ffffff");
        this.target = source;
        if (this.hp <= 0 && !this.isDead) {
            this.isDead = true;
            Game.kills++;
            source.gainXp(120);
            this.dropLoot();
        }
    }

    dropLoot() {
        const roll = Math.random();
        if (roll < 0.70) Game.spawnLoot(this.x, this.y, 'gold');
        if (roll < 0.15) Game.spawnLoot(this.x, this.y, 'equipment');
        if (roll < 0.10) Game.spawnLoot(this.x, this.y, 'potion');
        if (roll < 0.05) Game.spawnLoot(this.x, this.y, 'rune');
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
        switch(this.type) {
            case 'gold':
                this.name = "Gold";
                this.value = Math.floor(Math.random() * 50) + 20;
                break;
            case 'potion':
                this.name = Math.random() > 0.5 ? "Health Potion" : "Mana Potion";
                this.count = 1;
                break;
            case 'equipment':
                const slots = ["head", "armor", "hands", "legs", "cape", "amulet", "ring1", "ring2"];
                this.slot = slots[Math.floor(Math.random() * slots.length)];
                this.name = `${this.rarity.toUpperCase()} ${this.slot.toUpperCase()}`;
                const mult = this.rarity === 'legendary' ? 5 : this.rarity === 'epic' ? 3 : 1;
                this.stats = { 
                    attack: (Math.floor(Math.random() * 10) + 5) * mult,
                    defense: Math.floor(Math.random() * 5) * mult 
                };
                break;
            case 'rune':
                this.name = "Ancient Rune";
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

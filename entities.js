class Entity {
    constructor(x, y, radius, speed) {
        this.x = x; this.y = y; this.radius = radius; this.speed = speed;
        this.hp = 100; this.maxHp = 100; this.target = null; this.isDead = false;
    }
    distanceTo(other) { return Math.sqrt((this.x - other.x)**2 + (this.y - other.y)**2); }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 20, 300);
        this.hp = 1000; this.maxHp = 1000;
        this.attackRange = 120; 
        this.autoAttack = false;
        this.autoQuest = false; // --- NEW: Auto-Pathing Toggle ---

        // --- NEW: LEVELING, GOLD & INVENTORY ---
        this.level = 1;
        this.xp = 0;
        this.maxXp = 500;
        this.gold = 0;
        this.inventory = []; // Stores stackable items and unequipped gear
        
        // --- NEW: EQUIPMENT SLOTS ---
        this.equipment = {
            head: null, cape: null, amulet: null,
            armor: null, hands: null, legs: null,
            ring1: null, ring2: null
        };

        // --- ANIMATION STATE ---
        this.state = 'idle'; 
        this.facingRight = true; 
        this.spriteScale = 0.25; 
        
        this.animations = {
            idle: this.loadFrames('assets/idle', 'idle', 10), 
            run: this.loadFrames('assets/run', 'run', 8),     
            attack: this.loadFrames('assets/attack', 'atk', 9) 
        };

        this.animTimings = {
            idle: { speed: 0.12 },
            run:  { speed: 0.08 },
            attack: { speed: 0.06 } 
        };

        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false;
    }

    // --- NEW: ITEM PICKUP WITH STACKING ---
    pickUpItem(item) {
        if (item.type === 'gold') {
            this.gold += item.value;
            UI.showLootNotification(`+${item.value} Gold`, 'rarity-legendary');
        } else if (item.stackable) {
            // Check if we already have this consumable
            let existing = this.inventory.find(i => i.name === item.name);
            if (existing) {
                existing.count += (item.count || 1);
            } else {
                item.count = (item.count || 1);
                this.inventory.push(item);
            }
            UI.showLootNotification(`Picked up ${item.name}`, `rarity-${item.rarity}`);
        } else {
            // Equipment or Unique items
            this.inventory.push(item);
            UI.showLootNotification(`Found ${item.name}`, `rarity-${item.rarity}`);
        }
        
        // Trigger UI Refresh
        UI.updateInventory(this);
    }

    // --- PROGRESSION ---
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.maxXp) this.levelUp();
        UI.updateXpBar(this);
    }

    levelUp() {
        this.level++;
        this.xp -= this.maxXp;
        this.maxXp = Math.floor(this.maxXp * 1.5);
        this.maxHp += 100;
        this.hp = this.maxHp;
        Game.spawnDamageText(this.x, this.y - 50, "LEVEL UP!", "#f1c40f");
        UI.updatePlayerStats(this);
    }

    loadFrames(folder, prefix, frameCount) {
        let frames = [];
        for (let i = 0; i < frameCount; i++) {
            let img = new Image();
            let num = i < 10 ? '0' + i : i;
            img.src = `${folder}/${prefix}${num}.png`;
            frames.push(img);
        }
        return frames;
    }

    getDrawInfo() {
        let animArray = this.animations[this.state];
        if (!animArray || animArray.length === 0) return null; 
        let img = animArray[this.currentFrame];
        if (!img || !img.complete || img.width === 0) return null;

        return {
            image: img,
            drawWidth: img.width * this.spriteScale,
            drawHeight: img.height * this.spriteScale,
            drawX: this.x - ((img.width * this.spriteScale) / 2),
            drawY: this.y - (img.height * this.spriteScale)
        };
    }

    update(dt, enemies) {
        if (this.isDead) return;

        let currentAnimArray = this.animations[this.state];
        let currentTiming = this.animTimings[this.state];
        if (!currentAnimArray) return;

        // 1. Animation Logic
        this.animTimer += dt;
        if (this.animTimer >= currentTiming.speed) {
            this.currentFrame++;
            this.animTimer = 0;
            if (this.currentFrame >= currentAnimArray.length) {
                if (this.state === 'attack') {
                    this.state = (UI.joystick.active || this.autoQuest) ? 'run' : 'idle';
                    this.attackFired = false; 
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = 0; 
                }
            }
        }

        // 2. Movement Logic (Manual or Auto-Quest)
        if (this.state !== 'attack') {
            if (UI.joystick.active) {
                this.autoQuest = false; 
                this.state = 'run';
                this.x += UI.joystick.vector.x * this.speed * dt;
                this.y += UI.joystick.vector.y * this.speed * dt;
                this.facingRight = UI.joystick.vector.x >= 0;
            } else if (this.autoQuest) {
                // Persistent targeting: If no target, find the next one automatically
                if (!this.target || this.target.isDead) {
                    let closest = null; let minDist = Infinity;
                    enemies.forEach(e => { let d = this.distanceTo(e); if (d < minDist) { minDist = d; closest = e; } });
                    this.target = closest;
                }
                this.handleAutoQuestLogic(dt, enemies);
            } else {
                this.state = 'idle';
            }
            // World Boundary Lock
            this.x = Math.max(this.radius, Math.min(this.x, Game.WORLD_SIZE - this.radius));
            this.y = Math.max(this.radius, Math.min(this.y, Game.WORLD_SIZE - this.radius));
        }

        // 3. Combat logic
        if ((this.autoAttack || this.autoQuest) && !this.target && this.state !== 'attack') {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => { let d = this.distanceTo(e); if (d < 400 && d < minDist) { minDist = d; closest = e; } });
            if (closest) this.target = closest;
        }

        if (this.target && this.state !== 'attack') {
            if (this.target.isDead) {
                this.target = null;
            } else if (this.distanceTo(this.target) <= this.attackRange) {
                this.forceAttack();
            }
        }

        // 4. Damage Frame
        if (this.state === 'attack' && this.currentFrame === Math.floor(currentAnimArray.length / 2) && !this.attackFired) {
            this.attackFired = true; 
            enemies.forEach(e => {
                if (this.distanceTo(e) <= this.attackRange + 20) {
                    let dx = e.x - this.x;
                    if ((this.facingRight && dx > -20) || (!this.facingRight && dx < 20)) {
                        e.takeDamage(150, this);
                        e.x += this.facingRight ? 30 : -30;
                    }
                }
            });
        }
    }

    // --- NEW: AUTO QUEST PATHING ---
    handleAutoQuestLogic(dt, enemies) {
        if (!this.target) {
            // If no target, move toward a random spot in the world or stay idle
            this.state = 'idle';
            return;
        }

        this.state = 'run';
        const dist = this.distanceTo(this.target);
        if (dist > this.attackRange - 20) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this.facingRight = Math.cos(angle) >= 0;
        }
    }

    forceAttack() {
        if (this.state === 'attack') return; 
        this.state = 'attack';
        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false;
        if (this.target) this.facingRight = this.target.x > this.x;
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 20, 100);
        this.hp = 300; this.maxHp = 300;
        this.aggroRange = 150; this.attackRange = 40; this.lastAttack = 0;
        this.originX = x; this.originY = y;
    }

    update(dt, player) {
        if (this.isDead) return;
        let dist = this.distanceTo(player);
        if (dist <= this.aggroRange) this.target = player;
        if (this.target) {
            if (dist > this.attackRange) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
            } else {
                const now = performance.now() / 1000;
                if (now - this.lastAttack > 1.5) {
                    player.hp -= 25; 
                    Game.spawnDamageText(player.x, player.y - 30, "25", "#ff0000");
                    this.lastAttack = now;
                }
            }
        } else if (Math.random() < 0.01) {
            this.x = this.originX + (Math.random() - 0.5) * 100;
            this.y = this.originY + (Math.random() - 0.5) * 100;
        }
    }

    takeDamage(amount, source) {
        this.hp -= amount;
        Game.spawnDamageText(this.x, this.y - 30, amount.toString(), "#fff");
        this.target = source;
        if (this.hp <= 0 && !this.isDead) { 
            this.isDead = true; 
            Game.kills++; 
            source.gainXp(100); 
            this.dropLoot();
        }
    }

    dropLoot() {
        const roll = Math.random();
        if (roll < 0.8) Game.spawnLoot(this.x, this.y, 'gold');
        if (roll < 0.15) Game.spawnLoot(this.x, this.y, 'equipment');
        if (roll < 0.08) Game.spawnLoot(this.x, this.y, 'rune');
        if (roll < 0.2) Game.spawnLoot(this.x, this.y, 'potion');
    }
}

// --- NEW LOOT ITEM CONFIGURATION ---
class LootItem {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.radius = 15;
        this.isPickedUp = false;
        this.life = 60;
        this.stackable = (type === 'gold' || type === 'potion' || type === 'rune');
        
        const rarityRoll = Math.random();
        if (rarityRoll > 0.98) this.rarity = 'legendary';
        else if (rarityRoll > 0.85) this.rarity = 'epic';
        else if (rarityRoll > 0.6) this.rarity = 'rare';
        else this.rarity = 'common';

        switch(type) {
            case 'gold': 
                this.name = "Gold"; this.value = Math.floor(Math.random() * 50) + 10;
                break;
            case 'equipment':
                const slots = ["head", "armor", "hands", "legs", "cape", "amulet", "ring1", "ring2"];
                this.slot = slots[Math.floor(Math.random() * slots.length)];
                this.name = this.rarity.charAt(0).toUpperCase() + this.rarity.slice(1) + " " + this.slot.toUpperCase();
                this.stats = { attack: Math.floor(Math.random() * 20), defense: Math.floor(Math.random() * 10) };
                this.stackable = false;
                break;
            case 'rune':
                this.name = "Ancient Rune"; this.count = 1;
                break;
            case 'potion':
                this.name = Math.random() > 0.5 ? "Health Potion" : "Mana Potion";
                this.count = 1;
                break;
        }
    }
}

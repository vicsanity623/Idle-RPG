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

        // --- NEW: LEVELING & LOOT STATS ---
        this.level = 1;
        this.xp = 0;
        this.maxXp = 500; // XP needed for Level 2
        this.gold = 0;
        this.inventory = [];

        // --- ANIMATION STATE MACHINE ---
        this.state = 'idle'; // 'idle', 'run', 'attack'
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

    // --- NEW: PROGRESSION METHODS ---
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.maxXp) {
            this.levelUp();
        }
        UI.updateXpBar(this); // We will define this in engine/ui
    }

    levelUp() {
        this.level++;
        this.xp -= this.maxXp;
        this.maxXp = Math.floor(this.maxXp * 1.5); // Increase curve
        this.maxHp += 100;
        this.hp = this.maxHp; // Heal on level up
        Game.spawnDamageText(this.x, this.y - 50, "LEVEL UP!", "#f1c40f");
        UI.updatePlayerStats(this);
    }

    pickUpItem(item) {
        if (item.type === 'gold') {
            this.gold += item.value;
            UI.showLootNotification(`Gained ${item.value} Gold`, 'rarity-legendary');
        } else {
            this.inventory.push(item);
            UI.showLootNotification(`Found ${item.name}`, `rarity-${item.rarity}`);
        }
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

        this.animTimer += dt;
        if (this.animTimer >= currentTiming.speed) {
            this.currentFrame++;
            this.animTimer = 0;
            if (this.currentFrame >= currentAnimArray.length) {
                if (this.state === 'attack') {
                    this.state = UI.joystick.active ? 'run' : 'idle';
                    this.attackFired = false; 
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = 0; 
                }
            }
        }

        if (this.state !== 'attack') {
            if (UI.joystick.active) {
                this.state = 'run';
                this.x += UI.joystick.vector.x * this.speed * dt;
                this.y += UI.joystick.vector.y * this.speed * dt;
                if (UI.joystick.vector.x > 0) this.facingRight = true;
                if (UI.joystick.vector.x < 0) this.facingRight = false;
                if (this.target && this.distanceTo(this.target) > this.attackRange + 50) this.target = null;
            } else {
                this.state = 'idle';
            }
        }

        if (this.autoAttack && !this.target && this.state !== 'attack') {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => { let d = this.distanceTo(e); if (d < 300 && d < minDist) { minDist = d; closest = e; } });
            if (closest) this.target = closest;
        }

        if (this.target && this.state !== 'attack') {
            if (this.target.isDead) {
                this.target = null;
            } else if (this.distanceTo(this.target) <= this.attackRange) {
                this.forceAttack();
            }
        }

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

    forceAttack() {
        if (this.state === 'attack') return; 
        this.state = 'attack';
        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false;
        if (!UI.joystick.active && Game.enemies.length > 0) {
            let closest = Game.enemies.reduce((p, c) => this.distanceTo(c) < this.distanceTo(p) ? c : p);
            if (this.distanceTo(closest) < this.attackRange + 50) {
                this.facingRight = (closest.x > this.x);
            }
        }
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
            source.gainXp(100); // Reward player
            this.dropLoot();
        }
    }

    // --- NEW: LOOT DROP LOGIC ---
    dropLoot() {
        const roll = Math.random();
        if (roll < 0.7) Game.spawnLoot(this.x, this.y, 'gold');
        if (roll < 0.1) Game.spawnLoot(this.x, this.y, 'equipment');
        if (roll < 0.05) Game.spawnLoot(this.x, this.y, 'rune');
        if (roll < 0.15) Game.spawnLoot(this.x, this.y, 'potion');
    }
}

// --- NEW CLASS: LOOT ITEM ---
class LootItem {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.radius = 15;
        this.isPickedUp = false;
        this.life = 60; // Despawn after 60 seconds
        
        // Randomize Rarity & Values
        const rarityRoll = Math.random();
        if (rarityRoll > 0.95) this.rarity = 'legendary';
        else if (rarityRoll > 0.8) this.rarity = 'epic';
        else if (rarityRoll > 0.5) this.rarity = 'rare';
        else this.rarity = 'common';

        switch(type) {
            case 'gold': 
                this.name = "Gold Pieces";
                this.value = Math.floor(Math.random() * 50) + 10;
                break;
            case 'equipment':
                const items = ["Ninja Blade", "Shadow Tunic", "Swift Boots", "Iron Ring"];
                this.name = items[Math.floor(Math.random()*items.length)];
                break;
            case 'rune':
                this.name = "Mystic Rune";
                break;
            case 'potion':
                this.name = "Health Elixir";
                break;
        }
    }
}

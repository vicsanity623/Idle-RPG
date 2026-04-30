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
        this.attackRange = 120; // Shorter range since she is a melee ninja
        this.autoAttack = false;

        // --- ANIMATION STATE MACHINE ---
        this.state = 'idle'; // 'idle', 'run', 'attack'
        this.facingRight = true; 
        
        // --- NEW IMAGE SEQUENCE LOADING ---
        // Scale down the massive images (559x447) to fit the game screen
        this.spriteScale = 0.25; 
        
        this.animations = {
            idle: this.loadFrames('assets/idle', 'idle', 10), // Loads idle00 to idle09
            run: this.loadFrames('assets/run', 'run', 8),     // Loads run00 to run07
            
            // NOTE: Change '8' to however many attack frames you downloaded!
            attack: this.loadFrames('assets/attack', 'atk', 8) 
        };

        // Timing settings for each state
        this.animTimings = {
            idle: { speed: 0.12 },
            run:  { speed: 0.08 },
            attack: { speed: 0.06 } 
        };

        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false;
    }

    // Helper to automatically load image arrays based on your folder structure
    loadFrames(folder, prefix, frameCount) {
        let frames = [];
        for (let i = 0; i < frameCount; i++) {
            let img = new Image();
            // Pad numbers < 10 with a zero (e.g., '00', '01')
            let num = i < 10 ? '0' + i : i;
            img.src = `${folder}/${prefix}${num}.png`;
            frames.push(img);
        }
        return frames;
    }

    // Helper method for engine.js to easily grab and draw the current image
    getDrawInfo() {
        let animArray = this.animations[this.state];
        // Failsafe in case images haven't loaded yet
        if (!animArray || animArray.length === 0) return null; 
        
        let img = animArray[this.currentFrame];
        if (!img || !img.complete || img.width === 0) return null;

        // Anchor math to fix the dimension changes!
        // We anchor the image bottom-center to this.x and this.y
        return {
            image: img,
            drawWidth: img.width * this.spriteScale,
            drawHeight: img.height * this.spriteScale,
            // X center offset 
            drawX: this.x - ((img.width * this.spriteScale) / 2),
            // Y bottom offset (anchors her feet to her collision box location)
            drawY: this.y - (img.height * this.spriteScale)
        };
    }

    update(dt, enemies) {
        if (this.isDead) return;

        let currentAnimArray = this.animations[this.state];
        let currentTiming = this.animTimings[this.state];

        // Failsafe for loading
        if (!currentAnimArray) return;

        // 1. Advance Animation Frames
        this.animTimer += dt;
        if (this.animTimer >= currentTiming.speed) {
            this.currentFrame++;
            this.animTimer = 0;

            // Handle end of animation
            if (this.currentFrame >= currentAnimArray.length) {
                if (this.state === 'attack') {
                    // Attack finished, revert to idle or run
                    this.state = UI.joystick.active ? 'run' : 'idle';
                    this.attackFired = false; 
                    this.currentFrame = 0;
                } else {
                    // Loop idle/run
                    this.currentFrame = 0; 
                }
            }
        }

        // 2. Handle State Logic & Movement
        if (this.state !== 'attack') {
            if (UI.joystick.active) {
                this.state = 'run';
                this.x += UI.joystick.vector.x * this.speed * dt;
                this.y += UI.joystick.vector.y * this.speed * dt;
                
                // Set facing direction based on horizontal joystick movement
                if (UI.joystick.vector.x > 0) this.facingRight = true;
                if (UI.joystick.vector.x < 0) this.facingRight = false;
                
                if (this.target && this.distanceTo(this.target) > this.attackRange + 50) this.target = null;
            } else {
                this.state = 'idle';
            }
        }

        // 3. Auto Attack / Combat Logic
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

        // 4. Deal Damage during a specific frame of the attack animation
        // Triggers halfway through the attack array
        if (this.state === 'attack' && this.currentFrame === Math.floor(currentAnimArray.length / 2) && !this.attackFired) {
            this.attackFired = true; // Ensure damage happens once per swing
            
            // Melee splash damage (hit everything in front)
            enemies.forEach(e => {
                if (this.distanceTo(e) <= this.attackRange + 20) {
                    // Check if enemy is in the direction we are facing
                    let dx = e.x - this.x;
                    if ((this.facingRight && dx > -20) || (!this.facingRight && dx < 20)) {
                        e.takeDamage(150, this);
                        // Add a small knockback
                        e.x += this.facingRight ? 30 : -30;
                    }
                }
            });
        }
    }

    forceAttack() {
        if (this.state === 'attack') return; // Don't interrupt current attack
        
        this.state = 'attack';
        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false;

        // Auto face closest enemy if standing still
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
        } else {
            if (Math.random() < 0.01) {
                this.x = this.originX + (Math.random() - 0.5) * 100;
                this.y = this.originY + (Math.random() - 0.5) * 100;
            }
        }
    }
    takeDamage(amount, source) {
        this.hp -= amount;
        Game.spawnDamageText(this.x, this.y - 30, amount.toString(), "#fff");
        this.target = source;
        if (this.hp <= 0) { this.isDead = true; Game.kills++; }
    }
}

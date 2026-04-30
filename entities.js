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
        
        // SPRITESHEET CONFIGURATION
        // YOU MUST UPDATE THESE NUMBERS based on your mango-full-sheet-sheet.png!
        this.animConfig = {
            frameWidth: 128,   // Image Width divided by number of columns
            frameHeight: 128,  // Image Height divided by number of rows
            
            idle:   { row: 0, frames: 4, speed: 0.15 }, // Row 0, 4 frames
            run:    { row: 1, frames: 8, speed: 0.08 }, // Row 1, 8 frames
            attack: { row: 3, frames: 8, speed: 0.06 }  // Row 3 (the combo slash), 8 frames
        };

        this.currentFrame = 0;
        this.animTimer = 0;
        this.attackFired = false; // Prevents firing 100 times during one attack animation
    }

    update(dt, enemies) {
        if (this.isDead) return;

        let activeAnim = this.animConfig[this.state];

        // 1. Advance Animation Frames
        this.animTimer += dt;
        if (this.animTimer >= activeAnim.speed) {
            this.currentFrame++;
            this.animTimer = 0;

            // Handle end of animation
            if (this.currentFrame >= activeAnim.frames) {
                if (this.state === 'attack') {
                    // Attack finished, revert to idle or run
                    this.state = UI.joystick.active ? 'run' : 'idle';
                    this.attackFired = false; 
                    this.currentFrame = 0;
                    activeAnim = this.animConfig[this.state];
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
        if (this.state === 'attack' && this.currentFrame === Math.floor(activeAnim.frames / 2) && !this.attackFired) {
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

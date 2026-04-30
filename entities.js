class Entity {
    constructor(x, y, radius, speed) {
        this.x = x; this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.hp = 100; this.maxHp = 100;
        this.target = null;
        this.isDead = false;
    }
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 20, 250); // Speed 250
        this.hp = 1000; this.maxHp = 1000;
        this.attackRange = 250;
        this.lastAttack = 0;
        this.attackCooldown = 0.6; 
        this.autoAttack = false;

        // Spritesheet configuration
        this.sprite = {
            frameX: 0, 
            frameY: 0,     // 0: Down, 1: Left, 2: Right, 3: Up
            maxFrames: 4,  // Number of columns in the spritesheet
            timer: 0, 
            interval: 0.15, // Speed of animation
            width: 64,     // Width of ONE single frame (Change depending on your sheet)
            height: 64     // Height of ONE single frame
        };
    }

    update(dt, enemies) {
        if (this.isDead) return;

        // --- Movement & Animation via Joystick ---
        if (UI.joystick.active) {
            this.x += UI.joystick.vector.x * this.speed * dt;
            this.y += UI.joystick.vector.y * this.speed * dt;
            
            // Determine Direction (Row)
            if (Math.abs(UI.joystick.vector.x) > Math.abs(UI.joystick.vector.y)) {
                this.sprite.frameY = UI.joystick.vector.x > 0 ? 2 : 1; // 2: Right, 1: Left
            } else {
                this.sprite.frameY = UI.joystick.vector.y > 0 ? 0 : 3; // 0: Down, 3: Up
            }

            // Animate Frames (Column)
            this.sprite.timer += dt;
            if (this.sprite.timer >= this.sprite.interval) {
                // cycle frames 1 to maxFrames-1 (assuming 0 is idle standing frame)
                this.sprite.frameX = (this.sprite.frameX + 1) % this.sprite.maxFrames;
                this.sprite.timer = 0;
            }
            
            // Interrupt auto-pathing/targeting if we manually move away
            if (this.target && this.distanceTo(this.target) > this.attackRange + 50) {
                this.target = null;
            }
        } else {
            // Idle Frame
            this.sprite.frameX = 0; 
        }

        // --- Combat Logic ---
        if (this.autoAttack && !this.target) {
            let closest = null;
            let minDist = Infinity;
            enemies.forEach(e => {
                let d = this.distanceTo(e);
                if (d < 400 && d < minDist) { minDist = d; closest = e; }
            });
            if (closest) this.target = closest;
        }

        if (this.target) {
            if (this.target.isDead) {
                this.target = null;
            } else {
                let dist = this.distanceTo(this.target);
                // If in range and NOT manually moving away, Attack
                if (dist <= this.attackRange) {
                    const now = performance.now() / 1000;
                    if (now - this.lastAttack >= this.attackCooldown) {
                        Game.fireProjectile(this, this.target, 'missile');
                        this.lastAttack = now;
                        
                        // Face target when attacking
                        const dx = this.target.x - this.x;
                        const dy = this.target.y - this.y;
                        if (Math.abs(dx) > Math.abs(dy)) {
                            this.sprite.frameY = dx > 0 ? 2 : 1;
                        } else {
                            this.sprite.frameY = dy > 0 ? 0 : 3;
                        }
                    }
                }
            }
        }
    }

    forceAttack() {
        if (!this.target && Game.enemies.length > 0) {
            // Find closest to attack if none selected
            this.target = Game.enemies.reduce((prev, curr) => this.distanceTo(curr) < this.distanceTo(prev) ? curr : prev);
        }
        if (this.target && this.distanceTo(this.target) <= this.attackRange) {
            const now = performance.now() / 1000;
            if (now - this.lastAttack >= this.attackCooldown) {
                 Game.fireProjectile(this, this.target, 'missile');
                 this.lastAttack = now;
            }
        }
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 20, 100);
        this.hp = 200; this.maxHp = 200;
        this.aggroRange = 150; 
        this.attackRange = 40;
        this.lastAttack = 0;
        this.originX = x; this.originY = y;
    }

    update(dt, player) {
        if (this.isDead) return;

        let distToPlayer = this.distanceTo(player);

        if (distToPlayer <= this.aggroRange) {
            this.target = player;
        }

        if (this.target) {
            if (distToPlayer > this.attackRange) {
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
        this.target = source; // Retaliate
        if (this.hp <= 0) {
            this.isDead = true;
            Game.kills++;
        }
    }
}

class Projectile {
    constructor(source, target, speed, assetKey) {
        this.x = source.x; this.y = source.y;
        this.target = target;
        this.source = source;
        this.speed = speed;
        this.assetKey = assetKey;
        this.isDead = false;
    }
    update(dt) {
        if (this.target.isDead) { this.isDead = true; return; }
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 10) {
            this.target.takeDamage(45, this.source);
            this.isDead = true;
        } else {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }
}

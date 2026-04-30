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
        super(x, y, 20, 200);
        this.hp = 1000; this.maxHp = 1000;
        this.destX = x; this.destY = y;
        this.attackRange = 250;
        this.lastAttack = 0;
        this.attackCooldown = 0.8; // seconds
        this.autoAttack = false;
    }

    update(dt, enemies) {
        if (this.isDead) return;

        // Auto Attack Logic
        if (this.autoAttack && !this.target) {
            let closest = null;
            let minDist = Infinity;
            enemies.forEach(e => {
                let d = this.distanceTo(e);
                if (d < 400 && d < minDist) { minDist = d; closest = e; }
            });
            if (closest) this.target = closest;
        }

        // Movement & Combat
        if (this.target) {
            if (this.target.isDead) {
                this.target = null;
            } else {
                let dist = this.distanceTo(this.target);
                if (dist > this.attackRange) {
                    // Move towards target
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.x += Math.cos(angle) * this.speed * dt;
                    this.y += Math.sin(angle) * this.speed * dt;
                } else {
                    // In range, Attack
                    this.destX = this.x; this.destY = this.y; // stop moving
                    const now = performance.now() / 1000;
                    if (now - this.lastAttack >= this.attackCooldown) {
                        Game.fireProjectile(this, this.target, "assets/magic_missile.png");
                        this.lastAttack = now;
                    }
                }
            }
        } else {
            // Normal click-to-move
            const distToDest = Math.sqrt((this.destX - this.x)**2 + (this.destY - this.y)**2);
            if (distToDest > 5) {
                const angle = Math.atan2(this.destY - this.y, this.destX - this.x);
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
            }
        }
    }

    setDestination(x, y) {
        this.destX = x; this.destY = y;
        this.target = null; // override attack target
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 20, 100);
        this.hp = 200; this.maxHp = 200;
        this.aggroRange = 150; // Only attack when very close
        this.attackRange = 40;
        this.lastAttack = 0;
        this.originX = x; this.originY = y;
        this.state = 'idle';
    }

    update(dt, player) {
        if (this.isDead) return;

        let distToPlayer = this.distanceTo(player);

        // Logic: Attack if player is very close, OR if already aggroed (target !== null)
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
                    player.hp -= 25; // Simple melee damage
                    Game.spawnDamageText(player.x, player.y - 30, "25", "#ff0000");
                    this.lastAttack = now;
                }
            }
        } else {
            // Wander around origin
            if (Math.random() < 0.01) {
                this.x = this.originX + (Math.random() - 0.5) * 100;
                this.y = this.originY + (Math.random() - 0.5) * 100;
            }
        }
    }

    takeDamage(amount, source) {
        this.hp -= amount;
        Game.spawnDamageText(this.x, this.y - 30, amount.toString(), "#fff");
        this.target = source; // Retaliate when attacked!
        if (this.hp <= 0) {
            this.isDead = true;
            Game.kills++;
        }
    }
}

class Projectile {
    constructor(source, target, speed, asset) {
        this.x = source.x; this.y = source.y;
        this.target = target;
        this.source = source;
        this.speed = speed;
        this.asset = asset;
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

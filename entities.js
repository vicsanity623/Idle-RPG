/**
 * entities.js
 * Contains Player, Enemy, Loot, and Particle logic.
 */

// --- HIVE MIND AI ---
const HiveMind = {
    flankWeight: 0,
    packSize: 0,
    update: function() {
        this.packSize = entities.filter(e => e instanceof Enemy).length;
        this.flankWeight = Math.min(1.0, this.packSize / 20); 
    }
};



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

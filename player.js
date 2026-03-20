/**
 * player.js
 * Contains the Player class logic.
 */

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
            { id: 'pot', cdMax: 10, current: 0 },
            { id: 'atk', cdMax: 1, current: 0 },
            { id: 'aura', cdMax: 5, current: 0 },
            { id: 'dash', cdMax: 3, current: 0 }
        ];
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

    update(dt) {
        if (this.hp < this.getMaxHp()) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getRegen() * dt);
        }

        if (Input.joystick.active) {
            this.vx = Math.cos(Input.joystick.angle) * this.speed;
            this.vy = Math.sin(Input.joystick.angle) * this.speed;
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

        // REF NO: Magic Number Refactor by Pyob
        const PLAYER_ATTACK_RANGE = 200; 

        if (this.skills[1].current <= 0) {
            let target = this.getNearestEnemy(PLAYER_ATTACK_RANGE);
            if (target) {
                let damage = this.getAttackPower();
                let isCrit = Math.random() * 100 < this.getCritChance();
                if (isCrit) damage *= this.getCritMultiplier();
                target.takeDamage(damage, isCrit);
                for (let i = 0; i < randomInt(3, 5); i++) {
                    particles.push(new Particle(this.x, this.y, this.color)); 
                }
                this.skills[1].current = this.skills[1].cdMax * this.getAttackSpeedFactor(); 
            }
        }

        if (this.skills[2].current <= 0) {
            entities.forEach(e => {
                if (e instanceof Enemy && Math.hypot(this.x - e.x, this.y - e.y) < 120) {
                    e.takeDamage(this.getAttackPower() * 0.4, false);
                }
            });
            spawnAura(this.x, this.y);
            this.skills[2].current = this.skills[2].cdMax;
        }

        if (this.hp < this.getMaxHp() * 0.4 && this.skills[0].current <= 0) {
            this.hp = Math.min(this.getMaxHp(), this.hp + this.getMaxHp() * 0.4);
            spawnFloatingText(this.x, this.y, "HEALED", '#0f0');
            this.skills[0].current = this.skills[0].cdMax;
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

export { Player };
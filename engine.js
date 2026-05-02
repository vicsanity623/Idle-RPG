/**
 * Core Game Engine
 * Standards: ES6+, Performance Optimized, Separation of Concerns
 */

var Game = {
    // --- Configuration ---
    WORLD_SIZE: 3000,
    TILE_SIZE: 100,
    MAX_ENEMIES: 30,
    SAVE_KEY: 'mmo_save_data',

    // --- State Management ---
    canvas: null,
    ctx: null,
    miniCanvas: null,
    miniCtx: null,
    lastTime: 0,
    camera: { x: 0, y: 0, width: 0, height: 0 },
    
    player: null,
    enemies: [],
    npcs: [],
    lootItems: [],
    projectiles:[],
    visualEffects:[],
    damageTexts:[], 
    kills: 0,
    images: {},
    assetsLoaded: 0,
    totalAssets: 0,

    // --- Day/Night Cycle ---
    timeOfDay: 0,
    dayCount: 1,
    isNight: false,

    // --- Challenge Mode ---
    inChallengeMode: false,
    challengeTimeRemaining: 0,
    challengeRewards: { xp: 0, gold: 0, equipment: [], runes: 0 },
    challengeSpawns: 0,

    // --- Quest System ---
    activeQuest: null,
    questList: [
        { id: 1, title: "[Battle] Ghost Hunter", obj: "Kill Sleepless Ghost", target: 10, g: 100, xp: 200 },
        { id: 2, title: "[Battle] Exorcist", obj: "Kill Sleepless Ghost", target: 20, g: 300, xp: 500 },
        { id: 3, title: "[Battle] Spirit Bane", obj: "Kill Sleepless Ghost", target: 40, g: 600, xp: 1000 },
        { id: 4, title: "[Battle] The Cleansing", obj: "Kill Sleepless Ghost", target: 60, g: 1000, xp: 2000 },
        { id: 5, title: "[Battle] Ghost King's Fall", obj: "Kill Sleepless Ghost", target: 100, g: 2500, xp: 5000 }
    ],

    async init() {
        // Initialization of Canvases
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return console.error("Game Canvas not found");
        
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.miniCanvas = document.getElementById('minimapCanvas');
        this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Standardized Pointer Support
        this.canvas.addEventListener('pointerdown', (e) => this.handleInput(e));

        // Initialize Entities
        this.player = new Player(this.WORLD_SIZE / 2, this.WORLD_SIZE / 2);
        this.npcs =[new NPC(this.WORLD_SIZE / 2 + 100, this.WORLD_SIZE / 2, "Quest Master")];

        // Setup Potion Shortcuts
        this.setupActionSlots();

        // Load Assets
        this.loadAsset('bg', 'assets/grass.png');
        this.loadAsset('ghost', 'assets/sleepless_ghost.png');

        // Load Saved Data
        this.loadGame();

        // Initial UI Sync (Calls to the newly standalone ui.js)
        if (typeof UI !== 'undefined') {
            UI.updateInventory(this.player);
            UI.updatePlayerStats(this.player);
        }

        // Start Game Loop
        requestAnimationFrame((t) => this.loop(t));
        
        // Periodic Save (Every 30 seconds)
        setInterval(() => this.saveGame(), 30000);
    },

    setupActionSlots() {
        document.querySelectorAll('.action-slot.potion').forEach((btn, idx) => {
            btn.onclick = (e) => {
                e.preventDefault();
                const type = idx === 0 ? "Health Potion" : "Mana Potion";
                const item = this.player.inventory.find(i => i.name === type);
                if (item && typeof UI !== 'undefined') {
                    UI.handleItemClick(item);
                } else if (typeof UI !== 'undefined') {
                    UI.showLootNotification(`No ${type}s left!`, "rarity-common");
                }
            };
        });
    },

    loadAsset(key, src) {
        this.totalAssets++;
        const img = new Image();
        img.onload = () => this.assetsLoaded++;
        img.onerror = () => console.error(`Failed to load asset: ${src}`);
        img.src = src;
        this.images[key] = img;
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
    },

    handleInput(e) {
        const rect = this.canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left) + this.camera.x;
        const worldY = (e.clientY - rect.top) + this.camera.y;

        // 1. Check NPC Interactions
        for (let npc of this.npcs) {
            if (Math.hypot(npc.x - worldX, npc.y - worldY) < 60) {
                this.interactWithNPC(npc);
                return;
            }
        }

        // 2. Check Enemy Targeting
        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (!enemy.isDead && Math.hypot(enemy.x - worldX, enemy.y - worldY) < enemy.radius + 20) {
                clickedEnemy = enemy;
                break;
            }
        }
        this.player.target = clickedEnemy;
    },

    interactWithNPC(npc) {
        if (!this.activeQuest) {
            let baseQuest = this.questList[Math.floor(Math.random() * this.questList.length)];
            let multiplier = this.player.level || 1;
            this.activeQuest = {
                ...baseQuest,
                g: baseQuest.g * multiplier,
                xp: baseQuest.xp * multiplier
            };
            this.kills = 0; 
            
            const questBox = document.getElementById('quest-tracker');
            if (questBox) {
                questBox.style.display = 'block';
                questBox.classList.remove('quest-complete-glow');
            }
            
            if (typeof UI !== 'undefined') {
                UI.showLootNotification(`Quest Accepted: ${this.activeQuest.title}`, "rarity-epic");
                UI.updatePlayerStats(this.player);
            }
            this.saveGame();
        } else if (typeof UI !== 'undefined') {
            UI.showLootNotification(`${npc.name}: "Finish your task first!"`, "rarity-common");
        }
    },
    clearEnemies() {
        this.enemies = [];
    },

    getBossEntryCost() {
        const rank = this.player.bossRank || 0;
        return Math.floor(1000 * Math.pow(1.25, rank));
    },

    enterBossArena() {
        if (!this.player || this.player.isDead) return;
        
        const cost = this.getBossEntryCost();
        if (this.player.gold < cost) {
            this.showNotification(`Need ${cost.toLocaleString()} Gold to enter!`, "#e74c3c");
            return;
        }

        this.player.gold -= cost;
        this.isBossState = true;
        this.bossMinionTimer = 0;
        this.clearEnemies();
        
        // Spawn the Boss
        const boss = new Enemy(this.player.x + 200, this.player.y);
        boss.isBoss = true;
        boss.name = "Sleepless Ghost Lord";
        boss.hp = 10000 * (1 + (this.player.bossRank || 0) * 0.5);
        boss.maxHp = boss.hp;
        boss.attackPower = 100 * (1 + (this.player.bossRank || 0) * 0.2);
        boss.radius = 80;
        boss.speed = 80;
        this.enemies.push(boss);
        this.player.target = boss;
        this.player.currentBossDmg = 0;

        if (typeof UI !== 'undefined') {
            UI.toggleModal('map-modal');
            UI.showLootNotification("THE LORD HAS AWOKEN", "rarity-legendary");
            UI.updatePlayerStats(this.player);
        }
    },

    exitBossArena() {
        this.isBossState = false;
        this.clearEnemies();
        this.projectiles = []; // Clear projectiles too
        this.visualEffects = [];
        if (typeof UI !== 'undefined') UI.showLootNotification("Arena Cleared", "rarity-common");
    },

    enterChallengeArena() {
        if (!this.player || this.player.isDead) return;
        this.inChallengeMode = true;
        this.isBossState = false;
        this.challengeTimeRemaining = 120 + (this.player.challengeBonusTime || 0);
        this.challengeRewards = { xp: 0, gold: 0, equipment: [], runes: 0 };
        this.clearEnemies();
        this.projectiles = [];
        this.visualEffects = [];
        this.lootItems = [];
        this.player.x = this.WORLD_SIZE / 2;
        this.player.y = this.WORLD_SIZE / 2;
        if (typeof UI !== 'undefined') {
            UI.toggleModal('map-modal');
            UI.showLootNotification("CHALLENGE STARTED!", "rarity-legendary");
        }
    },

    exitChallengeArena(died = false) {
        this.inChallengeMode = false;
        this.clearEnemies();
        this.projectiles = [];
        this.visualEffects = [];
        this.lootItems = [];
        
        if (!died) {
            this.player.challengeBonusTime = (this.player.challengeBonusTime || 0) + 5;
            if (typeof UI !== 'undefined') UI.showChallengeCompletedModal(this.challengeRewards);
        } else {
            if (typeof UI !== 'undefined') UI.showLootNotification("Challenge Failed.", "rarity-common");
        }
        this.player.x = this.WORLD_SIZE / 2;
        this.player.y = this.WORLD_SIZE / 2;
    },

    showNotification(text, color) {
        if (typeof UI !== 'undefined') {
            UI.showLootNotification(text, "rarity-epic"); 
        }
    },
    castSkill(skillId) {
        if (!this.player || this.player.isDead) return;
        const skill = this.player.skills.find(s => s.id === skillId);
        if (!skill || !skill.active) return;
        if (skill.timer > 0 || this.player.mp < skill.mpCost) return;

        this.player.mp -= skill.mpCost;
        skill.timer = skill.cooldown;

        if (skill.id === 'spirit_spear' || skill.id === 'lightning_bullet') {
            if (!this.player.target || this.player.target.isDead) this.player.target = this.player.findClosestEnemy(this.enemies, 800);
            if (this.player.target) {
                const dmg = this.player.stats.attack * skill.damageMult;
                this.projectiles.push(new Projectile(this.player.x, this.player.y - 30, this.player.target, dmg));
                
                // Spirit Spear Heal Effect
                if (skill.id === 'spirit_spear') {
                    const heal = Math.floor(dmg * 0.1);
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                    this.spawnDamageText(this.player.x, this.player.y - 60, `+${heal} HP`, "#2ecc71");
                }

                if (typeof UI !== 'undefined') UI.showLootNotification(`${skill.name.toUpperCase()}!`, "rarity-epic");
            } else {
                this.player.mp += skill.mpCost;
                skill.timer = 0;
            }
        } 
        else if (skill.id === 'liston_cutoff') {
            // EXPLOSIVE AOE EFFECT
            this.visualEffects.push({ type: 'shockwave', x: this.player.x, y: this.player.y, life: 0.6, maxLife: 0.6, radius: 250, color: '#3498db' });
            this.visualEffects.push({ type: 'explosion', x: this.player.x, y: this.player.y, life: 0.8, maxLife: 0.8, radius: 200, color: '#ffffff' });
            
            this.enemies.forEach(e => {
                if (this.player.distanceTo(e) <= 250) {
                    e.takeDamage(this.player.stats.attack * skill.damageMult, this.player);
                    this.spawnDamageText(e.x, e.y - 50, "CRITICAL!", "#e67e22");
                }
            });
            if (typeof UI !== 'undefined') UI.showLootNotification("LISTON CUT OFF!", "rarity-legendary");
        }
        else if (skill.id === 'cannibal_devour') {
            this.visualEffects.push({ type: 'shockwave', x: this.player.x, y: this.player.y, life: 1, maxLife: 1, radius: 150, color: '#e74c3c' });
            this.visualEffects.push({ type: 'heal', x: this.player.x, y: this.player.y, life: 1.2, maxLife: 1.2 });
            
            const heal = 300 * skill.level;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
            this.spawnDamageText(this.player.x, this.player.y - 60, "DEVOUR!", "#c0392b");
            if (typeof UI !== 'undefined') UI.showLootNotification("CANNIBAL DEVOUR!", "rarity-epic");
        }
    },

    saveGame() {
        if (!this.player) return;
        const saveData = {
            level: this.player.level,
            xp: this.player.xp,
            maxXp: this.player.maxXp,
            gold: this.player.gold,
            bossRank: this.player.bossRank,
            maxBossDmg: this.player.maxBossDmg,
            inventory: this.player.inventory,
            equipment: this.player.equipment,
            skills: this.player.skills, // FIX: Save skills
            kills: this.kills,
            activeQuest: this.activeQuest
        };
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
    },

    loadGame() {
        const saved = localStorage.getItem(this.SAVE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Skill merge logic: Keep existing skill object structures but update active/level from save
                if (data.skills) {
                    data.skills.forEach(savedSkill => {
                        const existing = this.player.skills.find(s => s.id === savedSkill.id);
                        if (existing) {
                            existing.active = savedSkill.active;
                            existing.level = savedSkill.level;
                        }
                    });
                    delete data.skills; // Don't overwrite the whole skill array to preserve methods/icons
                }

                Object.assign(this.player, data);
                this.player.recalculateStats(); // Apply passives from loaded skills
                this.kills = data.kills || 0;
                this.activeQuest = data.activeQuest || null;
                if (typeof UI !== 'undefined') {
                    UI.updatePlayerStats(this.player);
                    UI.showLootNotification("Progress Loaded", "rarity-legendary");
                }
            } catch (e) {
                console.error("Save data corrupted.");
            }
        }
    },

    spawnDamageText(x, y, text, color) {
        this.damageTexts.push({ x, y, text, color, life: 1.0 });
    },

    spawnLoot(x, y, type) {
        this.lootItems.push(new LootItem(x, y, type));
    },

    update(dt) {
        if (this.player.isDead) {
            if (this.isBossState) this.exitBossArena(); // Fix: Cleanup boss if player dies
            if (this.inChallengeMode) this.exitChallengeArena(true);
            this.player.update(dt, this.enemies); // Handle respawn timer
            return;
        }

        // --- Day / Night Cycle Logic ---
        this.timeOfDay += dt;
        const DAY_DURATION = 120;
        const NIGHT_DURATION = 60;
        const CYCLE_TOTAL = DAY_DURATION + NIGHT_DURATION;
        if (this.timeOfDay >= CYCLE_TOTAL) {
            this.timeOfDay -= CYCLE_TOTAL;
            this.dayCount++;
        }
        this.isNight = this.timeOfDay >= DAY_DURATION;

        // --- Challenge Mode Bounds ---
        if (this.inChallengeMode) {
            this.challengeTimeRemaining -= dt;
            const chCenterX = this.WORLD_SIZE / 2;
            const chCenterY = this.WORLD_SIZE / 2;
            const boundary = 800; // Restricted tile size
            this.player.x = Math.max(chCenterX - boundary, Math.min(this.player.x, chCenterX + boundary));
            this.player.y = Math.max(chCenterY - boundary, Math.min(this.player.y, chCenterY + boundary));
            
            if (this.challengeTimeRemaining <= 0) {
                this.exitChallengeArena(false);
                return;
            }
        }

        this.player.update(dt, this.enemies);
        
        // Smooth Camera Follow
        const targetCamX = this.player.x - this.camera.width / 2;
        const targetCamY = this.player.y - this.camera.height / 2;
        this.camera.x = Math.max(0, Math.min(targetCamX, this.WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(targetCamY, this.WORLD_SIZE - this.camera.height));

        // Update Entities
        this.enemies.forEach(e => e.update(dt, this.player));
        // Remove enemies that are dead OR have 0 HP to prevent 'immortal' state
        this.enemies = this.enemies.filter(e => !e.isDead && e.hp > 0);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => p.life > 0);

        this.visualEffects.forEach(v => {
            v.life -= dt;
            if (v.type === 'whirlwind' || v.type === 'heal') {
                v.x = this.player.x;
                v.y = this.player.y;
            }
        });
        this.visualEffects = this.visualEffects.filter(v => v.life > 0);

        this.lootItems.forEach(item => {
            item.life -= dt;
            
            if (this.inChallengeMode) {
                // Magnet effect to pull loot
                const angle = Math.atan2(this.player.y - item.y, this.player.x - item.x);
                const magnetSpeed = 800; // Fast pull speed
                item.x += Math.cos(angle) * magnetSpeed * dt;
                item.y += Math.sin(angle) * magnetSpeed * dt;
            }

            if (this.player.distanceTo(item) < 50) {
                this.player.pickUpItem(item);
                item.isPickedUp = true;
            }
        });
        this.lootItems = this.lootItems.filter(item => !item.isPickedUp && item.life > 0);

        this.damageTexts.forEach(dtxt => {
            dtxt.y -= 40 * dt;
            dtxt.life -= dt;
        });
        this.damageTexts = this.damageTexts.filter(dtxt => dtxt.life > 0);

        // Respawn Enemies
        let currentMaxEnemies = this.MAX_ENEMIES;
        if (this.isNight) currentMaxEnemies = 150; // Night cycle 10x pseudo horde limit
        if (this.inChallengeMode) currentMaxEnemies = 200; // Massive horde in challenge
        
        if (!this.isBossState && this.enemies.length < currentMaxEnemies) {
            // Spawn multiple enemies per tick in challenge or night to fill quickly
            let spawnCount = this.inChallengeMode ? 5 : (this.isNight ? 2 : 1);
            
            for (let i = 0; i < spawnCount; i++) {
                if (this.enemies.length >= currentMaxEnemies) break;
                
                let rx, ry;
                if (this.inChallengeMode) {
                    rx = (this.WORLD_SIZE / 2) + (Math.random() - 0.5) * 1600;
                    ry = (this.WORLD_SIZE / 2) + (Math.random() - 0.5) * 1600;
                } else {
                    rx = Math.random() * this.WORLD_SIZE;
                    ry = Math.random() * this.WORLD_SIZE;
                }
                
                const enemy = new Enemy(rx, ry);
                
                // Apply Realm Scaling
                if (window.Realms) {
                    const mult = Realms.getMultiplier();
                    enemy.maxHp = Math.floor(300 * mult);
                    enemy.hp = enemy.maxHp;
                    enemy.attackPower = Math.floor(25 * mult); 
                }

                // 1% chance for Mini-boss during Night
                if (this.isNight && !this.inChallengeMode && Math.random() < 0.01) {
                    enemy.maxHp *= 5;
                    enemy.hp = enemy.maxHp;
                    enemy.attackPower *= 2;
                    enemy.radius *= 1.5;
                    enemy.name = "Night Terror";
                }

                // Periodic Boss in Challenge Mode
                if (this.inChallengeMode && Math.random() < 0.02) {
                    enemy.isBoss = true;
                    enemy.name = "Challenge Boss";
                    enemy.maxHp *= 3;
                    enemy.hp = enemy.maxHp;
                    enemy.radius = 60;
                }
                
                this.enemies.push(enemy);
            }
        }

        // Boss Minion Spawning
        if (this.isBossState) {
            this.bossMinionTimer += dt;
            if (this.bossMinionTimer > 5) {
                this.bossMinionTimer = 0;
                const minion = new Enemy(this.player.x + (Math.random() - 0.5) * 400, this.player.y + (Math.random() - 0.5) * 400);
                minion.hp = 100; minion.maxHp = 100;
                this.enemies.push(minion);
            }
            // Check if boss is dead
            const boss = this.enemies.find(e => e.isBoss);
            if (!boss || boss.isDead) {
                this.exitBossArena();
                this.player.bossRank = (this.player.bossRank || 0) + 1;
                
                // --- WORLD SCALING ---
                // Every boss defeat increases global enemy power by 20%
                if (typeof Realms !== 'undefined') {
                    Realms.globalDifficultyMultiplier *= 1.2;
                }
                
                if (typeof UI !== 'undefined') UI.showLootNotification(`Boss Defeated! World Difficulty +20% | Rank: ${this.player.bossRank}`, "rarity-legendary");
            }
        }

        // Logic-based UI updates (throttled to save CPU)
        if (typeof UI !== 'undefined' && Math.random() < 0.1) {
            UI.updatePlayerStats(this.player);
            UI.updateXpBar(this.player);
        }
    },

    draw() {
        const { ctx, camera, images, TILE_SIZE } = this;
        ctx.fillStyle = "#1e381e"; 
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Draw Tiled Background
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = Math.ceil((camera.x + camera.width) / TILE_SIZE);
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = Math.ceil((camera.y + camera.height) / TILE_SIZE);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                let px = c * TILE_SIZE - camera.x;
                let py = r * TILE_SIZE - camera.y;
                if (this.inChallengeMode) {
                    ctx.fillStyle = (r+c)%2===0 ? '#2c3e50' : '#34495e';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#1a252f';
                    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                } else if (images.bg && images.bg.complete) {
                    ctx.drawImage(images.bg, px, py, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.fillStyle = (r+c)%2===0 ? '#2a4a2a' : '#1e381e';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // 2. Draw Loot
        this.lootItems.forEach(item => {
            const sx = item.x - camera.x;
            const sy = item.y - camera.y;
            const color = item.rarity === 'legendary' ? "#f1c40f" : item.rarity === 'epic' ? "#9b59b6" : item.rarity === 'rare' ? "#3498db" : "#fff";
            ctx.fillStyle = color;
            ctx.shadowBlur = 15; ctx.shadowColor = color;
            ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        });

        // 3. Draw NPCs
        this.npcs.forEach(n => {
            const sx = n.x - camera.x; const sy = n.y - camera.y;
            ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(sx, sy, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "white"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(n.name, sx, sy - 40);
            ctx.fillStyle = "#f1c40f"; ctx.font = "bold 30px Arial"; ctx.fillText("!", sx, sy - 60);
        });

        // 4. Draw Projectiles
        this.projectiles.forEach(p => {
            p.trail.forEach(t => {
                ctx.fillStyle = `rgba(255, 69, 0, ${t.alpha})`;
                ctx.beginPath(); ctx.arc(t.x - camera.x, t.y - camera.y, 8, 0, Math.PI*2); ctx.fill();
            });
            ctx.fillStyle = "#ff0000";
            ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, 12, 0, Math.PI*2); ctx.fill();
        });

        // 4.5 Draw Visual Effects (DRAMATIC ENHANCEMENT)
        this.visualEffects.forEach(v => {
            const sx = v.x - camera.x; const sy = v.y - camera.y;
            const progress = 1 - v.life / v.maxLife;
            ctx.save();
            
            if (v.type === 'shockwave') {
                ctx.beginPath();
                ctx.arc(sx, sy, v.radius * progress, 0, Math.PI * 2);
                ctx.strokeStyle = v.color || '#fff';
                ctx.lineWidth = 15 * (1 - progress);
                ctx.stroke();
            } else if (v.type === 'explosion') {
                ctx.beginPath();
                ctx.arc(sx, sy, v.radius * Math.sin(progress * Math.PI), 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, v.radius);
                grad.addColorStop(0, v.color || '#fff');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.globalAlpha = 1 - progress;
                ctx.fill();
            } else if (v.type === 'whirlwind') {
                ctx.beginPath();
                ctx.arc(sx, sy, v.radius * progress, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(155, 89, 182, ${1 - progress})`;
                ctx.lineWidth = 20;
                ctx.stroke();
            } else if (v.type === 'heal') {
                ctx.beginPath();
                ctx.arc(sx, sy, 60 + progress * 120, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(46, 204, 113, ${(1 - progress) * 0.4})`;
                ctx.fill();
                // Vertical light beam
                ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.6})`;
                ctx.fillRect(sx - 20, sy - 200 * (1-progress), 40, 200 * (1-progress));
            }
            ctx.restore();
        });

        // 5. Draw Enemies
        this.enemies.forEach(e => {
            const sx = e.x - camera.x; const sy = e.y - camera.y;
            const drawInfo = e.getDrawInfo ? e.getDrawInfo() : { image: images.ghost, drawWidth: e.radius*2, drawHeight: e.radius*2 };
            
            if (drawInfo.image && drawInfo.image.complete) {
                ctx.drawImage(drawInfo.image, sx - drawInfo.drawWidth/2, sy - drawInfo.drawHeight/2, drawInfo.drawWidth, drawInfo.drawHeight);
            } else {
                ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.fill();
            }
            // Enemy HP Bar
            ctx.fillStyle = '#000'; ctx.fillRect(sx - 15, sy - e.radius - 10, 30, 4);
            ctx.fillStyle = '#f00'; ctx.fillRect(sx - 15, sy - e.radius - 10, 30 * (e.hp / e.maxHp), 4);
        });

        // 6. Draw Player
        if (!this.player.isDead) {
            const pScreenX = this.player.x - camera.x;
            const pScreenY = this.player.y - camera.y;
            const pDraw = this.player.getDrawInfo ? this.player.getDrawInfo() : null;

            if (pDraw && pDraw.image) {
                ctx.save();
                ctx.translate(pScreenX, pScreenY); 
                if (!this.player.facingRight) ctx.scale(-1, 1); 
                ctx.drawImage(pDraw.image, -pDraw.drawWidth/2, -pDraw.drawHeight, pDraw.drawWidth, pDraw.drawHeight);
                ctx.restore(); 
            } else {
                ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(pScreenX, pScreenY, 20, 0, Math.PI*2); ctx.fill();
            }
        }

        // 7. Damage Text Overlay
        ctx.textAlign = "center";
        this.damageTexts.forEach(dtxt => {
            const sx = dtxt.x - camera.x; const sy = dtxt.y - camera.y;
            ctx.fillStyle = `rgba(0,0,0, ${dtxt.life})`; ctx.fillText(dtxt.text, sx+2, sy+2);
            ctx.globalAlpha = dtxt.life;
            ctx.fillStyle = dtxt.color;
            ctx.font = "bold 20px Arial";
            ctx.fillText(dtxt.text, sx, sy);
        });
        ctx.globalAlpha = 1.0;

        // 8. Death Overlay
        if (this.player.isDead) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = "white"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center";
            ctx.fillText("YOU HAVE FALLEN", this.canvas.width/2, this.canvas.height/2);
            ctx.font = "20px Arial";
            ctx.fillText(`Respawning in ${Math.ceil(10 - this.player.respawnTimer)}s...`, this.canvas.width/2, this.canvas.height/2 + 50);
        }

        // 9. World Overlays (Night Mode & Challenge Timer)
        if (this.isNight && !this.inChallengeMode) {
            ctx.fillStyle = "rgba(0, 10, 30, 0.4)";
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.inChallengeMode && !this.player.isDead) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(this.canvas.width/2 - 100, 40, 200, 40);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
            ctx.fillText(`Time: ${Math.ceil(this.challengeTimeRemaining)}s`, this.canvas.width/2, 68);
        }

        this.drawMinimap();
    },

    drawMinimap() {
        if (!this.miniCtx) return;
        this.miniCtx.clearRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);
        const scale = this.miniCanvas.width / this.WORLD_SIZE;
        
        this.miniCtx.fillStyle = 'red';
        this.enemies.forEach(e => this.miniCtx.fillRect(e.x * scale, e.y * scale, 3, 3));
        
        this.miniCtx.fillStyle = 'lime';
        this.miniCtx.fillRect(this.player.x * scale, this.player.y * scale, 4, 4);
    },

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        dt = Math.min(dt, 0.1); 
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
};

class Projectile {
    constructor(x, y, target, damage) {
        this.x = x; this.y = y; this.target = target; this.damage = damage;
        this.speed = 600;
        this.life = 2.0;
        this.trail =[];
    }
    update(dt) {
        if (this.life > 0) { // Only add new trail points if projectile is active
            this.trail.push({x: this.x, y: this.y, alpha: 1.0});
            if (this.trail.length > 12) this.trail.shift();
        }
        this.trail.forEach(t => t.alpha -= 0.08); // Always fade existing trail particles
        this.trail = this.trail.filter(t => t.alpha > 0); // Remove fully faded particles
            if (!this.target || this.target.isDead) { 
            this.life = 0; // Immediately remove if target is invalid or dead
            return; 
        }

        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
        this.life -= dt;

        if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 25) {
            if (this.target.takeDamage) this.target.takeDamage(this.damage, Game.player);
            this.life = 0;
        }
    }
}

window.addEventListener('load', () => Game.init());

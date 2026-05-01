const UI = {
    joystick: { active: false, vector: { x: 0, y: 0 } },

    init() {
        this.populateStats();
        this.setupJoystick();
        
        document.getElementById('btn-auto').addEventListener('click', () => {
            Game.player.autoAttack = !Game.player.autoAttack;
            document.getElementById('auto-status').innerText = Game.player.autoAttack ? "ON" : "OFF";
            document.getElementById('btn-auto').style.borderColor = Game.player.autoAttack ? "#0f0" : "#b89947";
        });

        // Trigger action-based attack animation
        document.getElementById('btn-attack').addEventListener('pointerdown', () => {
            Game.player.forceAttack();
        });
    },

    setupJoystick() {
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');
        let rect = base.getBoundingClientRect();
        let maxRadius = rect.width / 2;
        let pointerId = null;

        const updateKnob = (clientX, clientY) => {
            rect = base.getBoundingClientRect();
            const centerX = rect.left + maxRadius;
            const centerY = rect.top + maxRadius;
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > maxRadius) {
                dx = (dx / distance) * maxRadius;
                dy = (dy / distance) * maxRadius;
            }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            this.joystick.vector.x = dx / maxRadius;
            this.joystick.vector.y = dy / maxRadius;
        };

        base.addEventListener('pointerdown', (e) => {
            pointerId = e.pointerId; this.joystick.active = true;
            updateKnob(e.clientX, e.clientY); base.setPointerCapture(pointerId);
        });
        base.addEventListener('pointermove', (e) => {
            if (this.joystick.active && e.pointerId === pointerId) updateKnob(e.clientX, e.clientY);
        });

        const resetJoy = (e) => {
            if (e.pointerId === pointerId) {
                this.joystick.active = false; this.joystick.vector = { x: 0, y: 0 };
                knob.style.transform = `translate(-50%, -50%)`;
                base.releasePointerCapture(pointerId); pointerId = null;
            }
        };

        base.addEventListener('pointerup', resetJoy);
        base.addEventListener('pointercancel', resetJoy);
    },

    toggleModal(id) { document.getElementById(id).classList.toggle('hidden'); },
    updatePlayerStats(player) {
        document.getElementById('hp-fill').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
        document.getElementById('hp-text').innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
        document.getElementById('quest-count').innerText = Game.kills;
    },
    populateInventory() {
        const grid = document.getElementById('inv-grid');
        for (let i = 0; i < 40; i++) { grid.appendChild(Object.assign(document.createElement('div'), {className: 'inv-slot'})); }
    },
    populateStats() {
        const stats = { "ATK": 1420, "DEF": 850, "Max HP": 1000, "Crit Rate": "15%" };
        for (const [k, v] of Object.entries(stats)) document.getElementById('stats-list').innerHTML += `<div class="stat-row"><span>${k}</span><span style="color:#fff">${v}</span></div>`;
    }
};

window.addEventListener('DOMContentLoaded', () => UI.init());

const UI = {
    init() {
        this.populateInventory();
        this.populateStats();
        
        document.getElementById('btn-auto').addEventListener('click', () => {
            Game.player.autoAttack = !Game.player.autoAttack;
            document.getElementById('auto-status').innerText = Game.player.autoAttack ? "ON" : "OFF";
            document.getElementById('btn-auto').style.borderColor = Game.player.autoAttack ? "#0f0" : "#b89947";
        });
    },

    toggleModal(id) {
        const modal = document.getElementById(id);
        modal.classList.toggle('hidden');
    },

    updatePlayerStats(player) {
        // Update HP
        const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
        document.getElementById('hp-fill').style.width = hpPercent + '%';
        document.getElementById('hp-text').innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
        
        // Quest Tracker update logic
        document.getElementById('quest-count').innerText = Game.kills;
    },

    populateInventory() {
        const grid = document.getElementById('inv-grid');
        for (let i = 0; i < 40; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            // Simulate items in first few slots
            if (i < 8) slot.innerHTML = `<img src="assets/item_gear_${i%3}.png" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`;
            grid.appendChild(slot);
        }
    },

    populateStats() {
        const statsList = document.getElementById('stats-list');
        const stats = { "ATK": 1420, "DEF": 850, "Max HP": 1000, "Crit Rate": "15%", "ATK Speed": "22%", "Movement Speed": "12%" };
        
        for (const [key, value] of Object.entries(stats)) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `<span>${key}</span><span style="color:#fff">${value}</span>`;
            statsList.appendChild(row);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => UI.init());

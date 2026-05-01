/**
 * Realms System Module
 * Handles realm difficulty scaling and boss battle states.
 */

const Realms = {
    currentRealm: 0,
    list: [
        { name: "Whispering Meadows", difficulty: 1.0, color: "#2ecc71" },
        { name: "Scorched Barrens", difficulty: 1.1, color: "#e67e22" },
        { name: "Frozen Tundra", difficulty: 1.2, color: "#3498db" },
        { name: "Abyssal Rift", difficulty: 1.3, color: "#9b59b6" },
        { name: "Eldritch Peaks", difficulty: 1.4, color: "#e74c3c" }
    ],

    globalDifficultyMultiplier: 1.0,

    getMultiplier() {
        return this.list[this.currentRealm].difficulty * this.globalDifficultyMultiplier;
    },

    setRealm(index) {
        if (index >= 0 && index < this.list.length) {
            const realm = this.list[index];
            
            // Trigger Loading Screen
            const loader = document.getElementById('loading-overlay');
            const realmNameTxt = document.getElementById('loading-realm-name');
            if (loader) {
                loader.classList.remove('hidden');
                if (realmNameTxt) realmNameTxt.innerText = realm.name;
                
                // Close Map Modal
                if (window.UI) UI.toggleModal('map-modal');
            }

            setTimeout(() => {
                this.currentRealm = index;
                if (window.Game) {
                    Game.exitBossArena(); // Ensure boss is cleaned up when switching realms
                    Game.clearEnemies();
                    
                    // Reset Player targeting/pathing
                    if (Game.player) {
                        Game.player.target = null;
                        Game.player.path = null;
                        Game.player.autoQuest = false; // Reset auto-quest to avoid glitchy movement
                    }
                    
                    Game.showNotification(`Entered ${realm.name}`, realm.color);
                }

                // Hide Loading Screen
                if (loader) loader.classList.add('hidden');
                if (window.UI) UI.updateMapModal();
            }, 2000);
        }
    }
};

window.Realms = Realms;

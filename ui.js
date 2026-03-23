// ui.js
class UI {
    static toggleInventory() {
        // Logic to toggle inventory modal
        document.getElementById("inventory-modal").style.display = document.getElementById("inventory-modal").style.display === "none" ? "flex" : "none";
    }

    static claimDaily() {
        // Logic to claim daily reward
        console.log("Claiming daily reward...");
        // Update gold and shards display
        const currentGold = parseInt(document.getElementById("c-gold").innerText, 10) || 0;
        const currentShard = parseInt(document.getElementById("c-shard").innerText, 10) || 0;
        document.getElementById("c-gold").innerText = currentGold + 500;
        document.getElementById("c-shard").innerText = currentShard + 50;
        // Hide daily login modal
        document.getElementById("daily-login").style.display = "none";
    }
}
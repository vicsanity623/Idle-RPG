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
        document.getElementById("c-gold").innerText = parseInt(document.getElementById("c-gold").innerText) + 500;
        document.getElementById("c-shard").innerText = parseInt(document.getElementById("c-shard").innerText) + 50;
        // Hide daily login modal
        document.getElementById("daily-login").style.display = "none";
    }
}
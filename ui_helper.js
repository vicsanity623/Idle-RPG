// ui_helper.js
class UIHelper {
    constructor() {}

    static toggleInventory() {
        // Logic for toggling inventory modal
        document.getElementById("inventory-modal").style.display = document.getElementById("inventory-modal").style.display === "block" ? "none" : "block";
    }

    static claimDaily() {
        // Logic for claiming daily rewards
        // Example: Update gold and shards display
        document.getElementById("c-gold").innerText = parseInt(document.getElementById("c-gold").innerText) + 500;
        document.getElementById("c-shard").innerText = parseInt(document.getElementById("c-shard").innerText) + 50;
        // Hide daily login popup
        document.getElementById("daily-login").style.display = "none";
    }
}
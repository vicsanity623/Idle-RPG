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

    static upgradeClickPower() {
        const currentGoldElement = document.getElementById("c-gold");
        const currentClickPowerElement = document.getElementById("c-click-power");
        const currentClickPowerLevelElement = document.getElementById("c-click-power-level");
        const nextClickPowerCostElement = document.getElementById("c-click-power-cost");

        let currentGold = parseInt(currentGoldElement.innerText);
        let currentClickPowerLevel = parseInt(currentClickPowerLevelElement.innerText);
        let currentClickPower = parseInt(currentClickPowerElement.innerText);

        const baseCost = 100; // Initial cost for Level 1
        const costMultiplier = 1.5; // Cost increases by 50% each level
        const clickPowerIncreasePerLevel = 1; // How much click power increases per level

        // Calculate cost for the NEXT level based on current level
        const upgradeCost = Math.floor(baseCost * Math.pow(costMultiplier, currentClickPowerLevel));

        if (currentGold >= upgradeCost) {
            // Deduct gold
            currentGold -= upgradeCost;
            currentGoldElement.innerText = currentGold;

            // Increase click power level and actual click power
            currentClickPowerLevel += 1;
            currentClickPower += clickPowerIncreasePerLevel;

            // Update UI for current stats
            currentClickPowerLevelElement.innerText = currentClickPowerLevel;
            currentClickPowerElement.innerText = currentClickPower;

            // Calculate and update next upgrade cost display
            const newUpgradeCost = Math.floor(baseCost * Math.pow(costMultiplier, currentClickPowerLevel));
            nextClickPowerCostElement.innerText = newUpgradeCost;

            console.log(`Click Power upgraded to Level ${currentClickPowerLevel}! Current Power: ${currentClickPower}`);
        } else {
            console.log("Not enough gold to upgrade Click Power! Required: " + upgradeCost + ", Have: " + currentGold);
            // Future improvement: Display a temporary "Not enough gold!" message in the UI
        }
    }
}
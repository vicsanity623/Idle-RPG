class InventoryManager {
    constructor() {
        this.inventory = [];
        this.equippedItems = {};
    }

// Method to add an item to the inventory
addItem(item) {
    if (this.equippedItems[item.name]) {
        console.log(`Item ${item.name} is already equipped.`);
    } else {
        this.inventory.push(item);
        this.updateInventoryDisplay();
    }
}

// Method to remove an item from the inventory
removeItem(item) {
    const index = this.inventory.indexOf(item);
    if (index > -1) {
        if (this.equippedItems[item.name]) {
            console.log(`Item ${item.name} is equipped. Unequip it first.`);
        } else {
            this.inventory.splice(index, 1);
            this.updateInventoryDisplay();
        }
    }
}

    // Method to equip an item
    equipItem(item, slot) {
        this.equippedItems[slot] = item;
        this.updateEquippedItemsDisplay();
    }

    // Method to unequip an item
    unequipItem(slot) {
        delete this.equippedItems[slot];
        this.updateEquippedItemsDisplay();
    }

    // Method to update the inventory display
    updateInventoryDisplay() {
        const inventoryGrid = document.getElementById('inv-grid');
        // Logic to update the inventory grid display
    }

    // Method to update the equipped items display
    updateEquippedItemsDisplay() {
        const equipmentGrid = document.querySelector('.equipment-grid');
        // Logic to update the equipment grid display
    }
}

// Export the InventoryManager class
export default InventoryManager;
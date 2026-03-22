class InventoryManager {
    constructor() {
        this.inventoryModal = document.getElementById('inventory-modal');
        this.gearGrid = document.getElementById('gear-grid');
        this.talentGrid = document.getElementById('talent-grid');
        // Initialize inventory and talent data structures here
    }

    toggleInventory() {
        this.inventoryModal.style.display = this.inventoryModal.style.display === 'block' ? 'none' : 'block';
    }

    updateGearGrid(gearItems) {
        // Logic to update the gear grid with the provided gear items
        this.gearGrid.innerHTML = '';
        gearItems.forEach(item => {
            const gearItemElement = document.createElement('div');
            gearItemElement.classList.add('gear-item');
            gearItemElement.innerHTML = `
                <h4>${item.name}</h4>
                <p>${item.description}</p>
            `;
            this.gearGrid.appendChild(gearItemElement);
        });
    }

    updateTalentGrid(talentNodes) {
        // Logic to update the talent grid with the provided talent nodes
        this.talentGrid.innerHTML = '';
        talentNodes.forEach(node => {
            const talentNodeElement = document.createElement('div');
            talentNodeElement.classList.add('talent-node');
            if (node.locked) {
                talentNodeElement.classList.add('locked');
            }
            talentNodeElement.innerHTML = `
                <h4>${node.name}</h4>
                <p>${node.description}</p>
                <button class="unlock-btn" ${node.locked ? '' : 'disabled'}>Unlock (${node.cost} SP)</button>
                <button class="upgrade-btn" ${node.upgraded ? 'disabled' : ''}>Upgrade (${node.upgradeCost} SP)</button>
            `;
            this.talentGrid.appendChild(talentNodeElement);
        });
    }
}

// Example usage
const inventoryManager = new InventoryManager();
// Call functions like inventoryManager.toggleInventory(), inventoryManager.updateGearGrid(), etc., as needed
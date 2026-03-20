// Inventory management and related UI components
class Inventory {
    constructor() {
        this.inventoryModal = document.getElementById('inventory-modal');
        this.characterTabContent = document.getElementById('character-tab-content');
        this.skillsTabContent = document.getElementById('skills-tab-content');
        this.statsSheet = document.getElementById('stats-sheet');
        this.gearGrid = document.getElementById('gear-grid');
        this.skillTreeGrid = document.getElementById('skill-tree-grid');
    }

    toggleInventory() {
        this.inventoryModal.style.display = this.inventoryModal.style.display === 'block' ? 'none' : 'block';
    }

    showInventoryTab(tab) {
        if (tab === 'character') {
            this.characterTabContent.style.display = 'block';
            this.skillsTabContent.style.display = 'none';
            document.getElementById('inv-tab-character').classList.add('active');
            document.getElementById('inv-tab-skills').classList.remove('active');
        } else if (tab === 'skills') {
            this.characterTabContent.style.display = 'none';
            this.skillsTabContent.style.display = 'block';
            document.getElementById('inv-tab-character').classList.remove('active');
            document.getElementById('inv-tab-skills').classList.add('active');
        }
    }

    upgradeSkill(skillId) {
        // Logic to upgrade the skill
        console.log(`Upgrading skill ${skillId}`);
    }

    claimDaily() {
        // Logic to claim daily rewards
        console.log('Claiming daily rewards');
    }
}

const UI = new Inventory();
// UI interaction logic for inventory and skill previews.

// Handling inventory modal interactions
const UI = {
    showInventoryTab(tab) {
        // Show the appropriate inventory tab and hide others
        const tabs = document.querySelectorAll('.modal-tab');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.style.display = 'none');
        
        document.getElementById(`inv-tab-${tab}`).classList.add('active');
        document.getElementById(`${tab}-tab-content`).style.display = 'block';
        
        // Update skill points display
        document.getElementById('skill-points-display').textContent = this.getPlayerSkillPoints();
    },
    
    toggleInventory() {
        const modal = document.getElementById('inventory-modal');
        const uiLayer = document.getElementById('ui-layer');
        
        modal.classList.toggle('hidden');
        uiLayer.classList.toggle('hidden');
    },
    
    displaySkillPreview(skillId) {
        const previewPanel = document.getElementById('skill-preview-panel');
        previewPanel.style.display = 'block';
        
        // Logic for displaying current vs projected stats
        document.getElementById('skill-preview-current-stats').textContent = 'Current Stats...'; // Placeholder for actual current stats
        const projectedChanges = player.getProjectedStats(skillId); // Assuming player is globally available and returns { health: percentage, damage: percentage }
        const health = projectedChanges?.health ?? 0;
        const damage = projectedChanges?.damage ?? 0;
        document.getElementById('skill-preview-projected-stats').textContent = `Projected Stats (+${health}% health, +${damage}% damage)`;
    },
    
    hideSkillPreview() {
        document.getElementById('skill-preview-panel').style.display = 'none';
    },
    
    // Dummy function for demonstration
    getPlayerSkillPoints() {
        // This would connect to a function retrieving the current player's skill points
        return 5;
    }
    
    // Add functions for upgrading skills, toggling notifications, etc.
};
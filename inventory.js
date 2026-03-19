// Inventory management and related UI components
class Inventory {
    constructor() {
        this.inventoryModal = document.getElementById('inventory-modal');
        this.characterTabContent = document.getElementById('character-tab-content');
        this.skillsTabContent = document.getElementById('skills-tab-content');
        this.statsSheet = document.getElementById('stats-sheet');
        this.gearGrid = document.getElementById('gear-grid');
        this.skillTreeGrid = document.getElementById('skill-tree-grid');
        // NEW: UI elements for the skill preview panel
        this.skillPreviewPanel = document.getElementById('skill-preview-panel'); // Assumed new div in index.html
        this.skillPreviewName = document.getElementById('skill-preview-name');
        this.skillPreviewDescription = document.getElementById('skill-preview-description');
        this.skillPreviewCost = document.getElementById('skill-preview-cost');
        this.skillPreviewStats = document.getElementById('skill-preview-stats');
        this.skillUpgradeButton = document.getElementById('skill-upgrade-button'); // Button within the preview panel

        // NEW: UI elements for skill simulation
        this.skillSimulation = document.getElementById('skill-simulation');
        this.simulationArea = document.getElementById('simulation-area');
        this.dummyStats = document.getElementById('dummy-stats');
        this.playerStats = document.getElementById('player-stats');
        this.combatLog = document.getElementById('combat-log');
        this.simulationControls = document.getElementById('simulation-controls');
        this.startSimulationButton = document.getElementById('start-simulation');
        this.pauseSimulationButton = document.getElementById('pause-simulation');
        this.resetSimulationButton = document.getElementById('reset-simulation');
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
            // Ensure skill tree is rendered/updated when the skills tab is shown
            // Assumes 'player' object is accessible or passed from main.js
            // For now, we'll assume 'player' is globally accessible or passed from main.js
            // A more robust solution would pass player as an argument to showInventoryTab
            if (window.player) { // Using window.player as a temporary global access point
                this.renderSkillTree(window.player);
            }
        }
    }

    /**
     * NEW FEATURE: Upgrades a skill and updates player stats and UI.
     * @param {string} skillId - The ID of the skill to upgrade.
     * @param {object} player - The player object, assumed to have skill-related methods.
     */
    upgradeSkill(skillId, player) {
        if (player.canUpgradeSkill(skillId)) {
            player.upgradeSkill(skillId); // Updates player's skill levels and deducts cost
            player.applySkillEffects(); // Re-applies all skill effects to update player's derived stats
            console.log(`Upgraded skill ${skillId}. Player stats updated.`);
            this.updateSkillNodeVisual(skillId, player); // Update the visual state of the skill node
            this.displaySkillPreview(skillId, player); // Refresh preview for the upgraded skill
            // Optionally, update the main stats sheet if visible
            // UI.updateStatsSheet(player); // This would be a call to a global UI instance
        } else {
            console.log(`Cannot upgrade skill ${skillId}. Not enough points or max level.`);
            // Provide UI feedback to the user (e.g., a temporary message or visual cue)
        }
    }

    /**
     * NEW FEATURE: Displays detailed skill information and projected stat changes in a preview panel.
     * This method is called on mouseover of a skill node.
     * @param {string} skillId - The ID of the skill to preview.
     * @param {object} player - The player object, assumed to have skill-related methods.
     */
    displaySkillPreview(skillId, player) {
        const skill = player.getSkillDetails(skillId); // Hypothetical method on player to get skill data
        if (!skill) {
            this.hideSkillPreview();
            return;
        }

        this.skillPreviewName.textContent = skill.name;
        this.skillPreviewDescription.textContent = skill.description;
        this.skillPreviewCost.textContent = `Cost: ${skill.cost} Skill Points`;

        // Get projected stat changes from the player object
        const projectedStats = player.getSkillUpgradePreview(skillId); // Hypothetical method on player
        let statsHtml = '<h4>Projected Stat Changes:</h4>';
        if (Object.keys(projectedStats).length > 0) {
            for (const stat in projectedStats) {
                statsHtml += `<p>${stat}: +${projectedStats[stat]}</p>`;
            }
        } else {
            statsHtml += '<p>No direct stat changes or already max level.</p>';
        }
        this.skillPreviewStats.innerHTML = statsHtml;

        // Attach click listener to the upgrade button in the preview panel
        // Remove previous listener to prevent multiple bindings if preview changes
        this.skillUpgradeButton.onclick = null;
        this.skillUpgradeButton.onclick = () => this.upgradeSkill(skillId, player);
        this.skillUpgradeButton.disabled = !player.canUpgradeSkill(skillId); // Disable if not upgradable

        this.skillPreviewPanel.style.display = 'block';
    }

    /**
     * NEW FEATURE: Hides the skill preview panel.
     * This method is called on mouseout of a skill node.
     */
    hideSkillPreview() {
        this.skillPreviewPanel.style.display = 'none';
        this.skillUpgradeButton.onclick = null; // Clear listener to prevent memory leaks
    }

    /**
     * NEW FEATURE: Updates the visual state of a skill node after an action (e.g., upgrade).
     * @param {string} skillId - The ID of the skill node to update.
     * @param {object} player - The player object to check skill status.
     */
    updateSkillNodeVisual(skillId, player) {
        const skillNode = this.skillTreeGrid.querySelector(`[data-skill-id="${skillId}"]`);
        if (skillNode) {
            skillNode.classList.remove('upgradable', 'unlocked', 'max-level'); // Clear previous states
            if (player.hasSkill(skillId)) {
                skillNode.classList.add('unlocked');
            }
            if (player.canUpgradeSkill(skillId)) {
                skillNode.classList.add('upgradable');
            } else {
                const skillDetails = player.getSkillDetails(skillId);
                if (skillDetails?.level === skillDetails?.maxLevel) {
                    skillNode.classList.add('max-level');
                }
            }
            // Example: Change border color for upgraded skills
            // skillNode.style.borderColor = 'gold';
        }
    }

    /**
     * NEW FEATURE: Renders the skill tree grid with interactive nodes.
     * This method should be called when the skills tab is opened or game initializes.
     * @param {object} player - The player object, used to determine skill states.
     */
    renderSkillTree(player) {
        this.skillTreeGrid.innerHTML = ''; // Clear existing nodes
        const skills = player.getAvailableSkills(); // Hypothetical method to get all skills relevant to player
        skills.forEach(skill => {
            const skillNode = document.createElement('div');
            skillNode.classList.add('skill-node');
            skillNode.dataset.skillId = skill.id;
            skillNode.textContent = skill.name;

            // Apply initial visual states
            this.updateSkillNodeVisual(skill.id, player);

            // Attach event listeners for preview interaction
            skillNode.addEventListener('mouseover', () => this.displaySkillPreview(skill.id, player));
            skillNode.addEventListener('mouseout', () => this.hideSkillPreview());
            // Clicking the node itself could also trigger the preview, or directly upgrade if no preview is needed.
            // For this feature, the upgrade button in the preview panel handles the click.

            this.skillTreeGrid.appendChild(skillNode);
        });
    }

    claimDaily() {
        // Logic to claim daily rewards
        console.log('Claiming daily rewards');
    }
}

const UI = new Inventory();
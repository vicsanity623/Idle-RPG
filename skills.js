/**
 * skills.js
 * Module to manage game skills and their interactions.
 */

// Define Skill Tree structure
const SKILLS = {
    'HP_BOOST_1': {
        id: 'HP_BOOST_1',
        name: 'Vitality Training',
        description: 'Increases maximum HP by 20 per level.',
        maxLevel: 5,
        cost: (level) => 1 + level, // Cost in skill points
        effect: (level) => ({ hp: level * 20 }),
        prerequisites: [],
        position: { x: 0, y: 0 } // For potential visual tree layout
    },
    'ATK_BOOST_1': {
        id: 'ATK_BOOST_1',
        name: 'Combat Prowess',
        description: 'Increases base attack power by 5 per level.',
        maxLevel: 5,
        cost: (level) => 1 + level,
        effect: (level) => ({ atk: level * 5 }),
        prerequisites: [],
        position: { x: 1, y: 0 }
    },
    'CRIT_CHANCE_1': {
        id: 'CRIT_CHANCE_1',
        name: 'Precision Strike',
        description: 'Increases critical hit chance by 1% per level.',
        maxLevel: 3,
        cost: (level) => 2 + level,
        effect: (level) => ({ critChance: level * 1 }),
        prerequisites: ['ATK_BOOST_1'], // Requires ATK_BOOST_1 at any level
        position: { x: 2, y: 0 }
    },
    'REGEN_BOOST_1': {
        id: 'REGEN_BOOST_1',
        name: 'Rapid Recovery',
        description: 'Increases HP regeneration by 0.2 per second per level.',
        maxLevel: 3,
        cost: (level) => 2 + level,
        effect: (level) => ({ regen: level * 0.2 }),
        prerequisites: ['HP_BOOST_1'],
        position: { x: 0, y: 1 }
    }
    // Add more skills here
};

// Method to render the skill tree in the UI
export const renderSkills = (player) => {
    const skillTreeContainer = document.getElementById('skills-grid');
    skillTreeContainer.innerHTML = ''; // Clear previous skills

    const skillPointsDisplay = document.getElementById('skill-points-display');
    if (skillPointsDisplay) {
        skillPointsDisplay.innerText = player.skillPoints;
    }

    Object.values(SKILLS).forEach(skill => {
        const currentLevel = player.learnedSkills[skill.id] || 0;
        const nextLevel = currentLevel + 1;
        const cost = skill.cost(currentLevel);
        const canAfford = player.skillPoints >= cost;
        const isMaxLevel = currentLevel >= skill.maxLevel;

        // Check prerequisites
        const hasPrerequisites = skill.prerequisites.every(prereqId => player.learnedSkills[prereqId] > 0);
        const canUpgrade = canAfford && !isMaxLevel && hasPrerequisites;

        let effectText = '';
        if (skill.effect) {
            const currentEffect = skill.effect(currentLevel);
            const nextEffect = skill.effect(nextLevel);
            for (const key in nextEffect) {
                const currentVal = currentEffect[key] || 0;
                const incrementalVal = nextEffect[key] - currentVal;
                effectText += `${key.toUpperCase()}: +${incrementalVal} `;
            }
        }

        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-node';
        if (isMaxLevel) skillDiv.classList.add('max-level');
        else if (currentLevel > 0) skillDiv.classList.add('learned');
        if (!hasPrerequisites) skillDiv.classList.add('locked');

        skillDiv.innerHTML = `
            <h4 style="color:var(--primary)">${skill.name}</h4>
            <p>${skill.description}</p>
            <p>Level: ${currentLevel} / ${skill.maxLevel}</p>
            <p style="font-size:0.7rem; color:#03dac6; min-height:20px;">${effectText}</p>
            <button class="upgrade-btn" ${!canUpgrade ? 'disabled' : ''} onclick="handleUpgradeSkill('${skill.id}')">
                ${isMaxLevel ? 'MAX LEVEL' : `Upgrade (${cost} SP)`}
            </button>
            ${!hasPrerequisites && !isMaxLevel ? `<p class="prereq-text">Requires: ${skill.prerequisites.map(id => SKILLS[id].name).join(', ')}</p>` : ''}
        `;
        skillTreeContainer.appendChild(skillDiv);
    });
};

// Method to handle skill upgrades
export const upgradeSkill = (skillId, player, playerData, saveGame, uiNotify) => {
    const skill = SKILLS[skillId];
    if (!skill) {
        uiNotify("Skill not found!");
        return;
    }

    const currentLevel = player.learnedSkills[skillId] || 0;
    const nextLevel = currentLevel + 1;
    const cost = skill.cost(currentLevel);

    // Check prerequisites
    const hasPrerequisites = skill.prerequisites.every(prereqId => player.learnedSkills[prereqId] > 0);

    if (currentLevel >= skill.maxLevel) {
        uiNotify(`${skill.name} is already at max level!`);
        return;
    }
    if (player.skillPoints < cost) {
        uiNotify("Not enough Skill Points!");
        return;
    }
    if (!hasPrerequisites) {
        uiNotify(`Requires: ${skill.prerequisites.map(id => SKILLS[id].name).join(', ')}`);
        return;
    }

    player.skillPoints -= cost;
    player.learnedSkills[skillId] = nextLevel;

    player.applySkillEffects(); // Re-apply all skill effects to update player stats
    renderSkills(player); // Re-render the skill tree to update button states
    saveGame();
    uiNotify(`${skill.name} upgraded to Level ${nextLevel}!`);
};
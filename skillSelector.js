/**
 * skillSelector.js
 * Manages Interactive Skill Rotation, Selection, and Preview Feature.
 */

// Placeholder for skill data structure that holds available and active skills
let availableSkills = [
    // These would be filled based on player progress, game unlock systems
    'hp_mastery', 'atk_boost', 'def_training', 'regen_aura', 
    'crit_focus', 'crit_power', 'swift_strikes'
];

let activeSkillSlots = []; // Currently selected active skills

// function to simulate moving a skill from available to active slot
function moveSkillToSlot(skillId) {
    if(availableSkills.includes(skillId) && activeSkillSlots.length < 5) {
        availableSkills = availableSkills.filter(skill => skill !== skillId);
        activeSkillSlots.push(skillId);
        updateSkillTreeUI();
    }
}

// function to simulate moving a skill from active slot back to available
function moveSkillFromSlot(skillId) {
    if(activeSkillSlots.includes(skillId)) {
        availableSkills.push(skillId);
        activeSkillSlots = activeSkillSlots.filter(skill => skill !== skillId);
        updateSkillTreeUI();
    }
}

function updateSkillTreeUI() {
    // Assuming there are HTML elements with classes 'available-skills' and 'active-skills' 
    const availableSkillsElement = document.querySelector('.available-skills');
    const activeSkillSlotsElement = document.querySelector('.active-skills');

    availableSkillsElement.innerHTML = '';
    activeSkillSlotsElement.innerHTML = '';

    availableSkills.forEach(skillId => {
        const skillElement = document.createElement('div');
        skillElement.classList.add('skill');
        skillElement.setAttribute('draggable', true);
        skillElement.innerText = skillId;
        skillElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', skillId);
        });
        availableSkillsElement.appendChild(skillElement);
    });

    activeSkillSlots.forEach(slot => {
        const skillElement = document.createElement('div');
        skillElement.classList.add('skill');
        skillElement.setAttribute('draggable', true);
        skillElement.innerText = slot;
        skillElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', slot);
        });
        skillElement.addEventListener('dragend', (e) => {
            const target = e.target.parentNode;
            if (target.classList.contains('available-skills')) {
                moveSkillToSlot(slot);
            } else if (target.classList.contains('active-skills')) {
                moveSkillFromSlot(slot);
            }
        });
        activeSkillSlotsElement.appendChild(skillElement);
    });
}

// Call this method to initialize the skill rotation interface
function initSkillRotationUI() {
    const availableSkillsElement = document.querySelector('.available-skills');
    const activeSkillSlotsElement = document.querySelector('.active-skills');

    availableSkillsElement.addEventListener('dragover', (e) => e.preventDefault());
    availableSkillsElement.addEventListener('drop', (e) => {
        e.preventDefault();
        const skillId = e.dataTransfer.getData('text/plain');
        moveSkillToSlot(skillId);
    });

    activeSkillSlotsElement.addEventListener('dragover', (e) => e.preventDefault());
    activeSkillSlotsElement.addEventListener('drop', (e) => {
        e.preventDefault();
        const skillId = e.dataTransfer.getData('text/plain');
        moveSkillFromSlot(skillId);
    });

    updateSkillTreeUI();
}

module.exports = {
    initSkillRotationUI,
};
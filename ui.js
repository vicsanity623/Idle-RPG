const UI = {
    // Shared joystick data for entities.js
    joystick: { active: false, vector: { x: 0, y: 0 } },

    init() {
        this.setupJoystick();
        
        // Setup Attack Button (Action Bar)
        const atkBtn = document.getElementById('btn-attack');
        if (atkBtn) {
            atkBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (Game.player) Game.player.forceAttack();
            });
        }

        // Note: Inventory tabs and Auto-Quest buttons are now handled 
        // via 'onclick' attributes in the HTML and logic in engine.js
    },

    // Handles the virtual joystick for mobile movement
    setupJoystick() {
const base = document.getElementById('joystick-base');
const knob = document.getElementById('joystick-knob');
if (!base || !knob) {
  console.error('Joystick elements not found');
  return;
}

        let rect = base.getBoundingClientRect();
        let maxRadius = rect.width / 2;
        let pointerId = null;

        const updateKnob = (clientX, clientY) => {
            rect = base.getBoundingClientRect();
            const centerX = rect.left + maxRadius;
            const centerY = rect.top + maxRadius;
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > maxRadius) {
                dx = (dx / distance) * maxRadius;
                dy = (dy / distance) * maxRadius;
            }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            this.joystick.vector.x = dx / maxRadius;
            this.joystick.vector.y = dy / maxRadius;
        };

        base.addEventListener('pointerdown', (e) => {
            pointerId = e.pointerId; 
            this.joystick.active = true;
            updateKnob(e.clientX, e.clientY); 
            base.setPointerCapture(pointerId);
        });

        base.addEventListener('pointermove', (e) => {
            if (this.joystick.active && e.pointerId === pointerId) {
                updateKnob(e.clientX, e.clientY);
            }
        });

        const resetJoy = (e) => {
            if (e.pointerId === pointerId) {
                this.joystick.active = false; 
                this.joystick.vector = { x: 0, y: 0 };
                knob.style.transform = `translate(-50%, -50%)`;
                base.releasePointerCapture(pointerId); 
                pointerId = null;
            }
        };

        base.addEventListener('pointerup', resetJoy);
        base.addEventListener('pointercancel', resetJoy);
    },

    // Toggles visibility for Inventory, Stats, and Skills modals
    toggleModal(id) { 
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.toggle('hidden'); 
            // If opening inventory, refresh it to show current items
            if (id === 'inventory-modal' && !modal.classList.contains('hidden')) {
                if (typeof this.updateInventory === 'function') {
                    this.updateInventory(Game.player);
                }
            }
        }
    }
};

// Start UI logic when page loads
window.addEventListener('DOMContentLoaded', () => UI.init());
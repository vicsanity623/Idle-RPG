/**
 * UI Manager
 * Standards: ES6+, DOM Safety, High-Performance Event Handling
 */

const UI = {
    // State
    joystick: { 
        active: false, 
        vector: { x: 0, y: 0 } 
    },

    init() {
        this.setupJoystick();
        this.bindEvents();
        this.populateInventoryPlaceholder(); // Sets up grid before Game data loads
    },

    bindEvents() {
        // --- Auto Attack Toggle ---
        const btnAuto = document.getElementById('btn-auto');
        const autoStatus = document.getElementById('auto-status');
        
        if (btnAuto) {
            btnAuto.addEventListener('click', () => {
                if (!window.Game || !Game.player) return; // Engine safety check
                
                Game.player.autoAttack = !Game.player.autoAttack;
                if (autoStatus) {
                    autoStatus.innerText = Game.player.autoAttack ? "ON" : "OFF";
                }
                btnAuto.style.borderColor = Game.player.autoAttack ? "#0f0" : "#b89947";
            });
        }

        // --- Manual Attack Trigger ---
        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            btnAttack.addEventListener('pointerdown', (e) => {
                e.preventDefault(); // Prevents ghost clicks
                if (window.Game && Game.player && Game.player.forceAttack) {
                    Game.player.forceAttack();
                }
            });
        }
    },

    setupJoystick() {
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');
        
        // Safety check: Don't break if joystick isn't in the HTML
        if (!base || !knob) return; 

        // Prevent browser scrolling/zooming when dragging the joystick
        base.style.touchAction = 'none';

        let rect, maxRadius, centerX, centerY;
        let pointerId = null;

        // Optimization: Cache dimensions to prevent layout thrashing on pointermove
        const cacheDimensions = () => {
            rect = base.getBoundingClientRect();
            maxRadius = rect.width / 2;
            centerX = rect.left + maxRadius;
            centerY = rect.top + maxRadius;
        };

        const updateKnob = (clientX, clientY) => {
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const distance = Math.hypot(dx, dy); // Cleaner math

            // Clamp knob to the base boundary
            if (distance > maxRadius) {
                dx = (dx / distance) * maxRadius;
                dy = (dy / distance) * maxRadius;
            }
            
            // Move knob via hardware-accelerated CSS
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            
            // Normalize Output Vector (-1.0 to 1.0)
            this.joystick.vector.x = dx / maxRadius;
            this.joystick.vector.y = dy / maxRadius;
        };

        // --- Event Listeners ---
        base.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pointerId = e.pointerId; 
            this.joystick.active = true;
            cacheDimensions(); // Recalculate only when touched
            updateKnob(e.clientX, e.clientY); 
            base.setPointerCapture(pointerId);
        });

        base.addEventListener('pointermove', (e) => {
            if (this.joystick.active && e.pointerId === pointerId) {
                // Using requestAnimationFrame ensures it only updates as fast as the screen refreshes
                requestAnimationFrame(() => updateKnob(e.clientX, e.clientY));
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
        
        // Handle window resize updating joystick position
        window.addEventListener('resize', () => {
            if (this.joystick.active) cacheDimensions();
        });
    },

    toggleModal(id) { 
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.toggle('hidden'); 
        } else {
            console.warn(`UI: Modal with id '${id}' not found.`);
        }
    },

    // Note: This acts as a fallback/base. In engine.js, you overwrite this with more complex logic.
    updatePlayerStats(player) {
        if (!player) return;

        const hpFill = document.getElementById('hp-fill');
        const hpText = document.getElementById('hp-text');
        const questCount = document.getElementById('quest-count');

        if (hpFill) hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
        if (hpText) hpText.innerText = `${Math.floor(player.hp)} / ${player.maxHp}`;
        if (questCount && window.Game) questCount.innerText = Game.kills || 0;
    },

    populateInventoryPlaceholder() {
        const grid = document.getElementById('inv-grid');
        if (!grid) return;
        
        grid.innerHTML = ''; // Clear out any garbage
        
        // Draw 40 empty slots as baseline UI
        const fragment = document.createDocumentFragment(); // Optimization: Build grid in memory
        for (let i = 0; i < 40; i++) { 
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            fragment.appendChild(slot);
        }
        grid.appendChild(fragment); // Single DOM insertion
    }
};

// Wait for the DOM to be fully loaded before initializing
window.addEventListener('DOMContentLoaded', () => UI.init());

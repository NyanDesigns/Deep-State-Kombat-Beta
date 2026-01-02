import * as THREE from 'three';

/**
 * InputController - Handles all player input processing
 * Extracted from Fighter.updateInput() to separate concerns
 */
export class InputController {
    constructor() {
        // Input state tracking
        this.lastProcessedInput = null;
    }

    /**
     * Process input and return action commands
     * @param {number} dt - Delta time
     * @param {object} keys - Keyboard state object
     * @param {object} inputHandler - InputHandler instance (for edge detection)
     * @param {string} characterState - Current character state
     * @param {THREE.Quaternion} characterQuaternion - Character's rotation
     * @param {number} moveSpeed - Character's movement speed
     * @returns {object} Input result { movement, attack, jump, crouch, moveDirection }
     */
    processInput(dt, keys, inputHandler, characterState, characterQuaternion, moveSpeed) {
        const result = {
            movement: new THREE.Vector3(0, 0, 0),
            attack: null,
            jump: false,
            crouch: false,
            moveDirection: 0
        };

        // Handle crouch state exits (temporarily disabled but keep logic)
        if (characterState === 'CROUCH') {
            result.crouch = 'exit'; // Signal to exit crouch
            return result;
        }
        
        if (characterState === 'CROUCH_EXITING') {
            // While exiting crouch, can't move or attack
            return result;
        }

        // Attack controls - use edge-triggered input
        if (inputHandler) {
            // Use edge-triggered input detection (consumes key press, prevents multiple triggers)
            if (inputHandler.consumeKey('ArrowLeft')) {
                result.attack = 'leftHand';
                return result;
            }
            if (inputHandler.consumeKey('ArrowUp')) {
                result.attack = 'rightHand';
                return result;
            }
            if (inputHandler.consumeKey('ArrowRight')) {
                result.attack = 'rightLeg';
                return result;
            }
            if (inputHandler.consumeKey('ArrowDown')) {
                result.attack = 'leftLeg';
                return result;
            }
        }

        // Jump control (W key) - edge-triggered
        if (inputHandler && (inputHandler.consumeKey('w') || inputHandler.consumeKey('W'))) {
            result.jump = true;
            return result;
        }

        // Crouch control (S key) - hold to crouch
        if (keys['s'] || keys['S']) {
            result.crouch = true;
            return result;
        }

        // Movement controls (A/D keys)
        // A = backward, D = forward (relative to character facing direction)
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(characterQuaternion);
        forward.y = 0;
        forward.normalize();

        let moveDir = 0;
        if (keys['a'] || keys['A']) {
            // Move backward (opposite of forward direction)
            result.movement.addScaledVector(forward, -moveSpeed);
            moveDir = -1;
        }
        if (keys['d'] || keys['D']) {
            // Move forward (in forward direction)
            result.movement.addScaledVector(forward, moveSpeed);
            moveDir = 1;
        }

        result.moveDirection = moveDir;
        return result;
    }

    /**
     * Get attack type from keys (for combo queuing)
     * @param {object} keys - Keyboard state object
     * @returns {string|null} Attack type or null if no attack key pressed
     */
    getAttackType(keys) {
        if (keys['ArrowLeft']) {
            return 'leftHand';
        }
        if (keys['ArrowUp']) {
            return 'rightHand';
        }
        if (keys['ArrowRight']) {
            return 'rightLeg';
        }
        if (keys['ArrowDown']) {
            return 'leftLeg';
        }
        return null;
    }

    /**
     * Check if a key is currently pressed
     * @param {object} keys - Keyboard state object
     * @param {string} key - Key to check
     * @returns {boolean} True if key is pressed
     */
    keyDown(keys, key) {
        return !!(keys[key] || keys[key.toLowerCase()] || keys[key.toUpperCase()]);
    }
}


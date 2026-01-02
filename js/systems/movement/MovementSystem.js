import * as THREE from 'three';
import { MotionController } from '../MotionController.js';
import { RotationController } from './RotationController.js';

/**
 * MovementSystem - Orchestrates movement and rotation
 * Extracted from Fighter.update() movement logic
 */
export class MovementSystem {
    constructor(motionController, rotationController = null) {
        this.motionController = motionController;
        this.rotationController = rotationController || new RotationController();
    }

    /**
     * Update movement system
     * @param {number} dt - Delta time
     * @param {THREE.Vector3} desiredVelocity - Desired velocity vector
     * @param {THREE.Vector3} currentPosition - Current position
     * @param {THREE.Quaternion} characterQuat - Character's quaternion
     * @param {THREE.Vector3} targetPosition - Target position for rotation (opponent)
     * @param {THREE.Quaternion} facingOffset - Facing offset quaternion
     * @param {string} gameState - Current game state
     * @returns {object} Movement result { position, velocity, speed, direction }
     */
    update(dt, desiredVelocity, currentPosition, characterQuat, targetPosition, facingOffset, gameState) {
        // Update motion controller
        this.motionController.update(dt, desiredVelocity, currentPosition);
        
        // Get updated position
        const position = this.motionController.position.clone();
        
        // Get normalized speed for animation blending
        const speed = this.motionController.getNormalizedSpeed();
        
        // Get movement direction
        const direction = this.motionController.getMovementDirection(characterQuat);
        
        // Update rotation if target is provided and game is in FIGHT state
        if (gameState === 'FIGHT' && targetPosition) {
            const targetQuat = this.rotationController.calculateTargetRotation(
                position,
                targetPosition,
                facingOffset
            );
            this.rotationController.updateRotation(characterQuat, targetQuat, dt);
        }
        
        return {
            position: position,
            velocity: this.motionController.getVelocity(),
            speed: speed,
            direction: direction
        };
    }

    /**
     * Get normalized speed (0-1) for locomotion blending
     * @returns {number} Normalized speed
     */
    getNormalizedSpeed() {
        return this.motionController.getNormalizedSpeed();
    }

    /**
     * Get movement direction relative to character forward
     * @param {THREE.Quaternion} characterQuat - Character's quaternion
     * @returns {number} 1 for forward, -1 for backward, 0 for none
     */
    getMovementDirection(characterQuat) {
        return this.motionController.getMovementDirection(characterQuat);
    }

    /**
     * Update rotation only (for cases where movement isn't needed)
     * @param {THREE.Quaternion} currentQuat - Current quaternion (modified in place)
     * @param {THREE.Vector3} characterPos - Character position
     * @param {THREE.Vector3} targetPos - Target position
     * @param {THREE.Quaternion} facingOffset - Facing offset
     * @param {number} dt - Delta time
     */
    updateRotation(currentQuat, characterPos, targetPos, facingOffset, dt) {
        const targetQuat = this.rotationController.calculateTargetRotation(
            characterPos,
            targetPos,
            facingOffset
        );
        this.rotationController.updateRotation(currentQuat, targetQuat, dt);
    }
}


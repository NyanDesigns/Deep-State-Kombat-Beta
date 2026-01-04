import * as THREE from 'three';
import { CONFIG } from '../../config.js';

/**
 * RotationController - Handles character rotation toward targets
 * Extracted from Fighter.update() rotation logic
 */
export class RotationController {
    constructor() {
        // Temporary vectors and matrices for calculations
        this.tempMatrix = new THREE.Matrix4();
        this.tempQuat = new THREE.Quaternion();
        this.upVector = new THREE.Vector3(0, 1, 0);
    }

    /**
     * Calculate target rotation quaternion
     * @param {THREE.Vector3} characterPos - Character's position
     * @param {THREE.Vector3} targetPos - Target position (opponent)
     * @param {THREE.Quaternion} facingOffset - Facing offset quaternion
     * @returns {THREE.Quaternion} Target rotation quaternion
     */
    calculateTargetRotation(characterPos, targetPos, facingOffset) {
        const target = targetPos.clone();
        target.y = characterPos.y; // Keep same Y level
        
        // Calculate target quaternion
        const targetQuat = new THREE.Quaternion();
        this.tempMatrix.lookAt(characterPos, target, this.upVector);
        targetQuat.setFromRotationMatrix(this.tempMatrix);
        targetQuat.multiply(facingOffset);
        
        return targetQuat;
    }

    /**
     * Update rotation smoothly toward target
     * @param {THREE.Quaternion} currentQuat - Current quaternion (modified in place)
     * @param {THREE.Quaternion} targetQuat - Target quaternion
     * @param {number} dt - Delta time
     * @param {number} turnSpeed - Turn speed (optional, uses config if not provided)
     */
    updateRotation(currentQuat, targetQuat, dt, turnSpeed = null) {
        const speed = turnSpeed || CONFIG.animation?.motion?.turnSpeed || 10.0;
        
        // Smooth rotation using slerp
        const slerpFactor = 1 - Math.exp(-speed * dt);
        currentQuat.slerp(targetQuat, slerpFactor);
    }
}



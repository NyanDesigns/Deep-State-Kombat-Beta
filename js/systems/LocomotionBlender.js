import * as THREE from 'three';

/**
 * LocomotionBlender - Smooth blending between idle and walk animations
 * 
 * Features:
 * - Weight-based blending (idle: 1-speed, walk: speed)
 * - Direction-aware (forward/backward via timeScale)
 * - Always keeps base layer active (prevents floor clipping)
 */
export class LocomotionBlender {
    constructor(config = {}) {
        this.config = config;
        
        // Locomotion settings
        this.minBaseWeight = config.minBaseWeight || 0.1;
        this.walkThreshold = config.walkThreshold || 0.1;
        
        // Current blend state
        this.currentSpeed = 0;
        this.currentDirection = 1;
        this.idleWeight = 1.0;
        this.walkWeight = 0.0;
    }
    
    /**
     * Blend idle and walk animations
     * @param {THREE.AnimationAction} idleAction - Idle animation action
     * @param {THREE.AnimationAction} walkAction - Walk animation action
     * @param {number} speedNormalized - Normalized speed (0-1)
     * @param {number} direction - Movement direction (1 = forward, -1 = backward, 0 = none)
     * @param {number} walkPlaybackSpeed - Base playback speed for walk animation
     */
    blend(idleAction, walkAction, speedNormalized, direction = 1, walkPlaybackSpeed = 1.0) {
        // Update current state
        this.currentSpeed = speedNormalized;
        this.currentDirection = direction;
        
        // Calculate blend weights
        const weights = this.getBlendWeights(speedNormalized);
        this.idleWeight = weights.idle;
        this.walkWeight = weights.walk;
        
        // Apply weights
        if (idleAction) {
            idleAction.setEffectiveWeight(this.idleWeight);
        }
        
        if (walkAction) {
            walkAction.setEffectiveWeight(this.walkWeight);
            
            // Set direction via timeScale
            if (this.walkWeight > 0) {
                const timeScale = direction >= 0 ? walkPlaybackSpeed : -walkPlaybackSpeed;
                walkAction.setEffectiveTimeScale(timeScale);
            }
        }
    }
    
    /**
     * Calculate blend weights based on speed
     * @param {number} speedNormalized - Normalized speed (0-1)
     * @returns {object} Blend weights {idle, walk}
     */
    getBlendWeights(speedNormalized) {
        // Ensure base layer is always active (prevents floor clipping)
        const minWeight = this.minBaseWeight;
        
        // Calculate walk weight (0 to 1)
        const walkWeight = Math.max(0, Math.min(1, speedNormalized));
        
        // Calculate idle weight (1 to minWeight)
        const idleWeight = Math.max(minWeight, 1.0 - walkWeight);
        
        return {
            idle: idleWeight,
            walk: walkWeight
        };
    }
    
    /**
     * Get current blend weights
     * @returns {object} Current blend weights {idle, walk}
     */
    getCurrentWeights() {
        return {
            idle: this.idleWeight,
            walk: this.walkWeight
        };
    }
    
    /**
     * Get current speed
     * @returns {number} Current normalized speed
     */
    getCurrentSpeed() {
        return this.currentSpeed;
    }
    
    /**
     * Get current direction
     * @returns {number} Current direction (1 = forward, -1 = backward, 0 = none)
     */
    getCurrentDirection() {
        return this.currentDirection;
    }
}

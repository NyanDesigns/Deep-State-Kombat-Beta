import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * MotionController - Smooth velocity-based movement with acceleration and damping
 * 
 * Features:
 * - Velocity accumulation with acceleration
 * - Smooth damping when no input
 * - Rotation smoothing with quaternion slerp
 * - Normalized speed output for locomotion blending
 */
export class MotionController {
    constructor(config = {}) {
        this.config = config;
        
        // Motion settings
        this.acceleration = config.acceleration || 12.0;
        this.damping = config.damping || 8.0;
        this.turnSpeed = config.turnSpeed || 10.0;
        this.maxSpeed = config.maxSpeed || 4.0;
        
        // Current velocity
        this.velocity = new THREE.Vector3();
        
        // Current position (updated each frame)
        this.position = new THREE.Vector3();
        
        // Temporary vectors for calculations
        this.tempVec = new THREE.Vector3();
        this.tempVec2 = new THREE.Vector3();
    }
    
    /**
     * Update motion controller with desired velocity
     * @param {number} dt - Delta time
     * @param {THREE.Vector3} desiredVelocity - Desired velocity vector
     * @param {THREE.Vector3} currentPosition - Current position
     */
    update(dt, desiredVelocity, currentPosition) {
        // Copy current position
        this.position.copy(currentPosition);
        
        // Calculate acceleration toward desired velocity
        const desiredSpeed = desiredVelocity.length();
        
        if (desiredSpeed > 0.01) {
            // Normalize desired velocity
            const desiredDir = this.tempVec.copy(desiredVelocity).normalize();
            
            // Target velocity in desired direction
            const targetVelocity = desiredDir.multiplyScalar(desiredSpeed);
            
            // Accelerate toward target velocity
            // Using exponential interpolation for smooth acceleration
            const accelFactor = 1 - Math.exp(-this.acceleration * dt);
            this.velocity.lerp(targetVelocity, accelFactor);
            
            // Clamp to max speed
            if (this.velocity.length() > this.maxSpeed) {
                this.velocity.normalize().multiplyScalar(this.maxSpeed);
            }
        } else {
            // No input - apply damping
            const dampingFactor = Math.exp(-this.damping * dt);
            this.velocity.multiplyScalar(dampingFactor);
            
            // Stop if velocity is very small
            if (this.velocity.lengthSq() < 0.01) {
                this.velocity.set(0, 0, 0);
            }
        }
        
        // Apply velocity to position
        this.position.addScaledVector(this.velocity, dt);
        
        // Keep within bounds (if needed)
        if (this.position.length() > 20) {
            this.position.setLength(20);
        }
    }
    
    /**
     * Update rotation smoothly
     * @param {THREE.Quaternion} currentQuat - Current quaternion
     * @param {THREE.Quaternion} targetQuat - Target quaternion
     * @param {number} dt - Delta time
     * @param {number} turnSpeed - Turn speed (optional, uses config if not provided)
     */
    updateRotation(currentQuat, targetQuat, dt, turnSpeed = null) {
        const speed = turnSpeed || this.turnSpeed;
        
        // Smooth rotation using slerp
        const slerpFactor = 1 - Math.exp(-speed * dt);
        currentQuat.slerp(targetQuat, slerpFactor);
    }
    
    /**
     * Get normalized speed (0-1) for locomotion blending
     * @returns {number} Normalized speed
     */
    getNormalizedSpeed() {
        const speed = this.velocity.length();
        return Math.min(1.0, speed / this.maxSpeed);
    }
    
    /**
     * Get current velocity vector
     * @returns {THREE.Vector3} Current velocity
     */
    getVelocity() {
        return this.velocity.clone();
    }
    
    /**
     * Get movement direction relative to character forward
     * @param {THREE.Quaternion} characterQuat - Character's quaternion
     * @returns {number} 1 for forward, -1 for backward, 0 for none
     */
    getMovementDirection(characterQuat) {
        if (this.velocity.lengthSq() < 0.01) return 0;
        
        // Get character's forward direction
        const forward = this.tempVec.set(0, 0, 1).applyQuaternion(characterQuat);
        forward.y = 0;
        if (forward.lengthSq() > 0) forward.normalize();
        
        // Get velocity direction
        const velDir = this.tempVec2.copy(this.velocity);
        velDir.y = 0;
        if (velDir.lengthSq() === 0) return 0;
        velDir.normalize();
        
        // Dot product: positive = moving forward, negative = moving backward
        const dot = forward.dot(velDir);
        return dot >= 0 ? 1 : -1;
    }
    
    /**
     * Reset velocity
     */
    reset() {
        this.velocity.set(0, 0, 0);
    }
    
    /**
     * Set velocity directly (for immediate movement)
     * @param {THREE.Vector3} velocity - Velocity vector
     */
    setVelocity(velocity) {
        this.velocity.copy(velocity);
    }
}

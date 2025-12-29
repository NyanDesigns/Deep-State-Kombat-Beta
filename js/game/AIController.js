import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class AIController {
    constructor() {
        // AI controller for managing AI fighter behavior
    }

    updateAI(fighter, dt, opponent, collisionSystem) {
        fighter.aiTimer -= dt;
        if (fighter.aiTimer > 0) return;

        const dist = collisionSystem.getDistance(fighter, opponent);

        if (dist < 2.5) {
            if (Math.random() > 0.3) {
                // Attack
                fighter.attack(Math.random() > 0.6 ? 'heavy' : 'light');
            } else {
                // Retreat
                const dir = new THREE.Vector3().subVectors(fighter.mesh.position, opponent.mesh.position).normalize();
                fighter.mesh.position.addScaledVector(dir, 4.0 * dt);
                fighter.play('walk');
            }
        } else {
            // Chase
            const dir = new THREE.Vector3().subVectors(opponent.mesh.position, fighter.mesh.position).normalize();
            fighter.mesh.position.addScaledVector(dir, 4.0 * dt);
            fighter.play('walk');
        }

        // Keep within arena bounds
        if (fighter.mesh.position.length() > 20) {
            fighter.mesh.position.setLength(20);
        }

        fighter.aiTimer = Math.random() * 0.5 + 0.2;
    }

    // More advanced AI could include:
    // - Pattern recognition
    // - Combo execution
    // - Defensive maneuvers
    // - Stamina management
    // - Learning from player behavior

    makeDecision(fighter, opponent, collisionSystem) {
        const dist = collisionSystem.getDistance(fighter, opponent);
        const canAttack = collisionSystem.canAttack(fighter, opponent);
        const staminaPercent = fighter.st / CONFIG.combat.stamina;

        // Decision tree based on distance, stamina, and opponent state
        if (canAttack && staminaPercent > 0.3) {
            // Decide attack type based on distance and randomness
            if (dist < 1.5 && Math.random() > 0.4) {
                return 'heavy_attack';
            } else {
                return 'light_attack';
            }
        } else if (dist < 1.0) {
            // Too close, retreat
            return 'retreat';
        } else if (dist > 3.0) {
            // Too far, approach
            return 'approach';
        } else {
            // Maintain distance or circle
            return Math.random() > 0.5 ? 'approach' : 'retreat';
        }
    }
}


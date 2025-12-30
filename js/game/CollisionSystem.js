import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CollisionSystem {
    constructor() {
        // Collision system for preventing fighters from overlapping
    }

    resolveCollisions(fighters) {
        if (fighters.length !== 2) return;

        this.resolveCharacterCollision(fighters[0], fighters[1]);
    }

    resolveCharacterCollision(p1, p2) {
        const direction = new THREE.Vector3().subVectors(p2.mesh.position, p1.mesh.position);
        direction.y = 0;
        let distance = direction.length();
        const minDistance = p1.collisionRadius + p2.collisionRadius;

        if (distance === 0) {
            direction.set(0, 0, 1);
            distance = 0.001;
        } else {
            direction.normalize();
        }

        const overlap = minDistance - distance;
        if (overlap > 0) {
            // Apply correction with stronger separation (more friction/resistance)
            // Use 0.6 instead of 0.5 for stronger push-away effect
            const correction = direction.clone().multiplyScalar(overlap * 0.6);
            p1.mesh.position.addScaledVector(correction, -1);
            p2.mesh.position.add(correction);
            p1.updateCollisionCapsule();
            p2.updateCollisionCapsule();
        }
    }

    // Check if fighters are within attack range (for AI decision making)
    getDistance(fighter1, fighter2) {
        return fighter1.mesh.position.distanceTo(fighter2.mesh.position);
    }

    // Check if fighter can attack another (within range and facing)
    canAttack(attacker, target) {
        const distance = this.getDistance(attacker, target);
        const attackTypes = ['leftHand', 'rightHand', 'leftLeg', 'rightLeg', 'light', 'heavy'];
        const ranges = attackTypes
            .map(type => attacker.getCombatStats ? attacker.getCombatStats(type) : CONFIG.combat[type])
            .map(stats => stats?.range)
            .filter(r => typeof r === 'number');
        const maxRange = ranges.length ? Math.max(...ranges) : 0;

        if (distance > maxRange) return false;

        // Check if facing target
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(attacker.mesh.quaternion);
        const dir = new THREE.Vector3().subVectors(target.mesh.position, attacker.mesh.position).normalize();
        const dot = fwd.dot(dir);

        return dot > CONFIG.combat.hitAngle * 0.5; // More lenient for AI
    }
}




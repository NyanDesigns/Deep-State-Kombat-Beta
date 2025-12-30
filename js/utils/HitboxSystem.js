import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BoneDiscovery } from './BoneDiscovery.js';

export class HitboxSystem {
    static updateHurtSpheres(fighter) {
        // Update hurt spheres (body/head) - always active
        if (fighter.bones.head) {
            // Use bone world position for head
            const headPos = BoneDiscovery.getBoneWorldPosition(fighter.bones.head);
            fighter.hurtSpheres.head.center.copy(headPos);
        } else if (fighter.modelBox) {
            // Fallback: use model bounding box
            const center = fighter.modelBox.getCenter(new THREE.Vector3());
            const size = fighter.modelBox.getSize(new THREE.Vector3());
            fighter.hurtSpheres.head.center.set(center.x, center.y + size.y * 0.4, center.z);
        } else {
            // Ultimate fallback: use mesh position + estimated height
            fighter.hurtSpheres.head.center.set(
                fighter.mesh.position.x,
                fighter.mesh.position.y + 1.5,
                fighter.mesh.position.z
            );
        }

        if (fighter.bones.spine) {
            // Use bone world position for torso
            const spinePos = BoneDiscovery.getBoneWorldPosition(fighter.bones.spine);
            fighter.hurtSpheres.torso.center.copy(spinePos);
        } else if (fighter.modelBox) {
            // Fallback: use model bounding box center
            const center = fighter.modelBox.getCenter(new THREE.Vector3());
            fighter.hurtSpheres.torso.center.copy(center);
        } else {
            // Ultimate fallback: use mesh position
            fighter.hurtSpheres.torso.center.copy(fighter.mesh.position);
            fighter.hurtSpheres.torso.center.y += 0.8; // Approximate torso height
        }

        // Defensive toggles
        const baseHead = fighter.baseHurtRadii?.head ?? fighter.hurtSpheres.head.radius;
        const baseTorso = fighter.baseHurtRadii?.torso ?? fighter.hurtSpheres.torso.radius;

        fighter.hurtSpheres.head.radius = fighter.state === 'CROUCH' ? 0 : baseHead;
        const torsoDisabled = fighter.state === 'JUMP' && fighter.jumpInvulnerabilityTimer > 0;
        fighter.hurtSpheres.torso.radius = torsoDisabled ? 0 : baseTorso;
    }

    static updateAttackSpheres(fighter) {
        // Update attack spheres only during attacks
        if (fighter.state === 'ATTACK' && fighter.currAct && fighter.atkType) {
            const clip = fighter.currAct.getClip();
            if (clip && clip.duration > 0) {
                // Calculate normalized time (0 to 1) through the animation
                // Three.js handles timeScale automatically - time is already in clip time space
                const ratio = Math.min(1.0, Math.max(0.0, fighter.currAct.time / clip.duration));
                const stats = fighter.getCombatStats ? fighter.getCombatStats(fighter.atkType) : CONFIG.combat[fighter.atkType];
                const windowRange = stats?.window || [0, 0];

                // Only active during hit window
                if (stats && ratio >= windowRange[0] && ratio <= windowRange[1]) {
                    this.disableAttackSpheres(fighter); // Reset before enabling only active limbs
                    if (fighter.atkGroup === 'hands' && fighter.attackSpheres.hands && fighter.attackSpheres.hands.length >= 4) {
                        this.updateHandSpheres(fighter, fighter.activeAttackIndices);
                    } else if (fighter.atkGroup === 'legs' && fighter.attackSpheres.legs && fighter.attackSpheres.legs.length >= 4) {
                        this.updateLegSpheres(fighter, fighter.activeAttackIndices);
                    } else if (fighter.atkType === 'light') {
                        this.updateHandSpheres(fighter);
                    } else if (fighter.atkType === 'heavy') {
                        this.updateLegSpheres(fighter);
                    }
                } else {
                    // Outside hit window - disable all attack spheres
                    this.disableAttackSpheres(fighter);
                }
            } else {
                this.disableAttackSpheres(fighter);
            }
        } else {
            // Not attacking - disable all attack spheres
            this.disableAttackSpheres(fighter);
        }
    }

    static updateHandSpheres(fighter, activeIndices = []) {
        const indices = activeIndices?.length ? activeIndices : [0, 1, 2, 3];

        if (indices.includes(0) && fighter.attackSpheres.hands[0]) {
            // Left hand - fist (index 0)
            let leftHandPos = BoneDiscovery.getBoneWorldPosition(fighter.bones.handLeft);
            if (!BoneDiscovery.isValidPosition(leftHandPos) || !fighter.bones.handLeft) {
                // Fallback estimate
                const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fighter.mesh.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(fighter.mesh.quaternion);
                leftHandPos = fighter.mesh.position.clone()
                    .addScaledVector(fwd, 0.6)
                    .addScaledVector(right, -0.3);
                leftHandPos.y += 1.0;
            }
            fighter.attackSpheres.hands[0].center.copy(leftHandPos);
        }

        if (indices.includes(1) && fighter.attackSpheres.hands[1]) {
            // Left hand - elbow (index 1)
            const leftElbowPos = fighter.bones.forearmLeft ?
                BoneDiscovery.getBoneWorldPosition(fighter.bones.forearmLeft) :
                this.estimateElbow(fighter.bones.handLeft, fighter.mesh, true);
            fighter.attackSpheres.hands[1].center.copy(leftElbowPos);
        }

        if (indices.includes(2) && fighter.attackSpheres.hands[2]) {
            // Right hand - fist (index 2)
            let rightHandPos = BoneDiscovery.getBoneWorldPosition(fighter.bones.handRight);
            if (!BoneDiscovery.isValidPosition(rightHandPos) || !fighter.bones.handRight) {
                // Fallback estimate
                const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fighter.mesh.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(fighter.mesh.quaternion);
                rightHandPos = fighter.mesh.position.clone()
                    .addScaledVector(fwd, 0.6)
                    .addScaledVector(right, 0.3);
                rightHandPos.y += 1.0;
            }
            fighter.attackSpheres.hands[2].center.copy(rightHandPos);
        }

        if (indices.includes(3) && fighter.attackSpheres.hands[3]) {
            // Right hand - elbow (index 3)
            const rightElbowPos = fighter.bones.forearmRight ?
                BoneDiscovery.getBoneWorldPosition(fighter.bones.forearmRight) :
                this.estimateElbow(fighter.bones.handRight, fighter.mesh, false);
            fighter.attackSpheres.hands[3].center.copy(rightElbowPos);
        }
    }

    static updateLegSpheres(fighter, activeIndices = []) {
        const indices = activeIndices?.length ? activeIndices : [0, 1, 2, 3];

        if (indices.includes(0) && fighter.attackSpheres.legs[0]) {
            // Left leg - foot (index 0)
            let leftFootPos = BoneDiscovery.getBoneWorldPosition(fighter.bones.footLeft);
            if (!BoneDiscovery.isValidPosition(leftFootPos) || !fighter.bones.footLeft) {
                // Fallback estimate
                const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fighter.mesh.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(fighter.mesh.quaternion);
                leftFootPos = fighter.mesh.position.clone()
                    .addScaledVector(fwd, 0.5)
                    .addScaledVector(right, -0.2);
                leftFootPos.y += 0.1;
            }
            fighter.attackSpheres.legs[0].center.copy(leftFootPos);
        }

        if (indices.includes(1) && fighter.attackSpheres.legs[1]) {
            // Left leg - knee (index 1)
            const leftKneePos = fighter.bones.shinLeft ?
                BoneDiscovery.getBoneWorldPosition(fighter.bones.shinLeft) :
                this.estimateKnee(fighter.bones.footLeft, fighter.mesh, true);
            fighter.attackSpheres.legs[1].center.copy(leftKneePos);
        }

        if (indices.includes(2) && fighter.attackSpheres.legs[2]) {
            // Right leg - foot (index 2)
            let rightFootPos = BoneDiscovery.getBoneWorldPosition(fighter.bones.footRight);
            if (!BoneDiscovery.isValidPosition(rightFootPos) || !fighter.bones.footRight) {
                // Fallback estimate
                const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fighter.mesh.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(fighter.mesh.quaternion);
                rightFootPos = fighter.mesh.position.clone()
                    .addScaledVector(fwd, 0.5)
                    .addScaledVector(right, 0.2);
                rightFootPos.y += 0.1;
            }
            fighter.attackSpheres.legs[2].center.copy(rightFootPos);
        }

        if (indices.includes(3) && fighter.attackSpheres.legs[3]) {
            // Right leg - knee (index 3)
            const rightKneePos = fighter.bones.shinRight ?
                BoneDiscovery.getBoneWorldPosition(fighter.bones.shinRight) :
                this.estimateKnee(fighter.bones.footRight, fighter.mesh, false);
            fighter.attackSpheres.legs[3].center.copy(rightKneePos);
        }
    }

    static disableAttackSpheres(fighter) {
        // Move attack spheres far away to disable them
        if (fighter.attackSpheres.hands && Array.isArray(fighter.attackSpheres.hands)) {
            fighter.attackSpheres.hands.forEach(sphere => sphere.center.set(Infinity, Infinity, Infinity));
        }
        if (fighter.attackSpheres.legs && Array.isArray(fighter.attackSpheres.legs)) {
            fighter.attackSpheres.legs.forEach(sphere => sphere.center.set(Infinity, Infinity, Infinity));
        }
    }

    static estimateElbow(handBone, mesh, isLeft) {
        const handPos = BoneDiscovery.getBoneWorldPosition(handBone);
        if (!BoneDiscovery.isValidPosition(handPos) || !handBone) {
            // Fallback: estimate from mesh
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
            const pos = mesh.position.clone()
                .addScaledVector(fwd, 0.4)
                .addScaledVector(right, isLeft ? -0.25 : 0.25);
            pos.y += 1.1;
            return pos;
        }
        // Estimate elbow as slightly back from hand
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
        return handPos.clone().addScaledVector(fwd, -0.15);
    }

    static estimateKnee(footBone, mesh, isLeft) {
        const footPos = BoneDiscovery.getBoneWorldPosition(footBone);
        if (!BoneDiscovery.isValidPosition(footPos) || !footBone) {
            // Fallback: estimate from mesh
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
            const pos = mesh.position.clone()
                .addScaledVector(fwd, 0.3)
                .addScaledVector(right, isLeft ? -0.15 : 0.15);
            pos.y += 0.4;
            return pos;
        }
        // Estimate knee as up from foot
        return footPos.clone().add(new THREE.Vector3(0, 0.35, 0.05));
    }
}




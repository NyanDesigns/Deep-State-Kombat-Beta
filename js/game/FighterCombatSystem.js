import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * FighterCombatSystem - Handles fighter-specific combat logic
 * Extracted from Fighter.attack(), Fighter.checkHit(), Fighter.takeDamage()
 */
export class FighterCombatSystem {
    constructor() {
        // Attack mapping
        this.attackMap = {
            leftHand: { animations: ['punchL', 'atk1_left', 'atk1'], group: 'hands', indices: [0, 1], limb: 'left' },
            rightHand: { animations: ['punchR', 'atk1_right', 'atk1'], group: 'hands', indices: [2, 3], limb: 'right' },
            leftLeg: { animations: ['kickL', 'atk2_left', 'atk2'], group: 'legs', indices: [0, 1], limb: 'left' },
            rightLeg: { animations: ['kickR', 'atk2_right', 'atk2'], group: 'legs', indices: [2, 3], limb: 'right' },
            // Legacy/fallback types
            light: { animations: ['atk1'], group: 'hands', indices: [0, 1, 2, 3], limb: 'any' },
            heavy: { animations: ['atk2'], group: 'legs', indices: [0, 1, 2, 3], limb: 'any' }
        };
    }

    /**
     * Execute an attack
     * @param {object} fighter - Fighter instance
     * @param {string} type - Attack type
     * @param {boolean} isChain - Whether this is a combo attack
     * @returns {object|null} Attack result or null if failed
     */
    attack(fighter, type, isChain = false) {
        const attackInfo = this.attackMap[type];
        if (!attackInfo) return null;

        // If already attacking and not a chain, queue for combo
        const currentState = fighter.stateManager?.getCurrentState() || fighter.state;
        if (currentState === 'ATTACK' && !isChain) {
            fighter.comboQueuedType = type; // buffer for combo
            fighter.logInput(`queue:${type}`);
            return { queued: true };
        }

        // Get animation candidates first to check if we can play
        const animCandidates = attackInfo.animations || [];
        const chosenAnim = animCandidates.find(name => fighter.actions[name]) || animCandidates[0];
        
        // Check if animation exists
        if (!chosenAnim || !fighter.actions[chosenAnim]) {
            return null; // Animation not found - can't attack
        }
        
        // Check stamina BEFORE setting state (to prevent double attacks)
        const combatStats = fighter.getCombatStats(type);
        const cost = combatStats?.cost ?? 0;
        if (fighter.st < cost) return null;
        
        // Set state to ATTACK IMMEDIATELY to prevent multiple simultaneous calls
        if (fighter.stateManager) {
            fighter.stateManager.transitionTo('ATTACK');
        } else {
            fighter.state = 'ATTACK';
        }
        
        // Now deduct stamina (state is already set, so subsequent calls will be queued)
        fighter.st -= cost;
        fighter.atkType = type;
        fighter.atkGroup = attackInfo.group;
        fighter.atkLimb = attackInfo.limb;
        fighter.activeAttackIndices = attackInfo.indices || [];
        fighter.hitRegistered = false;
        fighter.comboQueuedType = null;
        fighter.comboWindowOpen = false;
        fighter.comboCount = isChain ? Math.min(fighter.comboCount + 1, fighter.maxCombo) : 1;
        
        // Use AnimationSystem if available
        if (fighter.animationSystem) {
            const priority = isChain ? CONFIG.animation.priorities.ATK2 : CONFIG.animation.priorities.ATK1;
            const fadeIn = isChain ? CONFIG.animation.crossfade.withinCombo : CONFIG.animation.crossfade.toAttack;
            const fadeOut = isChain ? CONFIG.animation.crossfade.withinCombo : CONFIG.animation.crossfade.toBase;
            
            // Calculate playback speed
            const isLeg = chosenAnim.toLowerCase().includes('kick') || chosenAnim.toLowerCase().includes('atk2');
            
            // Base speeds: Initial attacks are 3.5x (hands) and 3.0x (legs)
            let playbackSpeed = isLeg ? 3.0 : 3.5;
            
            // Apply combo multiplier if this is a combo attack
            if (isChain) {
                const comboMultiplier = CONFIG.combat.comboSpeedMultiplier || 17.1;
                playbackSpeed *= comboMultiplier;
            } else {
                // For initial attacks only: apply character config as multiplier (if exists)
                const animVariants = [chosenAnim, type, attackInfo.group === 'hands' ? 'atk1' : 'atk2'];
                for (const animName of animVariants) {
                    const charSpeed = fighter.characterConfig?.animationSettings?.playbackSpeed?.[animName];
                    if (charSpeed !== undefined) {
                        playbackSpeed *= charSpeed;
                        break;
                    }
                }
            }
            
            fighter.currAct = fighter.animationSystem.playOneShot(chosenAnim, {
                priority: priority,
                fadeIn: fadeIn,
                fadeOut: fadeOut,
                autoReturn: true,
                timeScale: playbackSpeed,
                onFinished: () => {
                    if (fighter.stateManager) {
                        fighter.stateManager.transitionTo('IDLE');
                    } else {
                        fighter.state = 'IDLE';
                    }
                    fighter.atkGroup = null;
                    fighter.atkLimb = null;
                    fighter.activeAttackIndices = [];
                    fighter.comboCount = 0;
                    fighter.currAct = null;
                }
            });
            
            if (!fighter.currAct) {
                // Animation couldn't play - refund stamina and reset state
                fighter.st += cost;
                if (fighter.stateManager) {
                    fighter.stateManager.transitionTo('IDLE');
                } else {
                    fighter.state = 'IDLE';
                }
                return null;
            }
        } else {
            // Fallback - should not happen in refactored system
            console.warn('FighterCombatSystem: AnimationSystem not available');
            return null;
        }
        
        fighter.logInput(`atk${isChain ? ' (chain)' : ''}:${type}`);
        return { success: true, animation: chosenAnim };
    }

    /**
     * Process combo system
     * @param {object} fighter - Fighter instance
     * @param {string} queuedType - Queued attack type
     * @param {number} animationRatio - Current animation progress (0-1)
     * @returns {boolean} True if combo was processed
     */
    processCombo(fighter, queuedType, animationRatio) {
        const withinCombo = animationRatio >= fighter.comboWindowStart && animationRatio <= fighter.comboWindowEnd;
        fighter.comboWindowOpen = withinCombo;

        if (queuedType && fighter.comboCount < fighter.maxCombo && (withinCombo || animationRatio >= fighter.comboWindowEnd)) {
            const nextType = queuedType;
            fighter.comboQueuedType = null;
            fighter.comboWindowOpen = false;
            this.attack(fighter, nextType, true);
            return true;
        }

        return false;
    }

    /**
     * Check if attack hits opponent
     * @param {object} attacker - Attacking fighter
     * @param {object} target - Target fighter
     * @returns {object|null} Hit result or null
     */
    checkHit(attacker, target) {
        if (attacker.hitRegistered) return null;
        const currentState = attacker.stateManager?.getCurrentState() || attacker.state;
        if (currentState !== 'ATTACK') return null;

        try {
            attacker.updateHitboxes();
            target.updateHitboxes();
        } catch (e) {
            console.error('Error updating hitboxes in checkHit:', e);
            return null;
        }
        
        // Get current animation
        const currAnim = attacker.animationSystem?.getCurrentAnimation() || attacker.currAct;

        let attackSpheres = null;
        if (attacker.atkGroup === 'hands') {
            attackSpheres = attacker.attackSpheres.hands || [];
        } else if (attacker.atkGroup === 'legs') {
            attackSpheres = attacker.attackSpheres.legs || [];
        } else if (attacker.atkType === 'light' || attacker.atkType === 'heavy') {
            // Fallback for legacy attack types
            attackSpheres = attacker.atkType === 'light' ? (attacker.attackSpheres.hands || []) : (attacker.attackSpheres.legs || []);
        }

        if (!attackSpheres || attackSpheres.length === 0) return null;

        const activeIndices = (Array.isArray(attacker.activeAttackIndices) && attacker.activeAttackIndices.length > 0)
            ? attacker.activeAttackIndices
            : attackSpheres.map((_, i) => i);

        const targetState = target.stateManager?.getCurrentState() || target.state;
        const canHitHead = targetState !== 'CROUCH' && targetState !== 'CROUCH_EXITING';
        const canHitTorso = !(targetState === 'JUMP' && target.jumpInvulnerabilityTimer > 0);

        let hit = false;

        for (const i of activeIndices) {
            const attackSphere = attackSpheres[i];

            if (!attackSphere ||
                attackSphere.center.x === Infinity ||
                attackSphere.center.y === Infinity ||
                attackSphere.center.z === Infinity) {
                continue;
            }

            const headHit = canHitHead && this.sphereIntersectsSphere(attackSphere, target.hurtSpheres.head);
            const torsoHit = canHitTorso && this.sphereIntersectsSphere(attackSphere, target.hurtSpheres.torso);

            if (headHit || torsoHit) {
                hit = true;
                break;
            }
        }

        if (!hit) return null;

        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(attacker.mesh.quaternion);
        const dir = new THREE.Vector3().subVectors(target.mesh.position, attacker.mesh.position).normalize();
        const dot = fwd.dot(dir);

        if (dot <= CONFIG.combat.hitAngle) return null;

        attacker.hitRegistered = true;
        const combatStats = attacker.getCombatStats(attacker.atkType);
        const damage = combatStats?.dmg ?? 0;
        const impactPos = target.mesh.position.clone();
        impactPos.y += target.collisionHeight * 0.5;
        
        // Apply damage and get pushback amount
        const damageResult = this.takeDamage(target, damage, attacker.atkType, attacker);
        const pushbackAmount = damageResult.pushbackAmount || 0;

        // Apply forward movement for attacker to maintain combo range
        if (pushbackAmount > 0 && target.mesh) {
            const forwardDirection = new THREE.Vector3().subVectors(target.mesh.position, attacker.mesh.position);
            forwardDirection.y = 0;
            if (forwardDirection.lengthSq() > 0) {
                forwardDirection.normalize();
                
                const isHeavy = attacker.isHeavyAttack(attacker.atkType);
                const basePushAmount = isHeavy 
                    ? CONFIG.combat.movement.pushback.heavy 
                    : CONFIG.combat.movement.pushback.light;
                const baseForwardAmount = isHeavy 
                    ? CONFIG.combat.movement.forward.heavy 
                    : CONFIG.combat.movement.forward.light;
                
                const pushbackRatio = basePushAmount > 0 ? pushbackAmount / basePushAmount : 0;
                const forwardAmount = baseForwardAmount * pushbackRatio;
                
                attacker.applyForwardMovement(forwardAmount, forwardDirection, target);
            }
        }

        // Gain stamina when landing a successful hit
        const staminaGain = attacker.isHeavyAttack(attacker.atkType) ? 15 : 8;
        attacker.st = Math.min(attacker.maxSt, attacker.st + staminaGain);
        attacker.updateUI();

        return {
            attacker: attacker,
            target: target,
            atkType: attacker.atkType,
            damage,
            position: impactPos
        };
    }

    /**
     * Apply damage to fighter
     * @param {object} fighter - Fighter taking damage
     * @param {number} amount - Damage amount
     * @param {string} type - Attack type
     * @param {object} attacker - Attacking fighter
     * @returns {object} Damage result { state, pushbackAmount }
     */
    takeDamage(fighter, amount, type, attacker) {
        fighter.hp = Math.max(0, fighter.hp - amount);
        // Gain stamina when getting hit
        const staminaGainOnHit = fighter.isHeavyAttack(type) ? 20 : 12;
        fighter.st = Math.min(fighter.maxSt, fighter.st + staminaGainOnHit);
        
        // Pushback when hit
        let pushbackAmount = 0;
        if (attacker && attacker.mesh) {
            const pushDirection = new THREE.Vector3().subVectors(fighter.mesh.position, attacker.mesh.position);
            pushDirection.y = 0;
            if (pushDirection.lengthSq() > 0) {
                pushDirection.normalize();
                
                const isHeavy = fighter.isHeavyAttack(type);
                const basePushAmount = isHeavy 
                    ? CONFIG.combat.movement.pushback.heavy 
                    : CONFIG.combat.movement.pushback.light;
                
                pushbackAmount = fighter.applyPushback(basePushAmount, pushDirection, attacker);
            }
        }
        
        if (fighter.hp <= 0) {
            if (fighter.stateManager) {
                fighter.stateManager.transitionTo('DEAD');
            } else {
                fighter.state = 'DEAD';
            }
            if (fighter.animationSystem) {
                fighter.animationSystem.playOneShot('die', {
                    priority: CONFIG.animation.priorities.DEAD,
                    fadeIn: CONFIG.animation.crossfade.toBase,
                    fadeOut: CONFIG.animation.crossfade.toBase,
                    autoReturn: false,
                    clamp: true
                });
            }
        } else {
            if (fighter.stateManager) {
                fighter.stateManager.transitionTo('STUN');
            } else {
                fighter.state = 'STUN';
            }
            fighter.stunTime = 0.5;
            if (fighter.animationSystem) {
                fighter.animationSystem.playOneShot('hit', {
                    priority: CONFIG.animation.priorities.HIT,
                    fadeIn: CONFIG.animation.crossfade.toHit,
                    fadeOut: CONFIG.animation.crossfade.toBase,
                    autoReturn: true
                });
            }
        }
        fighter.flashColor();
        fighter.updateUI();
        
        return { state: fighter.stateManager?.getCurrentState() || fighter.state, pushbackAmount };
    }

    /**
     * Check if two spheres intersect
     * @param {THREE.Sphere} sphere1 - First sphere
     * @param {THREE.Sphere} sphere2 - Second sphere
     * @returns {boolean} True if spheres intersect
     */
    sphereIntersectsSphere(sphere1, sphere2) {
        const distance = sphere1.center.distanceTo(sphere2.center);
        const minDistance = sphere1.radius + sphere2.radius;
        return distance < minDistance;
    }
}


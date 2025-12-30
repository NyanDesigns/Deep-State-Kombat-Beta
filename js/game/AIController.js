import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class AIController {
    constructor() {
        // AI state machine states
        this.STATE_SPACING = 'SPACING';
        this.STATE_AGGRESSIVE = 'AGGRESSIVE';
        this.STATE_DEFENSIVE = 'DEFENSIVE';
        this.STATE_REACTION = 'REACTION';
        
        // Current behavioral state
        this.currentState = this.STATE_SPACING;
        
        // Decision making timers
        this.decisionTimer = 0;
        this.reactionTimer = 0;
        this.stateChangeTimer = 0;
        
        // Movement behavior
        this.targetDistance = 2.5; // Preferred distance from opponent
        this.spacingDirection = 1; // 1 = forward, -1 = backward
        this.spacingChangeTimer = 0;
        
        // Attack pattern tracking
        this.lastOpponentState = 'IDLE';
        this.opponentAttackDetected = false;
        
        // Resource thresholds (lowered for less defensive behavior)
        this.lowStaminaThreshold = 0.2; // 20% (was 30%)
        this.lowHealthThreshold = 0.2; // 20% (was 25%)
        this.opponentWeakThreshold = 0.5; // 50% HP or ST (was 40%)
        
        // Reaction timing
        this.reactionWindow = 0.3; // Time window to react to opponent attacks
        
        // Action cooldowns to prevent spamming
        this.attackCooldown = 0;
        this.jumpCooldown = 0;
        this.crouchCooldown = 0;
        
        // Idle behavior
        this.idleTimer = 0;
        this.isIdle = false;
    }

    updateAI(fighter, dt, opponent, collisionSystem) {
        // Don't make decisions if fighter is in a locked state
        if (fighter.state === 'ATTACK' || fighter.state === 'STUN' || 
            fighter.state === 'DEAD' || fighter.state === 'WIN') {
            return;
        }

        // Update timers
        this.decisionTimer -= dt;
        this.reactionTimer -= dt;
        this.stateChangeTimer -= dt;
        this.spacingChangeTimer -= dt;
        this.idleTimer -= dt;
        
        // Update action cooldowns
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
        this.crouchCooldown = Math.max(0, this.crouchCooldown - dt);

        // Gather environment data
        const distance = collisionSystem.getDistance(fighter, opponent);
        const fighterHpPercent = fighter.hp / fighter.maxHp;
        const fighterStPercent = fighter.st / fighter.maxSt;
        const opponentHpPercent = opponent.hp / opponent.maxHp;
        const opponentStPercent = opponent.st / opponent.maxSt;
        const opponentState = opponent.state;
        
        // Detect opponent state changes (especially attacks)
        if (opponentState !== this.lastOpponentState) {
            if (opponentState === 'ATTACK') {
                this.opponentAttackDetected = true;
                this.reactionTimer = this.reactionWindow;
            }
            this.lastOpponentState = opponentState;
        }

        // High-priority: React to opponent attacks
        if (this.opponentAttackDetected && this.reactionTimer > 0) {
            this.currentState = this.STATE_REACTION;
            this.handleReaction(fighter, dt, opponent, distance, collisionSystem);
            if (this.reactionTimer <= 0) {
                this.opponentAttackDetected = false;
            }
            return;
        }

        // Evaluate and update behavioral state
        if (this.decisionTimer <= 0) {
            this.evaluateState(fighter, opponent, distance, fighterHpPercent, fighterStPercent, 
                             opponentHpPercent, opponentStPercent, opponentState);
            this.decisionTimer = Math.random() * 0.2 + 0.15; // Decision every 0.15-0.35 seconds
        }

        // PRIORITY: Check for attack opportunities FIRST before movement
        const attackOpportunity = this.checkAttackOpportunity(fighter, opponent, distance, collisionSystem, 
                                                              fighterStPercent, opponentState);
        if (attackOpportunity.shouldAttack) {
            // Attack opportunity found - execute attack immediately
            fighter.attack(attackOpportunity.attackType);
            this.attackCooldown = attackOpportunity.cooldown;
            return; // Don't move this frame
        }

        // Execute behavior based on current state (movement only if no attack)
        this.executeBehavior(fighter, dt, opponent, distance, collisionSystem, 
                           fighterHpPercent, fighterStPercent, opponentHpPercent, opponentStPercent);
    }

    checkAttackOpportunity(fighter, opponent, distance, collisionSystem, fighterStPercent, opponentState) {
        // Must be in IDLE state to attack
        if (fighter.state !== 'IDLE') {
            return { shouldAttack: false };
        }

        // Must have stamina and cooldown expired
        if (fighterStPercent < 0.2 || this.attackCooldown > 0) {
            return { shouldAttack: false };
        }

        // Check if we can attack (range and facing)
        const canAttack = collisionSystem.canAttack(fighter, opponent);
        if (!canAttack) {
            return { shouldAttack: false };
        }

        // Get attack ranges
        const lightStats = fighter.getCombatStats('light') || CONFIG.combat.light;
        const heavyStats = fighter.getCombatStats('heavy') || CONFIG.combat.heavy;
        const lightRange = lightStats.range || 2.2;
        const heavyRange = heavyStats.range || 2.8;

        // Determine attack opportunity based on distance and opponent state
        let attackChance = 0.0;
        let preferHeavy = false;
        let cooldown = 0.2;

        // Opponent is vulnerable - high attack chance
        if (opponentState === 'STUN') {
            attackChance = 0.95; // 95% chance when opponent is stunned
            preferHeavy = true;
            cooldown = 0.15; // Faster attacks when opponent is vulnerable
        } else if (opponentState === 'ATTACK') {
            // Opponent is attacking - punish with counter-attack
            attackChance = 0.85; // 85% chance to counter
            preferHeavy = distance < 2.0;
            cooldown = 0.2;
        } else if (opponentState === 'IDLE') {
            // Opponent is idle - good opportunity
            if (distance <= lightRange) {
                attackChance = 0.75; // 75% chance at close range
            } else if (distance <= heavyRange) {
                attackChance = 0.65; // 65% chance at medium range
            }
            preferHeavy = distance > lightRange && distance <= heavyRange;
        } else {
            // Other states - still attack but lower chance
            if (distance <= lightRange) {
                attackChance = 0.6; // 60% chance
            } else if (distance <= heavyRange) {
                attackChance = 0.5; // 50% chance
            }
        }

        // Increase chance based on current state
        if (this.currentState === this.STATE_AGGRESSIVE) {
            attackChance = Math.min(0.95, attackChance + 0.2); // +20% when aggressive
        } else if (this.currentState === this.STATE_SPACING) {
            attackChance = Math.min(0.9, attackChance + 0.1); // +10% in spacing
        }

        // Roll for attack
        if (Math.random() < attackChance) {
            // Choose attack type
            let attackType;
            if (preferHeavy && fighterStPercent >= (heavyStats.cost || 30) / fighter.maxSt) {
                const heavyAttacks = ['leftLeg', 'rightLeg'];
                attackType = heavyAttacks[Math.floor(Math.random() * heavyAttacks.length)];
            } else {
                const lightAttacks = ['leftHand', 'rightHand'];
                attackType = lightAttacks[Math.floor(Math.random() * lightAttacks.length)];
            }

            return {
                shouldAttack: true,
                attackType: attackType,
                cooldown: cooldown
            };
        }

        return { shouldAttack: false };
    }

    evaluateState(fighter, opponent, distance, fighterHpPercent, fighterStPercent, 
                  opponentHpPercent, opponentStPercent, opponentState) {
        // Check if we should be defensive (low resources)
        if (fighterHpPercent < this.lowHealthThreshold || fighterStPercent < this.lowStaminaThreshold) {
            if (this.currentState !== this.STATE_DEFENSIVE) {
                this.currentState = this.STATE_DEFENSIVE;
                this.stateChangeTimer = Math.random() * 1.0 + 0.5;
            }
            return;
        }

        // Check if opponent is vulnerable (stunned, low health, or low stamina)
        const opponentVulnerable = opponentState === 'STUN' || 
                                  opponentHpPercent < this.opponentWeakThreshold ||
                                  opponentStPercent < this.opponentWeakThreshold;

        // Be aggressive if:
        // 1. Opponent is vulnerable, OR
        // 2. We have good resources (HP > 50% and ST > 50%) and opponent is not attacking
        const hasGoodResources = fighterHpPercent > 0.5 && fighterStPercent > 0.5;
        const shouldBeAggressive = opponentVulnerable || 
                                   (hasGoodResources && opponentState !== 'ATTACK' && distance < 3.5);

        if (shouldBeAggressive) {
            // Go aggressive when conditions are met
            if (this.currentState !== this.STATE_AGGRESSIVE) {
                this.currentState = this.STATE_AGGRESSIVE;
                this.stateChangeTimer = Math.random() * 1.5 + 0.8;
            }
            return;
        }

        // Default to spacing behavior
        if (this.currentState !== this.STATE_SPACING) {
            this.currentState = this.STATE_SPACING;
            this.stateChangeTimer = Math.random() * 2.0 + 1.0;
        }
    }

    handleReaction(fighter, dt, opponent, distance, collisionSystem) {
        // Determine what type of attack opponent is using
        const opponentAttackType = opponent.atkType; // Could be 'light', 'heavy', 'leftHand', 'rightHand', 'leftLeg', 'rightLeg'
        
        // Check if it's a heavy/leg attack or light/hand attack
        const isHeavyAttack = opponentAttackType === 'heavy' || 
                              opponentAttackType === 'leftLeg' || 
                              opponentAttackType === 'rightLeg' ||
                              (opponent.isHeavyAttack && opponent.isHeavyAttack(opponentAttackType));
        
        // Get attack range
        const attackStats = opponent.getCombatStats ? opponent.getCombatStats(opponentAttackType || 'leftHand') : CONFIG.combat[opponentAttackType];
        let attackRange = attackStats?.range;
        if (typeof attackRange !== 'number') {
            if (isHeavyAttack) {
                attackRange = CONFIG.combat?.leftLeg?.range || CONFIG.combat?.rightLeg?.range || CONFIG.combat.heavy.range;
            } else {
                attackRange = CONFIG.combat?.leftHand?.range || CONFIG.combat?.rightHand?.range || CONFIG.combat.light.range;
            }
        }
        
        // Check if attack is in range
        const inAttackRange = distance <= attackRange * 1.2; // Slightly larger range for reaction
        
        if (!inAttackRange) {
            // Attack is out of range, just retreat slightly
            this.moveAway(fighter, opponent, dt);
            return;
        }

        // React based on attack type (only if in IDLE state and cooldown expired)
        if (isHeavyAttack) {
            // Heavy attacks are low (legs) - jump to avoid
            if (fighter.state === 'IDLE' && fighter.actions['jump'] && this.jumpCooldown <= 0) {
                fighter.jump();
                this.jumpCooldown = 0.5; // Cooldown after jump
            } else {
                // Can't jump, try to retreat
                if (fighter.state === 'IDLE') {
                    this.moveAway(fighter, opponent, dt);
                }
            }
        } else {
            // Light attacks are high (hands) - crouch to avoid
            if (fighter.state === 'IDLE' && fighter.actions['crouch'] && this.crouchCooldown <= 0) {
                fighter.crouch();
                this.crouchCooldown = 0.5; // Cooldown after crouch
            } else {
                // Can't crouch, try to retreat
                if (fighter.state === 'IDLE') {
                    this.moveAway(fighter, opponent, dt);
                }
            }
        }
    }

    executeBehavior(fighter, dt, opponent, distance, collisionSystem, 
                    fighterHpPercent, fighterStPercent, opponentHpPercent, opponentStPercent) {
        switch (this.currentState) {
            case this.STATE_DEFENSIVE:
                this.executeDefensive(fighter, dt, opponent, distance, collisionSystem, fighterHpPercent, fighterStPercent);
                break;
            case this.STATE_AGGRESSIVE:
                this.executeAggressive(fighter, dt, opponent, distance, collisionSystem, fighterStPercent);
                break;
            case this.STATE_SPACING:
            default:
                this.executeSpacing(fighter, dt, opponent, distance, collisionSystem, fighterStPercent);
                break;
        }
    }

    executeDefensive(fighter, dt, opponent, distance, collisionSystem, fighterHpPercent, fighterStPercent) {
        // Defensive behavior: maintain distance, avoid attacks, wait for opportunities
        
        // Increase retreat distance when health is very low
        const retreatDistance = fighterHpPercent < 0.15 ? 3.5 : 3.0;
        const idleZoneMin = retreatDistance;
        const idleZoneMax = retreatDistance + 0.8;
        
        if (distance < idleZoneMin) {
            // Too close, retreat
            this.isIdle = false;
            this.moveAway(fighter, opponent, dt);
        } else if (distance > idleZoneMax) {
            // Too far, approach slightly but cautiously
            this.isIdle = false;
            this.moveToward(fighter, opponent, dt, 0.6); // Slower movement when defensive
        } else {
            // In idle zone - stop moving and observe
            if (!this.isIdle) {
                this.isIdle = true;
                this.idleTimer = Math.random() * 1.0 + 0.5; // Idle for 0.5-1.5 seconds
            }
            
            if (this.idleTimer > 0) {
                // Stay idle, play idle animation
                if (fighter.state === 'IDLE') {
                    fighter.play('idle', fighter.animationFade);
                }
            } else {
                // Idle time expired, do small movement
                this.isIdle = false;
                if (this.spacingChangeTimer <= 0) {
                    this.spacingDirection *= -1;
                    this.spacingChangeTimer = Math.random() * 0.8 + 0.4;
                }
                
                const moveAmount = 0.3; // Very reduced movement speed
                if (this.spacingDirection > 0) {
                    this.moveToward(fighter, opponent, dt, moveAmount);
                } else {
                    this.moveAway(fighter, opponent, dt, moveAmount);
                }
            }
        }

        // Attack opportunities are now handled in checkAttackOpportunity()
        // This defensive mode focuses on movement and positioning
    }

    executeAggressive(fighter, dt, opponent, distance, collisionSystem, fighterStPercent) {
        // Aggressive behavior: pursue opponent, attack frequently
        
        const attackRange = 2.8;
        const idleZoneMin = 1.8;
        const idleZoneMax = 2.5;
        
        if (distance > attackRange) {
            // Chase opponent
            this.isIdle = false;
            this.moveToward(fighter, opponent, dt, 1.0);
        } else if (distance < idleZoneMin) {
            // Too close, slight retreat to create space for attack
            this.isIdle = false;
            this.moveAway(fighter, opponent, dt, 0.5);
        } else if (distance >= idleZoneMin && distance <= idleZoneMax) {
            // In optimal attack range - brief idle to wait for attack opportunity
            // Attacks are handled in checkAttackOpportunity() before this function
            if (!this.isIdle) {
                this.isIdle = true;
                this.idleTimer = Math.random() * 0.2 + 0.05; // Very short idle 0.05-0.25 seconds
            }
            
            if (this.idleTimer > 0 && fighter.state === 'IDLE') {
                fighter.play('idle', fighter.animationFade);
            } else {
                this.isIdle = false;
            }
        } else {
            // Between zones, move to optimal range
            this.isIdle = false;
            if (distance < idleZoneMin) {
                this.moveAway(fighter, opponent, dt, 0.6);
            } else {
                this.moveToward(fighter, opponent, dt, 0.6);
            }
        }
    }

    executeSpacing(fighter, dt, opponent, distance, collisionSystem, fighterStPercent) {
        // Spacing behavior: maintain optimal distance, bait attacks, look for openings
        
        const minDistance = 2.0;
        const maxDistance = 3.5;
        const idleZoneMin = 2.2;
        const idleZoneMax = 3.0;
        
        // Update spacing direction periodically
        if (this.spacingChangeTimer <= 0) {
            // Change direction based on current distance
            if (distance < this.targetDistance) {
                this.spacingDirection = -1; // Move away
            } else if (distance > this.targetDistance + 0.5) {
                this.spacingDirection = 1; // Move toward
            } else {
                // Randomly change direction for more natural movement
                this.spacingDirection = Math.random() > 0.5 ? 1 : -1;
            }
            this.spacingChangeTimer = Math.random() * 1.2 + 0.6;
        }

        // Adjust target distance slightly for variation
        if (Math.random() < 0.1) {
            this.targetDistance = 2.0 + Math.random() * 1.5;
        }

        // Movement logic with idle zones
        if (distance < minDistance) {
            // Too close, move away
            this.isIdle = false;
            this.moveAway(fighter, opponent, dt, 0.8);
        } else if (distance > maxDistance) {
            // Too far, move closer
            this.isIdle = false;
            this.moveToward(fighter, opponent, dt, 0.8);
        } else if (distance >= idleZoneMin && distance <= idleZoneMax) {
            // In idle zone - stop moving and observe
            if (!this.isIdle) {
                this.isIdle = true;
                this.idleTimer = Math.random() * 1.5 + 0.5; // Idle for 0.5-2.0 seconds
            }
            
            if (this.idleTimer > 0) {
                // Stay idle, play idle animation
                if (fighter.state === 'IDLE') {
                    fighter.play('idle', fighter.animationFade);
                }
            } else {
                // Idle time expired, do small spacing movement
                this.isIdle = false;
                const moveAmount = 0.5;
                if (this.spacingDirection > 0) {
                    this.moveToward(fighter, opponent, dt, moveAmount);
                } else {
                    this.moveAway(fighter, opponent, dt, moveAmount);
                }
            }
        } else {
            // Between zones, move to optimal range
            this.isIdle = false;
            if (distance < idleZoneMin) {
                this.moveAway(fighter, opponent, dt, 0.7);
            } else {
                this.moveToward(fighter, opponent, dt, 0.7);
            }
        }

        // Attack opportunities are now handled in checkAttackOpportunity()
        // This spacing mode focuses on movement and positioning
    }

    moveToward(fighter, opponent, dt, speedMultiplier = 1.0) {
        // Only move if fighter is in IDLE state
        if (fighter.state !== 'IDLE') return;
        
        const dir = new THREE.Vector3().subVectors(opponent.mesh.position, fighter.mesh.position);
        dir.y = 0;
        if (dir.lengthSq() > 0) {
            dir.normalize();
            const moveSpeed = fighter.moveSpeed * speedMultiplier;
            fighter.mesh.position.addScaledVector(dir, moveSpeed * dt);
            this.keepInBounds(fighter);
            fighter.play('walk', fighter.animationFade);
        }
    }

    moveAway(fighter, opponent, dt, speedMultiplier = 1.0) {
        // Only move if fighter is in IDLE state
        if (fighter.state !== 'IDLE') return;
        
        const dir = new THREE.Vector3().subVectors(fighter.mesh.position, opponent.mesh.position);
        dir.y = 0;
        if (dir.lengthSq() > 0) {
            dir.normalize();
            const moveSpeed = fighter.moveSpeed * speedMultiplier;
            fighter.mesh.position.addScaledVector(dir, moveSpeed * dt);
            this.keepInBounds(fighter);
            fighter.play('walk', fighter.animationFade, true); // Reverse walk animation
        }
    }

    keepInBounds(fighter) {
        // Keep within arena bounds
        if (fighter.mesh.position.length() > 20) {
            fighter.mesh.position.setLength(20);
        }
    }

    // Legacy method for compatibility (if needed)
    makeDecision(fighter, opponent, collisionSystem) {
        const dist = collisionSystem.getDistance(fighter, opponent);
        const canAttack = collisionSystem.canAttack(fighter, opponent);
        const staminaPercent = fighter.st / CONFIG.combat.stamina;

        if (canAttack && staminaPercent > 0.3) {
            if (dist < 1.5 && Math.random() > 0.4) {
                return Math.random() > 0.5 ? 'leftLeg' : 'rightLeg';
            } else {
                return Math.random() > 0.5 ? 'leftHand' : 'rightHand';
            }
        } else if (dist < 1.0) {
            return 'retreat';
        } else if (dist > 3.0) {
            return 'approach';
        } else {
            return Math.random() > 0.5 ? 'approach' : 'retreat';
        }
    }
}

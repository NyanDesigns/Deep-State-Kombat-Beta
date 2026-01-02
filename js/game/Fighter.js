import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { BoneDiscovery } from '../utils/BoneDiscovery.js';
import { HitboxSystem } from '../utils/HitboxSystem.js';
import { AIController } from './AIController.js';
import { MotionController } from '../systems/MotionController.js';
import { InputController } from '../systems/input/InputController.js';
import { MovementSystem } from '../systems/movement/MovementSystem.js';
import { AnimationSystem } from '../systems/animation/AnimationSystem.js';
import { StateManager } from './StateManager.js';
import { FighterCombatSystem } from './FighterCombatSystem.js';

export class Fighter {
    constructor(id, pos, isAI, gltf, scene, characterConfig = null) {
        this.id = id;
        this.isAI = isAI;
        this.characterConfig = characterConfig;
        this.pos = pos;

        // Use character-specific stats or fall back to defaults
        this.hp = characterConfig?.stats?.hp || CONFIG.combat.hp;
        this.st = characterConfig?.stats?.stamina || CONFIG.combat.stamina;
        this.maxHp = this.hp;
        this.maxSt = this.st;
        this.moveSpeed = characterConfig?.stats?.moveSpeed || 4.0;

        // Setup Mesh - Use SkeletonUtils for correct skinning/animation cloning
        this.mesh = SkeletonUtils.clone(gltf.scene);
        scene.add(this.mesh);
        this.mesh.position.copy(pos);

        // Ensure matrices are updated before scale calculation
        this.mesh.updateMatrixWorld(true);

        // Normalize Scale
        const box = new THREE.Box3().setFromObject(this.mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = size.y;

        const configuredHeight = this.characterConfig?.scale;
        const targetHeight = Math.max(configuredHeight || 4.0, 4.0); // Enforce a larger minimum visual height
        const scale = targetHeight / (h || 1);
        this.mesh.scale.setScalar(scale);

        // Facing offset (models exported facing -Z, need to rotate 180 degrees)
        this.facingOffset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        
        // Temporary vectors and quaternions for calculations
        this.tempVec = new THREE.Vector3();
        this.tempVec2 = new THREE.Vector3();
        this.tempMatrix = new THREE.Matrix4();
        this.tempQuat = new THREE.Quaternion();
        this.upVector = new THREE.Vector3(0, 1, 0);
        
        // Initial rotation - face opponent position (will be set correctly after animations load)
        const opponentPos = new THREE.Vector3(id === 'p1' ? 5 : -5, 0, 0);
        this.applyFacing(opponentPos);

        // Recalculate collision bounds using scaled size
        box.setFromObject(this.mesh);
        box.getSize(size);

        // Collision radius for collision detection
        this.collisionRadius = Math.max(size.x, size.z) * 0.30;
        if (!isFinite(this.collisionRadius) || this.collisionRadius < 0.30) {
            this.collisionRadius = 0.55;
        }
        this.collisionHeight = Math.max(size.y, 1.8);

        // Shadows & Flash Material
        this.origMats = new Map();
        this.bones = {}; // Store bone references
        this.mesh.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                if (!c.material.map) {
                    const defaultColor = isAI ? 0xaa4444 : 0x44aa44;
                    const characterColor = this.characterConfig?.color;
                    c.material = new THREE.MeshStandardMaterial({
                        color: characterColor || defaultColor,
                        roughness: 0.6
                    });
                }
                this.origMats.set(c, c.material); // Store for flash effect

                // Find skeleton and bones if this is a skinned mesh
                if (c.isSkinnedMesh && c.skeleton) {
                    this.bones = BoneDiscovery.discoverBones(c.skeleton);
                }
            }
        });

        // Fallback: if no bones found, use model bounding box for positioning
        if (Object.keys(this.bones).length === 0) {
            this.modelBox = new THREE.Box3().setFromObject(this.mesh);
        }

        // Anim - will be loaded after construction
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this.actions = {};
        this.animationFade = characterConfig?.animationSettings?.fadeTime ?? 0.1;
        this.availableClips = [];
        
        // Motion system
        const motionConfig = CONFIG.animation?.motion || {};
        motionConfig.maxSpeed = this.moveSpeed;
        this.motionController = new MotionController(motionConfig);
        this.desiredVelocity = new THREE.Vector3();
        
        // Initialize subsystems
        this.inputController = new InputController();
        this.movementSystem = new MovementSystem(this.motionController);
        this.stateManager = new StateManager({ priorities: CONFIG.animation?.priorities });
        this.combatSystem = new FighterCombatSystem();
        
        // Animation system - will be initialized after animations load
        this.animationSystem = null;
        this.animationController = null; // Keep for backward compatibility during transition
        
        // Crouch duration (unified timing)
        this.crouchDuration = CONFIG.animation?.locomotion?.crouchDuration || 0.5;

        // Initialize state
        this.stateManager.setState('IDLE');
        this.state = 'IDLE'; // Keep for backward compatibility
        this.currAct = null; // Keep for backward compatibility during transition

        // Combat vars
        this.hitRegistered = false;
        this.atkGroup = null; // 'hands' or 'legs' for active attack
        this.atkLimb = null; // 'left' or 'right' for attack limb
        this.activeAttackIndices = []; // Which attack spheres are active for current attack
        this.jumpInvulnerabilityTimer = 0;
        this.comboQueuedType = null;
        this.comboWindowOpen = false;
        this.comboCount = 0;
        this.maxCombo = 3;
        this.comboWindowStart = 0.35;
        this.comboWindowEnd = 0.8;
        this.inputLog = [];
        // Jump cancel and invulnerability tuning
        this.jumpCancelStart = 0.35; // Ratio into jump anim when next action can start
        this.jumpAutoEnd = 0.8;      // Ratio to force return to idle if nothing else happens
        this.stateTimer = 0;
        this.prevState = this.state;
        this.stunTime = 0;
        this.moveDirection = 0; // 1 = forward, -1 = backward, 0 = none
        
        // AI Controller (only for AI fighters)
        this.aiController = this.isAI ? new AIController() : null;

        // Hitbox system - using spheres with character-specific sizes (larger radii for easier hits)
        // Smaller base hurtboxes for tighter collisions
        // All hitbox radii are doubled for larger hit detection
        const headRadius = (characterConfig?.hitboxes?.head || 0.28) * 2;
        const torsoRadius = (characterConfig?.hitboxes?.torso || 0.4) * 2;

        this.hurtSpheres = {
            head: new THREE.Sphere(new THREE.Vector3(), headRadius),
            torso: new THREE.Sphere(new THREE.Vector3(), torsoRadius)
        };
        this.baseHurtRadii = {
            head: this.hurtSpheres.head.radius,
            torso: this.hurtSpheres.torso.radius
        };

        // Multi-sphere attack hitboxes: each hand has fist+elbow, each leg has foot+knee
        // Made much bigger for easier hits - all radii doubled
        // Trump's punch and kick hitboxes (attackHands and attackLegs) are doubled again (4x total, 2x current)
        const baseHandSizes = characterConfig?.hitboxes?.attackHands || [0.32, 0.28, 0.32, 0.28];
        const handSizes = baseHandSizes.map(size => {
            const doubled = size * 2;
            // Double again for Trump punches only
            return (characterConfig?.id === 'trump') ? doubled * 2 : doubled;
        });
        const baseLegSizes = characterConfig?.hitboxes?.attackLegs || [0.38, 0.32, 0.38, 0.32];
        const legSizes = baseLegSizes.map(size => {
            const doubled = size * 2;
            // Double again for Trump kicks only
            return (characterConfig?.id === 'trump') ? doubled * 2 : doubled;
        });

        this.attackSpheres = {
            hands: [
                new THREE.Sphere(new THREE.Vector3(), handSizes[0] || 0.5), // Left hand - fist (doubled from 0.25)
                new THREE.Sphere(new THREE.Vector3(), handSizes[1] || 0.44), // Left hand - elbow (doubled from 0.22)
                new THREE.Sphere(new THREE.Vector3(), handSizes[2] || 0.5), // Right hand - fist (doubled from 0.25)
                new THREE.Sphere(new THREE.Vector3(), handSizes[3] || 0.44)  // Right hand - elbow (doubled from 0.22)
            ],
            legs: [
                new THREE.Sphere(new THREE.Vector3(), legSizes[0] || 0.56), // Left leg - foot (doubled from 0.28)
                new THREE.Sphere(new THREE.Vector3(), legSizes[1] || 0.48), // Left leg - knee (doubled from 0.24)
                new THREE.Sphere(new THREE.Vector3(), legSizes[2] || 0.56), // Right leg - foot (doubled from 0.28)
                new THREE.Sphere(new THREE.Vector3(), legSizes[3] || 0.48)  // Right leg - knee (doubled from 0.24)
            ]
        };
        this.initHitboxes();
        this.collisionStart = new THREE.Vector3();
        this.collisionEnd = new THREE.Vector3();
        this.updateCollisionCapsule();

        // Debug visualization
        this.hitboxVisualization = null;
        this.collisionBoxVisualization = null;
        this.showHitboxes = false;
        this.showCollisionBox = false;
        this.initVisualizations(scene);
    }

    loadAnimations(clips = []) {
        this.availableClips = clips;
        this.loadAnim('idle', THREE.LoopRepeat, false, clips, ['breath', 'breathingidle', 'idle']);
        this.loadAnim('walk', THREE.LoopRepeat, false, clips);
        this.loadAnim('atk1', THREE.LoopOnce, false, clips);
        this.loadAnim('atk2', THREE.LoopOnce, false, clips);
        // Explicit per-limb clips from the model
        this.loadAnim('punchL', THREE.LoopOnce, false, clips, ['punchl', 'punch_l', 'punch l']);
        this.loadAnim('punchR', THREE.LoopOnce, false, clips, ['punchr', 'punch_r', 'punch r']);
        this.loadAnim('kickL', THREE.LoopOnce, false, clips, ['kickl', 'kick_l', 'kick l']);
        this.loadAnim('kickR', THREE.LoopOnce, false, clips, ['kickr', 'kick_r', 'kick r']);
        // Legacy/aliases for side-specific attacks
        this.loadAnim('atk1_left', THREE.LoopOnce, false, clips, ['punch l', 'punch left', 'jab l', 'jab left']);
        this.loadAnim('atk1_right', THREE.LoopOnce, false, clips, ['punch r', 'punch right', 'jab r', 'jab right']);
        this.loadAnim('atk2_left', THREE.LoopOnce, false, clips, ['kick out', 'kick l', 'kick left', 'left kick', 'kickl']);
        this.loadAnim('atk2_right', THREE.LoopOnce, false, clips, ['kick r', 'kick right', 'right kick', 'kickr']);
        this.loadAnim('hit', THREE.LoopOnce, false, clips);
        this.loadAnim('jump', THREE.LoopOnce, false, clips);
        this.loadAnim('crouch', THREE.LoopOnce, true, clips); // LoopOnce with clamp to stay at end
        this.loadAnim('breath', THREE.LoopRepeat, false, clips, ['breathingidle', 'breath', 'idle']);
        this.loadAnim('win', THREE.LoopRepeat, false, clips);
        this.loadAnim('die', THREE.LoopOnce, true, clips); // Clamp at end

        // Initialize animation system after animations are loaded
        this.initializeAnimationSystem();
        
        // Set initial state
        this.stateManager.setState('IDLE');
        this.state = 'IDLE'; // Keep for backward compatibility
        
        // Start with idle via animation system
        if (this.animationSystem) {
            this.animationSystem.updateLocomotionBlend(0, 1);
        }
    }
    
    /**
     * Initialize animation system components
     */
    initializeAnimationSystem() {
        // Animation system config
        // NOTE: Do NOT pass character config playbackSpeed here - handle all speed calculations in FighterCombatSystem
        // This prevents conflicts with combo speed calculations
        const animConfig = {
            priorities: CONFIG.animation?.priorities,
            crossfade: CONFIG.animation?.crossfade,
            locomotion: CONFIG.animation?.locomotion,
            playbackSpeed: {} // Empty - speeds are calculated in FighterCombatSystem and passed via timeScale option
        };
        
        // Initialize AnimationSystem (unified animation system)
        this.animationSystem = new AnimationSystem(this.mixer, this.actions, animConfig);
        
        // Keep animationController reference for backward compatibility during transition
        this.animationController = this.animationSystem.animationController;
    }
    
    /**
     * Apply facing to target position (consistent for init and runtime)
     */
    applyFacing(targetPosition) {
        this.tempMatrix.lookAt(this.mesh.position, targetPosition, this.upVector);
        this.tempQuat.setFromRotationMatrix(this.tempMatrix);
        this.tempQuat.multiply(this.facingOffset);
        this.mesh.quaternion.copy(this.tempQuat);
    }

    initHitboxes() {
        // Spheres are already initialized in constructor
        // This method can be used for additional setup if needed
    }

    initVisualizations(scene) {
        // Hitbox visualization group
        this.hitboxVisualization = new THREE.Group();
        scene.add(this.hitboxVisualization);
        this.hitboxVisualization.visible = false;

        // Hurt sphere visualizations (head and torso)
        const headHelper = new THREE.Mesh(
            new THREE.SphereGeometry(this.hurtSpheres.head.radius, 16, 16),
            new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                wireframe: true, 
                transparent: true, 
                opacity: 0.5 
            })
        );
        headHelper.name = 'headHurtSphere';
        this.hitboxVisualization.add(headHelper);

        const torsoHelper = new THREE.Mesh(
            new THREE.SphereGeometry(this.hurtSpheres.torso.radius, 16, 16),
            new THREE.MeshBasicMaterial({ 
                color: 0xff6600, 
                wireframe: true, 
                transparent: true, 
                opacity: 0.5 
            })
        );
        torsoHelper.name = 'torsoHurtSphere';
        this.hitboxVisualization.add(torsoHelper);

        // Attack sphere visualizations (hands and legs)
        // Hands
        for (let i = 0; i < 4; i++) {
            const handHelper = new THREE.Mesh(
                new THREE.SphereGeometry(this.attackSpheres.hands[i].radius, 16, 16),
                new THREE.MeshBasicMaterial({ 
                    color: 0x00ff00, 
                    wireframe: true, 
                    transparent: true, 
                    opacity: 0.6 
                })
            );
            handHelper.name = `handAttackSphere_${i}`;
            this.hitboxVisualization.add(handHelper);
        }

        // Legs
        for (let i = 0; i < 4; i++) {
            const legHelper = new THREE.Mesh(
                new THREE.SphereGeometry(this.attackSpheres.legs[i].radius, 16, 16),
                new THREE.MeshBasicMaterial({ 
                    color: 0x0000ff, 
                    wireframe: true, 
                    transparent: true, 
                    opacity: 0.6 
                })
            );
            legHelper.name = `legAttackSphere_${i}`;
            this.hitboxVisualization.add(legHelper);
        }

        // Collision box visualization - uses the same collisionRadius as physics
        this.collisionBoxVisualization = new THREE.Group();
        scene.add(this.collisionBoxVisualization);
        this.collisionBoxVisualization.visible = false;

        const collisionCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(this.collisionRadius, this.collisionRadius, this.collisionHeight, 16),
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, transparent: true, opacity: 0.5 })
        );
        collisionCylinder.name = 'collisionCylinder';
        this.collisionBoxVisualization.add(collisionCylinder);
    }

    updateHitboxVisualization() {
        if (!this.hitboxVisualization || !this.showHitboxes) return;

        // Update hurt spheres
        const headHelper = this.hitboxVisualization.getObjectByName('headHurtSphere');
        const torsoHelper = this.hitboxVisualization.getObjectByName('torsoHurtSphere');
        
        if (headHelper) {
            headHelper.position.copy(this.hurtSpheres.head.center);
            headHelper.visible = this.hurtSpheres.head.radius > 0;
        }
        if (torsoHelper) {
            torsoHelper.position.copy(this.hurtSpheres.torso.center);
            torsoHelper.visible = this.hurtSpheres.torso.radius > 0;
        }

        // Update attack spheres - hands
        for (let i = 0; i < 4; i++) {
            const handHelper = this.hitboxVisualization.getObjectByName(`handAttackSphere_${i}`);
            if (handHelper) {
                const sphere = this.attackSpheres.hands[i];
                // Only show if sphere is active (not at Infinity)
                if (sphere.center.x !== Infinity && 
                    sphere.center.y !== Infinity && 
                    sphere.center.z !== Infinity) {
                    handHelper.position.copy(sphere.center);
                    handHelper.visible = true;
                } else {
                    handHelper.visible = false;
                }
            }
        }

        // Update attack spheres - legs
        for (let i = 0; i < 4; i++) {
            const legHelper = this.hitboxVisualization.getObjectByName(`legAttackSphere_${i}`);
            if (legHelper) {
                const sphere = this.attackSpheres.legs[i];
                // Only show if sphere is active (not at Infinity)
                if (sphere.center.x !== Infinity && 
                    sphere.center.y !== Infinity && 
                    sphere.center.z !== Infinity) {
                    legHelper.position.copy(sphere.center);
                    legHelper.visible = true;
                } else {
                    legHelper.visible = false;
                }
            }
        }
    }

    updateCollisionBoxVisualization() {
        if (!this.collisionBoxVisualization || !this.showCollisionBox) return;

        this.updateCollisionCapsule();
        
        const cylinder = this.collisionBoxVisualization.getObjectByName('collisionCylinder');

        if (cylinder) {
            // Calculate midY relative to mesh position (since group will be positioned at mesh.position.y)
            const midYRelative = (this.collisionStart.y + this.collisionEnd.y) * 0.5 - this.mesh.position.y;
            cylinder.position.y = midYRelative;
        }

        // Position the whole group to follow the character's position (x, y, z)
        this.collisionBoxVisualization.position.x = this.mesh.position.x;
        this.collisionBoxVisualization.position.y = this.mesh.position.y;
        this.collisionBoxVisualization.position.z = this.mesh.position.z;
    }

    setHitboxVisibility(visible) {
        this.showHitboxes = visible;
        if (this.hitboxVisualization) {
            this.hitboxVisualization.visible = visible;
        }
    }

    setCollisionBoxVisibility(visible) {
        this.showCollisionBox = visible;
        if (this.collisionBoxVisualization) {
            this.collisionBoxVisualization.visible = visible;
        }
    }

    updateCollisionCapsule() {
        const feetPos = this.mesh.position.clone();
        feetPos.y += 0.05;
        const headPos = this.mesh.position.clone();
        headPos.y += this.collisionHeight;
        this.collisionStart.copy(feetPos);
        this.collisionEnd.copy(headPos);
    }

    updateHitboxes() {
        // Update hurt spheres first
        HitboxSystem.updateHurtSpheres(this);

        // Update attack spheres
        HitboxSystem.updateAttackSpheres(this);
    }

    loadAnim(name, loop, clamp = false, clips = [], aliases = []) {
        let clipIndex = null;

        // First try to get animation from character config
        if (this.characterConfig?.animations?.[name] !== undefined) {
            const animConfig = this.characterConfig.animations[name];
            if (typeof animConfig === 'number') {
                clipIndex = animConfig;
            } else if (typeof animConfig === 'string') {
                // Find by name
                clipIndex = clips.findIndex(clip => clip.name === animConfig);
                if (clipIndex === -1) {
                    // Try partial match
                    clipIndex = clips.findIndex(clip =>
                        clip.name.toLowerCase().includes(animConfig.toLowerCase())
                    );
                }
            }
        }

        // Fallback to dropdown selection
        if (clipIndex === null) {
            const selectEl = document.getElementById(this.id + '-' + name);
            clipIndex = selectEl ? parseInt(selectEl.value) : null;
        }

        // Try alias name matches (case-insensitive partial)
        if (clipIndex === null && aliases && aliases.length && clips && clips.length) {
            const lowerAliases = aliases.map(a => a.toLowerCase());
            clipIndex = clips.findIndex(clip => {
                const lcName = clip.name.toLowerCase();
                return lowerAliases.some(alias => lcName.includes(alias));
            });
            if (clipIndex === -1) clipIndex = null;
        }

        // As a last resort, try partial match on the provided name
        if (clipIndex === null && clips && clips.length) {
            const nameLower = name.toLowerCase();
            clipIndex = clips.findIndex(clip => clip.name.toLowerCase().includes(nameLower));
            if (clipIndex === -1) clipIndex = null;
        }

        if (clipIndex !== null && clips[clipIndex]) {
            const clip = clips[clipIndex];
            const act = this.mixer.clipAction(clip);
            act.setLoop(loop);
            act.clampWhenFinished = clamp;
            this.actions[name] = act;
        }
    }


    update(dt, opp, gameState, keys = {}, camera = null, collisionSystem = null, inputHandler = null) {
        // 1. Update animation system
        if (this.animationSystem) {
            this.animationSystem.update(dt);
        }
        
        // Update mixer
        this.mixer.update(dt);
        
        // Update playback curves (for jump)
        if (this.animationSystem && this.currAct) {
            this.animationSystem.applyPlaybackCurves(this.currAct);
        }

        // Track state changes
        const currentState = this.stateManager.getCurrentState();
        if (this.prevState !== currentState) {
            this.stateTimer = 0;
            this.prevState = currentState;
            this.state = currentState; // Keep in sync for backward compatibility
        } else {
            this.stateTimer += dt;
        }
        
        // Update jump invulnerability timer
        if (currentState === 'JUMP') {
            const currAnim = this.animationSystem?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;
            const shouldTick = ratio > 0.08; // don't burn invuln before lift-off
            if (shouldTick) {
                const decayRate = ratio < 0.8 ? 0.3 : 0.6;
                this.jumpInvulnerabilityTimer = Math.max(0, this.jumpInvulnerabilityTimer - dt * decayRate);
            }
        } else {
            this.jumpInvulnerabilityTimer = 0;
        }

        // Queue combo attacks during attack state
        if (!this.isAI && currentState === 'ATTACK') {
            const queuedAttack = this.inputController.getAttackType(keys);
            if (queuedAttack) {
                this.comboQueuedType = queuedAttack;
            }
        }

        if (gameState !== 'FIGHT' && gameState !== 'OVER') return;
        if (currentState === 'DEAD' || currentState === 'WIN') return;

        // 2. Process input (if not AI)
        if (!this.isAI && gameState === 'FIGHT') {
            const inputResult = this.inputController.processInput(
                dt, keys, inputHandler, currentState, 
                this.mesh.quaternion, this.moveSpeed
            );
            
            // Handle attack input
            if (inputResult.attack) {
                this.combatSystem.attack(this, inputResult.attack, false);
                this.desiredVelocity.set(0, 0, 0);
            }
            // Handle jump input
            else if (inputResult.jump) {
                this.jump();
                this.desiredVelocity.set(0, 0, 0);
            }
            // Handle crouch exit
            else if (inputResult.crouch === 'exit') {
                this.exitCrouch();
            }
            // Handle movement
            else {
                this.desiredVelocity.copy(inputResult.movement);
                this.moveDirection = inputResult.moveDirection;
            }
        }

        // 3. Update movement (if in IDLE/WALK states)
        if (currentState === 'IDLE' || currentState === 'WALK') {
            const targetPos = opp && gameState === 'FIGHT' ? opp.mesh.position : null;
            const movementResult = this.movementSystem.update(
                dt, this.desiredVelocity, this.mesh.position,
                this.mesh.quaternion, targetPos, this.facingOffset, gameState
            );
            
            // Update position
            this.mesh.position.copy(movementResult.position);
            
            // Update locomotion blend based on actual velocity
            if (this.animationSystem) {
                this.animationSystem.updateLocomotionBlend(movementResult.speed, movementResult.direction);
                this.moveDirection = movementResult.direction;
            }
        } else {
            // Clear desired velocity in action states
            this.desiredVelocity.set(0, 0, 0);
        }

        // Update world matrices after rotation to ensure bone positions are correct
        this.mesh.updateMatrixWorld(true);

        this.updateCollisionCapsule();

        try {
            this.updateHitboxes();
        } catch (e) {
            console.error('Error updating hitboxes:', e);
        }

        // Update visualizations
        this.updateHitboxVisualization();
        this.updateCollisionBoxVisualization();

        // 4. Handle state-specific logic
        if (currentState === 'STUN') {
            this.stunTime -= dt;
            if (this.stunTime <= 0) {
                this.stateManager.transitionTo('IDLE');
                this.state = 'IDLE';
                if (this.animationSystem) {
                    this.animationSystem.transitionToBase(CONFIG.animation.crossfade.toBase);
                }
            }
            return;
        }

        if (currentState === 'ATTACK') {
            const currAnim = this.animationSystem?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;
            
            // Process combo system
            if (this.combatSystem.processCombo(this, this.comboQueuedType, ratio)) {
                return;
            }

            // Check if animation finished (handled by AnimationSystem callback, but check as fallback)
            if (!currAnim || !currAnim.isRunning() || this.stateTimer > 2.5) {
                if (this.comboQueuedType && this.comboCount < this.maxCombo) {
                    this.combatSystem.attack(this, this.comboQueuedType, true);
                    return;
                }
                // Animation finished - should be handled by callback, but fallback here
                if (currentState === 'ATTACK') {
                    this.stateManager.transitionTo('IDLE');
                    this.state = 'IDLE';
                    this.atkGroup = null;
                    this.atkLimb = null;
                    this.activeAttackIndices = [];
                    this.comboCount = 0;
                    if (this.animationSystem) {
                        this.animationSystem.transitionToBase(CONFIG.animation.crossfade.toBase);
                    }
                }
            }
            return;
        }

        if (currentState === 'JUMP') {
            const currAnim = this.animationSystem?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;

            if (ratio >= this.jumpCancelStart) {
                // Allow buffering next action mid-jump
                const nextAttack = this.inputController.getAttackType(keys);
                if (nextAttack) {
                    this.combatSystem.attack(this, nextAttack, false);
                    return;
                }
                if (this.inputController && this.inputController.keyDown(keys, 's')) {
                    this.crouch();
                    return;
                }
                if (ratio >= this.jumpAutoEnd) {
                    this.stateManager.transitionTo('IDLE');
                    this.state = 'IDLE';
                    if (this.animationSystem) {
                        this.animationSystem.transitionToBase(CONFIG.animation.crossfade.toBase);
                    }
                    return;
                }
            }

            // Check if animation finished
            if (!currAnim || !currAnim.isRunning() || this.stateTimer > 2.5) {
                if (currentState === 'JUMP') {
                    this.stateManager.transitionTo('IDLE');
                    this.state = 'IDLE';
                    if (this.animationSystem) {
                        this.animationSystem.transitionToBase(CONFIG.animation.crossfade.toBase);
                    }
                }
            }
            return;
        }

        // Crouch state - animation system handles clamping
        if (currentState === 'CROUCH') {
            const currAnim = this.animationSystem?.getCurrentAnimation();
            if (currAnim) {
                const clip = currAnim.getClip();
                if (clip && clip.duration > 0) {
                    if (currAnim.time >= clip.duration) {
                        currAnim.time = clip.duration;
                        currAnim.paused = false;
                    }
                    currAnim.clampWhenFinished = true;
                }
                if (this.animationSystem) {
                    this.animationSystem.preventAutoReturn();
                }
            }
            return;
        }

        // Crouch exiting state - handled by AnimationSystem callback
        if (currentState === 'CROUCH_EXITING') {
            return;
        }

        // Passive stamina regeneration
        if (this.st < this.maxSt) {
            const regenRate = this.characterConfig?.stats?.staminaRegen || 12;
            this.st = Math.min(this.maxSt, this.st + regenRate * dt);
        }
        this.updateUI();

        // 5. Update AI (if AI fighter)
        if (gameState === 'FIGHT' && this.isAI) {
            this.updateAI(dt, opp, collisionSystem);
        }
    }

    checkHit(opp) {
        // Delegate to combat system
        return this.combatSystem.checkHit(this, opp);
    }

    sphereIntersectsSphere(sphere1, sphere2) {
        const distance = sphere1.center.distanceTo(sphere2.center);
        const minDistance = sphere1.radius + sphere2.radius;
        return distance < minDistance;
    }

    /**
     * Calculate movement amount with friction applied based on collision distance
     * @param {number} amount - Base movement amount
     * @param {THREE.Vector3} direction - Normalized movement direction
     * @param {THREE.Vector3} targetPos - Position after movement
     * @param {THREE.Vector3} sourcePos - Position of the other character
     * @param {number} frictionFactor - Friction multiplier when too close
     * @param {number} collisionRadius - This character's collision radius
     * @param {number} otherCollisionRadius - Other character's collision radius
     * @returns {number} - Final movement amount after friction
     */
    calculateMovementWithFriction(amount, direction, targetPos, sourcePos, frictionFactor, collisionRadius, otherCollisionRadius) {
        // Check if movement would cause collision with other character (friction effect)
        const distanceAfterMove = targetPos.distanceTo(sourcePos);
        const minCollisionDistance = collisionRadius + otherCollisionRadius;
        const buffer = CONFIG.combat.movement.collisionBuffer || 1.2;

        // If movement would cause collision, apply friction (reduce movement)
        if (distanceAfterMove < minCollisionDistance * buffer) {
            return amount * frictionFactor;
        }
        return amount;
    }

    /**
     * Apply pushback movement when hit
     * @param {number} amount - Base pushback amount
     * @param {THREE.Vector3} direction - Normalized pushback direction (away from attacker)
     * @param {Fighter} attacker - The attacking fighter
     * @returns {number} - Actual pushback amount applied (after friction)
     */
    applyPushback(amount, direction, attacker) {
        if (!attacker || !attacker.mesh) return 0;

        // Calculate potential new position
        const potentialNewPos = this.mesh.position.clone().add(direction.clone().multiplyScalar(amount));

        // Apply friction if needed
        const frictionFactor = CONFIG.combat.movement.frictionFactor || 0.25;
        const finalAmount = this.calculateMovementWithFriction(
            amount,
            direction,
            potentialNewPos,
            attacker.mesh.position,
            frictionFactor,
            this.collisionRadius,
            attacker.collisionRadius
        );

        const pushVector = direction.clone().multiplyScalar(finalAmount);

        // Apply pushback
        this.mesh.position.add(pushVector);

        // Keep within arena bounds
        if (this.mesh.position.length() > 20) {
            this.mesh.position.setLength(20);
        }

        // Update collision capsule after pushback
        this.updateCollisionCapsule();

        return finalAmount;
    }

    /**
     * Apply forward movement for attacker when hit connects
     * @param {number} amount - Base forward movement amount
     * @param {THREE.Vector3} direction - Normalized forward direction (toward target)
     * @param {Fighter} target - The target fighter
     * @returns {number} - Actual forward movement amount applied (after friction)
     */
    applyForwardMovement(amount, direction, target) {
        if (!target || !target.mesh) return 0;

        // Calculate potential new position
        const potentialNewPos = this.mesh.position.clone().add(direction.clone().multiplyScalar(amount));

        // Apply friction if needed (slightly more friction for forward movement)
        const frictionFactor = CONFIG.combat.movement.forwardFrictionFactor || 0.3;
        const finalAmount = this.calculateMovementWithFriction(
            amount,
            direction,
            potentialNewPos,
            target.mesh.position,
            frictionFactor,
            this.collisionRadius,
            target.collisionRadius
        );

        const forwardVector = direction.clone().multiplyScalar(finalAmount);

        // Apply forward movement
        this.mesh.position.add(forwardVector);

        // Keep within arena bounds
        if (this.mesh.position.length() > 20) {
            this.mesh.position.setLength(20);
        }

        // Update collision capsule after forward movement
        this.updateCollisionCapsule();

        return finalAmount;
    }

    takeDamage(amt, type, attacker) {
        // Delegate to combat system
        const result = this.combatSystem.takeDamage(this, amt, type, attacker);
        // Update state for backward compatibility
        this.state = this.stateManager.getCurrentState();
        return result;
    }

    flashColor() {
        this.mesh.traverse(c => {
            if (c.isMesh) {
                c.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
                setTimeout(() => {
                    if (this.origMats.get(c)) c.material = this.origMats.get(c);
                }, 100);
            }
        });
    }

    getCombatStats(type) {
        const combatConfig = this.characterConfig?.combat || {};
        const configCombat = CONFIG.combat || {};

        if (combatConfig[type]) return combatConfig[type];
        if (configCombat[type]) return configCombat[type];

        if (type === 'leftHand' || type === 'rightHand') {
            return combatConfig.light || configCombat.light;
        }
        if (type === 'leftLeg' || type === 'rightLeg') {
            return combatConfig.heavy || configCombat.heavy;
        }

        return combatConfig.light || configCombat.light || combatConfig.heavy || configCombat.heavy;
    }

    isHeavyAttack(type) {
        return type === 'heavy' || type === 'leftLeg' || type === 'rightLeg';
    }

    attack(type, isChain = false) {
        // Delegate to combat system
        const result = this.combatSystem.attack(this, type, isChain);
        // Update state for backward compatibility
        if (result && !result.queued) {
            this.state = this.stateManager.getCurrentState();
        }
        return result;
    }

    jump() {
        const currentState = this.stateManager.getCurrentState();
        if (currentState !== 'IDLE' && currentState !== 'WALK') return;
        if (!this.actions['jump']) return; // Animation not loaded
        
        // Check if we can interrupt current animation
        if (this.animationSystem && !this.animationSystem.canInterrupt(CONFIG.animation.priorities.JUMP)) {
            return; // Can't interrupt
        }
        
        this.stateManager.transitionTo('JUMP');
        this.state = 'JUMP';
        this.jumpInvulnerabilityTimer = 2.5;
        
        // Use AnimationSystem
        if (this.animationSystem) {
            const jumpDuration = CONFIG.animation.locomotion.jumpDuration || 0.6;
            const jumpCancelWindow = CONFIG.animation.locomotion.jumpCancelWindow || 0.2;
            
            this.currAct = this.animationSystem.playOneShot('jump', {
                priority: CONFIG.animation.priorities.JUMP,
                fadeIn: CONFIG.animation.crossfade.toJump,
                fadeOut: CONFIG.animation.crossfade.toBase,
                autoReturn: true,
                desiredDuration: jumpDuration,
                cancelWindow: jumpCancelWindow,
                onFinished: () => {
                    this.stateManager.transitionTo('IDLE');
                    this.state = 'IDLE';
                    this.currAct = null;
                }
            });
        }
        
        this.logInput('jump');
    }

    crouch() {
        // TEMPORARILY DISABLED: Crouch feature disabled for both player and AI
        return;
        
        const currentState = this.stateManager.getCurrentState();
        // State checks - prevent crouching if in invalid states
        if (currentState === 'ATTACK' || currentState === 'STUN' || currentState === 'DEAD' || currentState === 'WIN') return;
        if (!this.actions['crouch']) return; // Animation not loaded
        if (currentState === 'CROUCH' || currentState === 'CROUCH_EXITING') return; // Already crouched or exiting
        if (currentState !== 'IDLE' && currentState !== 'WALK') return; // Can only crouch from IDLE or WALK
        
        this.stateManager.transitionTo('CROUCH');
        this.state = 'CROUCH';
        
        // Use AnimationSystem
        if (this.animationSystem) {
            this.currAct = this.animationSystem.playOneShot('crouch', {
                priority: CONFIG.animation.priorities.CROUCH,
                fadeIn: CONFIG.animation.crossfade.toCrouch,
                fadeOut: CONFIG.animation.crossfade.toCrouch,
                autoReturn: false, // Don't auto-return, stay crouched
                desiredDuration: this.crouchDuration,
                reverse: false,
                clamp: true,
                loop: false,
                onFinished: () => {
                    // Animation finished - stay clamped at end
                }
            });
        }
        
        this.logInput('crouch');
    }

    exitCrouch() {
        const currentState = this.stateManager.getCurrentState();
        if (currentState !== 'CROUCH') return;
        
        this.stateManager.transitionTo('CROUCH_EXITING');
        this.state = 'CROUCH_EXITING';
        
        // Use AnimationSystem
        if (this.animationSystem) {
            this.currAct = this.animationSystem.playOneShot('crouch', {
                priority: CONFIG.animation.priorities.CROUCH,
                fadeIn: CONFIG.animation.crossfade.toCrouch,
                fadeOut: CONFIG.animation.crossfade.toBase,
                autoReturn: true,
                desiredDuration: this.crouchDuration,
                reverse: true, // KEY: reverse animation
                clamp: false,
                loop: false,
                onFinished: () => {
                    this.stateManager.transitionTo('IDLE');
                    this.state = 'IDLE';
                    this.currAct = null;
                    // Transition back to base locomotion
                    if (this.animationSystem) {
                        this.animationSystem.transitionToBase(CONFIG.animation.crossfade.toBase);
                    }
                }
            });
        }
    }

    logInput(label) {
        this.inputLog.push({ label, t: performance.now() });
        if (this.inputLog.length > 8) this.inputLog.shift();
    }

    updateAI(dt, opp, collisionSystem) {
        // Delegate to AI Controller if available
        if (this.aiController && collisionSystem) {
            this.aiController.updateAI(this, dt, opp, collisionSystem);
        } else {
            // Fallback to simple AI if controller not available
            console.warn('AI Controller not available, using fallback AI');
            const dist = this.mesh.position.distanceTo(opp.mesh.position);
            const currentState = this.stateManager?.getCurrentState() || this.state;
            if (dist < 2.5 && currentState === 'IDLE' && Math.random() < 0.3) {
                const attacks = ['leftHand', 'rightHand', 'leftLeg', 'rightLeg'];
                const attackType = attacks[Math.floor(Math.random() * attacks.length)];
                this.combatSystem.attack(this, attackType);
            } else if (dist > 2.5) {
                const dir = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position).normalize();
                this.desiredVelocity.copy(dir).multiplyScalar(this.moveSpeed);
            }
            if (this.mesh.position.length() > 20) this.mesh.position.setLength(20);
        }
    }

    updateUI() {
        const hpPercent = this.maxHp > 0 ? Math.max(0, (this.hp / this.maxHp) * 100) : 0;
        const stPercent = this.maxSt > 0 ? Math.max(0, (this.st / this.maxSt) * 100) : 0;
        const hpEl = document.getElementById(this.id + '-hp');
        const stEl = document.getElementById(this.id + '-st');
        if (hpEl) hpEl.style.width = `${hpPercent}%`;
        if (stEl) stEl.style.width = `${stPercent}%`;
    }

    /**
     * Dispose of all THREE.js resources and clean up fighter
     * Call this before removing fighters to prevent memory leaks and duplicates
     */
    dispose() {
        // Stop animation mixer and dispose actions
        if (this.mixer) {
            // Stop all actions
            Object.values(this.actions).forEach(action => {
                if (action) {
                    action.stop();
                    action.reset();
                }
            });
            // Clear actions
            this.actions = {};
            // Uncache root from mixer
            if (this.mixer.uncacheRoot) {
                this.mixer.uncacheRoot(this.mesh);
            }
        }

        // Remove mesh from scene and dispose materials/geometries
        if (this.mesh) {
            // Remove from parent scene
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
            
            // Dispose all materials and geometries in the mesh tree
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    // Dispose geometry
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    // Dispose material(s)
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat.map) mat.map.dispose();
                                mat.dispose();
                            });
                        } else {
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    }
                }
            });
        }

        // Remove and dispose hitbox visualization
        if (this.hitboxVisualization) {
            if (this.hitboxVisualization.parent) {
                this.hitboxVisualization.parent.remove(this.hitboxVisualization);
            }
            this.hitboxVisualization.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.hitboxVisualization = null;
        }

        // Remove and dispose collision box visualization
        if (this.collisionBoxVisualization) {
            if (this.collisionBoxVisualization.parent) {
                this.collisionBoxVisualization.parent.remove(this.collisionBoxVisualization);
            }
            this.collisionBoxVisualization.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.collisionBoxVisualization = null;
        }

        // Clear subsystems (they don't need explicit disposal, just null references)
        this.animationSystem = null;
        this.animationController = null;
        this.movementSystem = null;
        this.inputController = null;
        this.combatSystem = null;
        this.stateManager = null;
        this.motionController = null;
        this.aiController = null;

        // Clear all references
        this.mesh = null;
        this.mixer = null;
        this.actions = {};
        this.origMats = null;
        this.bones = {};
        this.hurtSpheres = null;
        this.attackSpheres = null;
    }
}

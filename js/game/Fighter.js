import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { BoneDiscovery } from '../utils/BoneDiscovery.js';
import { HitboxSystem } from '../utils/HitboxSystem.js';
import { AIController } from './AIController.js';
import { AnimationController } from '../systems/AnimationController.js';
import { MotionController } from '../systems/MotionController.js';
import { AnimationStateMachine } from '../systems/AnimationStateMachine.js';
import { LocomotionBlender } from '../systems/LocomotionBlender.js';

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
        
        // Animation system - will be initialized after animations load
        this.animationController = null;
        this.animationStateMachine = null;
        this.locomotionBlender = null;
        
        // Motion system
        const motionConfig = CONFIG.animation?.motion || {};
        motionConfig.maxSpeed = this.moveSpeed;
        this.motionController = new MotionController(motionConfig);
        this.desiredVelocity = new THREE.Vector3();
        
        // Crouch duration (unified timing)
        this.crouchDuration = CONFIG.animation?.locomotion?.crouchDuration || 0.5;

        this.state = 'IDLE';
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
        const headRadius = (characterConfig?.hitboxes?.head || 0.28);
        const torsoRadius = (characterConfig?.hitboxes?.torso || 0.4);

        this.hurtSpheres = {
            head: new THREE.Sphere(new THREE.Vector3(), headRadius),
            torso: new THREE.Sphere(new THREE.Vector3(), torsoRadius)
        };
        this.baseHurtRadii = {
            head: this.hurtSpheres.head.radius,
            torso: this.hurtSpheres.torso.radius
        };

        // Multi-sphere attack hitboxes: each hand has fist+elbow, each leg has foot+knee
        // Made much bigger for easier hits
        const handSizes = characterConfig?.hitboxes?.attackHands || [0.32, 0.28, 0.32, 0.28];
        const legSizes = characterConfig?.hitboxes?.attackLegs || [0.38, 0.32, 0.38, 0.32];

        this.attackSpheres = {
            hands: [
                new THREE.Sphere(new THREE.Vector3(), handSizes[0] || 0.25), // Left hand - fist
                new THREE.Sphere(new THREE.Vector3(), handSizes[1] || 0.22), // Left hand - elbow
                new THREE.Sphere(new THREE.Vector3(), handSizes[2] || 0.25), // Right hand - fist
                new THREE.Sphere(new THREE.Vector3(), handSizes[3] || 0.22)  // Right hand - elbow
            ],
            legs: [
                new THREE.Sphere(new THREE.Vector3(), legSizes[0] || 0.28), // Left leg - foot
                new THREE.Sphere(new THREE.Vector3(), legSizes[1] || 0.24), // Left leg - knee
                new THREE.Sphere(new THREE.Vector3(), legSizes[2] || 0.28), // Right leg - foot
                new THREE.Sphere(new THREE.Vector3(), legSizes[3] || 0.24)  // Right leg - knee
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
        
        this.state = 'IDLE';
        // Start with idle via animation controller
        if (this.animationController) {
            this.animationController.updateLocomotionBlend(0, 1);
        } else {
            // Fallback to old system
            this.play('idle', 0);
        }
    }
    
    /**
     * Initialize animation system components
     */
    initializeAnimationSystem() {
        // Animation controller config
        // NOTE: Do NOT pass character config playbackSpeed here - handle all speed calculations in Fighter methods
        // This prevents conflicts with combo speed calculations
        const animConfig = {
            priorities: CONFIG.animation?.priorities,
            crossfade: CONFIG.animation?.crossfade,
            locomotion: CONFIG.animation?.locomotion,
            playbackSpeed: {} // Empty - speeds are calculated in Fighter.attack() and passed via timeScale option
        };
        
        // Initialize AnimationController
        this.animationController = new AnimationController(this.mixer, this.actions, animConfig);
        
        // Initialize AnimationStateMachine
        const stateMachineConfig = {
            priorities: CONFIG.animation?.priorities
        };
        this.animationStateMachine = new AnimationStateMachine(stateMachineConfig);
        this.animationStateMachine.setCurrentState('LOCOMOTION');
        
        // Initialize LocomotionBlender
        const locomotionConfig = CONFIG.animation?.locomotion || {};
        this.locomotionBlender = new LocomotionBlender(locomotionConfig);
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
            const midY = (this.collisionStart.y + this.collisionEnd.y) * 0.5;
            cylinder.position.y = midY;
        }

        // Position the whole group at the mesh's x/z position
        this.collisionBoxVisualization.position.x = this.mesh.position.x;
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

    play(name, fade = null, reverse = false, isCombo = false) {
        const next = this.actions[name];
        if (!next) return;
        const fadeTime = (fade === null || fade === undefined) ? this.animationFade : fade;

        // Get playback speed from config (default to 1.5x for attack animations, 1.0 for others)
        let baseSpeed = 1.0;
        const isAttackAnim =
            name === 'atk1' ||
            name === 'atk2' ||
            name.startsWith('atk1_') ||
            name.startsWith('atk2_') ||
            name.toLowerCase().includes('punch') ||
            name.toLowerCase().includes('kick');
        if (isAttackAnim) {
            // Slow legs slightly compared to punches
            const lower = name.toLowerCase();
            const isLeg = lower.includes('kick') || lower.includes('atk2');
            baseSpeed = isLeg ? 3.0 : 3.5;
        } else if (name === 'jump' || name === 'crouch') {
            baseSpeed = 5.0; // Much faster defensive animations
        }
        // Apply character config as multiplier to BASE speed only (if exists)
        // Character config should not override combo speeds
        let playbackSpeed = baseSpeed;
        const charConfigSpeed = this.characterConfig?.animationSettings?.playbackSpeed?.[name];
        if (charConfigSpeed && !isCombo) {
            // Only apply character config to initial attacks, use as multiplier
            playbackSpeed *= charConfigSpeed;
        }
        
        // Apply combo speed multiplier for combo attacks (subsequent hits in a combo)
        if (isCombo && isAttackAnim) {
            const comboMultiplier = CONFIG.combat.comboSpeedMultiplier || 17.1;
            playbackSpeed *= comboMultiplier;
        }

        // If same animation is already playing, just update direction if needed
        if (this.currAct === next) {
            const currentTimeScale = next.timeScale || playbackSpeed;
            const targetSpeed = reverse ? -playbackSpeed : playbackSpeed;
            const needsReverse = reverse && currentTimeScale !== -playbackSpeed;
            const needsForward = !reverse && currentTimeScale !== playbackSpeed;

            if (needsReverse || needsForward) {
                // Reverse the animation direction smoothly
                const clip = next.getClip();
                const currentTime = next.time;
                const duration = clip.duration;

                if (needsReverse) {
                    // Switch from forward to reverse
                    next.timeScale = -playbackSpeed;
                    next.time = duration - currentTime;
                } else {
                    // Switch from reverse to forward
                    next.timeScale = playbackSpeed;
                    next.time = duration - currentTime;
                }
            }
            return;
        }

        // New animation - fade in
        next.reset().fadeIn(fadeTime).play();
        if (reverse) {
            next.timeScale = -playbackSpeed;
            next.time = next.getClip().duration; // Start from end when reversed
        } else {
            next.timeScale = playbackSpeed;
            next.time = 0; // Start from beginning when forward
        }
        if (this.currAct) this.currAct.fadeOut(fadeTime);
        this.currAct = next;
    }

    applyPlaybackCurves() {
        if (!this.currAct) return;
        const clip = this.currAct.getClip();
        if (!clip || clip.duration <= 0) return;

        const clipName = clip.name?.toLowerCase() || '';
        const isJump = clipName.includes('jump');

        // Only apply curves to jump (crouch is now looping, so keep constant speed)
        if (!isJump) return;

        const ratio = Math.min(Math.max(this.currAct.time / clip.duration, 0), 1);

        // Fast at start, ease down toward end (quadratic ease-out)
        const startSpeed = 6.0;
        const endSpeed = 2.8;
        const ease = Math.pow(1 - ratio, 2); // 1 at start, 0 at end
        const targetSpeed = endSpeed + (startSpeed - endSpeed) * ease;

        const direction = this.currAct.timeScale < 0 ? -1 : 1;
        this.currAct.timeScale = direction * targetSpeed;
    }

    update(dt, opp, gameState, keys = {}, camera = null, collisionSystem = null, inputHandler = null) {
        // Update animation controller
        if (this.animationController) {
            this.animationController.update(dt);
        }
        
        // Update mixer
        this.mixer.update(dt);
        
        // Update playback curves (for jump)
        this.applyPlaybackCurves();

        if (this.prevState !== this.state) {
            this.stateTimer = 0;
            this.prevState = this.state;
        } else {
            this.stateTimer += dt;
        }
        
        if (this.state === 'JUMP') {
            // Hold invuln at start until animation moves a bit
            const currAnim = this.animationController?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;
            const shouldTick = ratio > 0.08; // don't burn invuln before lift-off
            if (shouldTick) {
                // Decay slower to lengthen invulnerability during airborne startup
                const decayRate = ratio < 0.8 ? 0.3 : 0.6;
                this.jumpInvulnerabilityTimer = Math.max(0, this.jumpInvulnerabilityTimer - dt * decayRate);
            }
        } else {
            this.jumpInvulnerabilityTimer = 0;
        }

        if (!this.isAI && this.state === 'ATTACK') {
            const queuedAttack = this.getAttackInput(keys);
            if (queuedAttack) {
                this.comboQueuedType = queuedAttack;
            }
        }

        if (gameState !== 'FIGHT' && gameState !== 'OVER') return;
        if (this.state === 'DEAD' || this.state === 'WIN') return;

        // Update motion controller for smooth movement
        if (this.state === 'IDLE' || this.state === 'WALK') {
            // Only allow movement in IDLE/WALK states
            this.motionController.update(dt, this.desiredVelocity, this.mesh.position);
            this.mesh.position.copy(this.motionController.position);
            
            // Update locomotion blend based on actual velocity
            if (this.animationController) {
                const speedNorm = this.motionController.getNormalizedSpeed();
                const direction = this.motionController.getMovementDirection(this.mesh.quaternion);
                this.animationController.updateLocomotionBlend(speedNorm, direction);
                this.moveDirection = direction;
            }
        } else {
            // Clear desired velocity in action states
            this.desiredVelocity.set(0, 0, 0);
        }

        // Smooth rotation toward opponent
        if (gameState === 'FIGHT' && opp) {
            const target = opp.mesh.position.clone();
            target.y = this.mesh.position.y;
            
            // Calculate target quaternion
            const targetQuat = new THREE.Quaternion();
            const lookMatrix = new THREE.Matrix4().lookAt(this.mesh.position, target, this.upVector);
            targetQuat.setFromRotationMatrix(lookMatrix);
            targetQuat.multiply(this.facingOffset);
            
            // Smooth rotation via MotionController
            const turnSpeed = CONFIG.animation?.motion?.turnSpeed || 10.0;
            this.motionController.updateRotation(this.mesh.quaternion, targetQuat, dt, turnSpeed);
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

        if (this.state === 'STUN') {
            this.stunTime -= dt;
            if (this.stunTime <= 0) {
                this.state = 'IDLE';
                if (this.animationController) {
                    this.animationController.transitionToBase(CONFIG.animation.crossfade.toBase);
                } else {
                    this.play('idle', this.animationFade);
                }
            }
            return;
        }

        if (this.state === 'ATTACK') {
            const currAnim = this.animationController?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;
            const withinCombo = ratio >= this.comboWindowStart && ratio <= this.comboWindowEnd;
            this.comboWindowOpen = withinCombo;

            if (this.comboQueuedType && this.comboCount < this.maxCombo && (withinCombo || ratio >= this.comboWindowEnd)) {
                const nextType = this.comboQueuedType;
                this.comboQueuedType = null;
                this.comboWindowOpen = false;
                this.attack(nextType, true);
                return;
            }

            // Check if animation finished (handled by AnimationController callback, but check as fallback)
            if (!currAnim || !currAnim.isRunning() || this.stateTimer > 2.5) {
                if (this.comboQueuedType && this.comboCount < this.maxCombo) {
                    const nextType = this.comboQueuedType;
                    this.comboQueuedType = null;
                    this.comboWindowOpen = false;
                    this.attack(nextType, true);
                    return;
                }
                // Animation finished - should be handled by callback, but fallback here
                if (this.state === 'ATTACK') {
                    this.state = 'IDLE';
                    this.atkGroup = null;
                    this.atkLimb = null;
                    this.activeAttackIndices = [];
                    this.comboCount = 0;
                    if (this.animationController) {
                        this.animationController.transitionToBase(CONFIG.animation.crossfade.toBase);
                    } else {
                        this.play('idle', this.animationFade);
                    }
                }
            }
            return;
        }

        if (this.state === 'JUMP') {
            const currAnim = this.animationController?.getCurrentAnimation() || this.currAct;
            const clip = currAnim?.getClip();
            const ratio = clip && clip.duration > 0 ? currAnim.time / clip.duration : 1;

            if (this.state === 'JUMP' && ratio >= this.jumpCancelStart) {
                // Allow buffering next action mid-jump
                const nextAttack = this.getAttackInput(keys);
                if (nextAttack) {
                    this.attack(nextAttack);
                    return;
                }
                if (this.keyDown(keys, 's')) {
                    this.crouch();
                    return;
                }
                if (ratio >= this.jumpAutoEnd) {
                    this.state = 'IDLE';
                    if (this.animationController) {
                        this.animationController.transitionToBase(CONFIG.animation.crossfade.toBase);
                    } else {
                        this.play('idle', this.animationFade);
                    }
                    return;
                }
            }

            // Check if animation finished (handled by AnimationController callback, but check as fallback)
            if (!currAnim || !currAnim.isRunning() || this.stateTimer > 2.5) {
                if (this.state === 'JUMP') {
                    this.state = 'IDLE';
                    if (this.animationController) {
                        this.animationController.transitionToBase(CONFIG.animation.crossfade.toBase);
                    } else {
                        this.play('idle', this.animationFade);
                    }
                }
            }
            return;
        }

        // Crouch state - animation controller handles clamping
        if (this.state === 'CROUCH') {
            // Animation controller keeps animation at end when clamped
            // Ensure animation stays clamped at end
            const currAnim = this.animationController?.getCurrentAnimation();
            if (currAnim) {
                const clip = currAnim.getClip();
                if (clip && clip.duration > 0) {
                    // Keep animation at the end if it's finished
                    if (currAnim.time >= clip.duration) {
                        currAnim.time = clip.duration;
                        currAnim.paused = false; // Keep it running (but clamped)
                    }
                    // Ensure clamp is set
                    currAnim.clampWhenFinished = true;
                }
                // Make sure the action layer knows not to auto-return
                if (this.animationController) {
                    this.animationController.preventAutoReturn();
                }
            }
            // Keep checking if S is still held in updateInput
            return;
        }

        // Crouch exiting state - handled by AnimationController callback
        if (this.state === 'CROUCH_EXITING') {
            // Animation controller will call onFinished callback when reverse animation completes
            return;
        }

        // Passive stamina regeneration - stamina recharges slowly over time
        if (this.st < this.maxSt) {
            const regenRate = this.characterConfig?.stats?.staminaRegen || 12;
            this.st = Math.min(this.maxSt, this.st + regenRate * dt);
        }
        this.updateUI();

        if (gameState === 'FIGHT') {
            if (this.isAI) {
                this.updateAI(dt, opp, collisionSystem);
            } else {
                this.updateInput(dt, keys, camera, inputHandler);
            }
        }
    }

    checkHit(opp) {
        if (this.hitRegistered) return null;
        if (this.state !== 'ATTACK') return null;

        try {
            this.updateHitboxes();
            opp.updateHitboxes();
        } catch (e) {
            console.error('Error updating hitboxes in checkHit:', e);
            return null;
        }
        
        // Get current animation (from AnimationController or fallback)
        const currAnim = this.animationController?.getCurrentAnimation() || this.currAct;

        let attackSpheres = null;
        if (this.atkGroup === 'hands') {
            attackSpheres = this.attackSpheres.hands || [];
        } else if (this.atkGroup === 'legs') {
            attackSpheres = this.attackSpheres.legs || [];
        } else if (this.atkType === 'light' || this.atkType === 'heavy') {
            // Fallback for legacy attack types
            attackSpheres = this.atkType === 'light' ? (this.attackSpheres.hands || []) : (this.attackSpheres.legs || []);
        }

        if (!attackSpheres || attackSpheres.length === 0) return null;

        const activeIndices = (Array.isArray(this.activeAttackIndices) && this.activeAttackIndices.length > 0)
            ? this.activeAttackIndices
            : attackSpheres.map((_, i) => i);

        const canHitHead = opp.state !== 'CROUCH' && opp.state !== 'CROUCH_EXITING';
        const canHitTorso = !(opp.state === 'JUMP' && opp.jumpInvulnerabilityTimer > 0);

        let hit = false;

        for (const i of activeIndices) {
            const attackSphere = attackSpheres[i];

            if (!attackSphere ||
                attackSphere.center.x === Infinity ||
                attackSphere.center.y === Infinity ||
                attackSphere.center.z === Infinity) {
                continue;
            }

            const headHit = canHitHead && this.sphereIntersectsSphere(attackSphere, opp.hurtSpheres.head);
            const torsoHit = canHitTorso && this.sphereIntersectsSphere(attackSphere, opp.hurtSpheres.torso);

            if (headHit || torsoHit) {
                hit = true;
                break;
            }
        }

        if (!hit) return null;

        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        const dir = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position).normalize();
        const dot = fwd.dot(dir);

        if (dot <= CONFIG.combat.hitAngle) return null;

        this.hitRegistered = true;
        const combatStats = this.getCombatStats(this.atkType);
        const damage = combatStats?.dmg ?? 0;
        const impactPos = opp.mesh.position.clone();
        impactPos.y += opp.collisionHeight * 0.5;
        
        // Apply damage and get pushback amount
        const damageResult = opp.takeDamage(damage, this.atkType, this);
        const pushbackAmount = damageResult.pushbackAmount || 0;

        // Apply forward movement for attacker to maintain combo range
        if (pushbackAmount > 0 && opp.mesh) {
            // Calculate forward direction (toward target)
            const forwardDirection = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position);
            forwardDirection.y = 0; // Keep movement horizontal
            if (forwardDirection.lengthSq() > 0) {
                forwardDirection.normalize();
                
                // Get forward movement ratio from config based on attack type
                const isHeavy = this.isHeavyAttack(this.atkType);
                const basePushAmount = isHeavy 
                    ? CONFIG.combat.movement.pushback.heavy 
                    : CONFIG.combat.movement.pushback.light;
                const baseForwardAmount = isHeavy 
                    ? CONFIG.combat.movement.forward.heavy 
                    : CONFIG.combat.movement.forward.light;
                
                // Calculate forward amount: scale base forward amount by the ratio of actual pushback to base pushback
                // This ensures forward movement is proportional to the actual pushback applied (after friction)
                const pushbackRatio = basePushAmount > 0 ? pushbackAmount / basePushAmount : 0;
                const forwardAmount = baseForwardAmount * pushbackRatio;
                
                // Apply forward movement
                this.applyForwardMovement(forwardAmount, forwardDirection, opp);
            }
        }

        // Gain stamina when landing a successful hit - more stamina for heavier hits
        const staminaGain = this.isHeavyAttack(this.atkType) ? 15 : 8; // Heavy hits give more stamina
        this.st = Math.min(this.maxSt, this.st + staminaGain);
        this.updateUI();

        return {
            attacker: this,
            target: opp,
            atkType: this.atkType,
            damage,
            position: impactPos
        };
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
        this.hp = Math.max(0, this.hp - amt);
        // Gain stamina when getting hit - more stamina for heavier hits
        const staminaGainOnHit = this.isHeavyAttack(type) ? 20 : 12;
        this.st = Math.min(this.maxSt, this.st + staminaGainOnHit);
        
        // Pushback when hit - push away from attacker with friction
        let pushbackAmount = 0;
        if (attacker && attacker.mesh) {
            const pushDirection = new THREE.Vector3().subVectors(this.mesh.position, attacker.mesh.position);
            pushDirection.y = 0; // Keep pushback horizontal
            if (pushDirection.lengthSq() > 0) {
                pushDirection.normalize();
                
                // Get pushback amount from config based on attack type
                const isHeavy = this.isHeavyAttack(type);
                const basePushAmount = isHeavy 
                    ? CONFIG.combat.movement.pushback.heavy 
                    : CONFIG.combat.movement.pushback.light;
                
                // Apply pushback using centralized method
                pushbackAmount = this.applyPushback(basePushAmount, pushDirection, attacker);
            }
        }
        
        if (this.hp <= 0) {
            this.state = 'DEAD';
            if (this.animationController) {
                this.animationController.playOneShot('die', 
                    CONFIG.animation.crossfade.toBase, 
                    CONFIG.animation.crossfade.toBase,
                    {
                        priority: CONFIG.animation.priorities.DEAD,
                        autoReturn: false,
                        clamp: true
                    });
            } else {
                this.play('die', this.animationFade);
            }
        } else {
            this.state = 'STUN';
            this.stunTime = 0.5;
            if (this.animationController) {
                this.animationController.playOneShot('hit', 
                    CONFIG.animation.crossfade.toHit, 
                    CONFIG.animation.crossfade.toBase,
                    {
                        priority: CONFIG.animation.priorities.HIT,
                        autoReturn: true,
                        onFinished: () => {
                            // Will transition to IDLE when stun time expires
                        }
                    });
            } else {
                this.play('hit', this.animationFade);
            }
        }
        this.flashColor();
        this.updateUI();
        
        // Return both state and pushback amount for combo system
        return { state: this.state, pushbackAmount };
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
        const attackMap = {
            leftHand: { animations: ['punchL', 'atk1_left', 'atk1'], group: 'hands', indices: [0, 1], limb: 'left' },
            rightHand: { animations: ['punchR', 'atk1_right', 'atk1'], group: 'hands', indices: [2, 3], limb: 'right' },
            leftLeg: { animations: ['kickL', 'atk2_left', 'atk2'], group: 'legs', indices: [0, 1], limb: 'left' },
            rightLeg: { animations: ['kickR', 'atk2_right', 'atk2'], group: 'legs', indices: [2, 3], limb: 'right' },
            // Legacy/fallback types
            light: { animations: ['atk1'], group: 'hands', indices: [0, 1, 2, 3], limb: 'any' },
            heavy: { animations: ['atk2'], group: 'legs', indices: [0, 1, 2, 3], limb: 'any' }
        };

        const attackInfo = attackMap[type];
        if (!attackInfo) return;

        // If already attacking and not a chain, queue for combo
        if (this.state === 'ATTACK' && !isChain) {
            this.comboQueuedType = type; // buffer for combo
            this.logInput(`queue:${type}`);
            return;
        }

        // Get animation candidates first to check if we can play
        const animCandidates = attackInfo.animations || [];
        const chosenAnim = animCandidates.find(name => this.actions[name]) || animCandidates[0];
        
        // Check if animation exists
        if (!chosenAnim || !this.actions[chosenAnim]) {
            // Animation not found - can't attack
            return;
        }
        
        // Note: Removed the same-animation check here - AnimationController.playOneShot()
        // already handles this check and will return null if the animation is actively running.
        // This allows retriggering the same animation after it finishes.
        
        // Check stamina BEFORE setting state (to prevent double attacks)
        const combatStats = this.getCombatStats(type);
        const cost = combatStats?.cost ?? 0;
        if (this.st < cost) return;
        
        // Set state to ATTACK IMMEDIATELY to prevent multiple simultaneous calls
        // This must happen before any async operations or animation checks
        this.state = 'ATTACK';
        
        // Now deduct stamina (state is already set, so subsequent calls will be queued)
        this.st -= cost;
        this.atkType = type;
        this.atkGroup = attackInfo.group;
        this.atkLimb = attackInfo.limb;
        this.activeAttackIndices = attackInfo.indices || [];
        this.hitRegistered = false;
        this.comboQueuedType = null;
        this.comboWindowOpen = false;
        this.comboCount = isChain ? Math.min(this.comboCount + 1, this.maxCombo) : 1;
        
        // Use AnimationController if available
        if (this.animationController) {
            const priority = isChain ? CONFIG.animation.priorities.ATK2 : CONFIG.animation.priorities.ATK1;
            const fadeIn = isChain ? CONFIG.animation.crossfade.withinCombo : CONFIG.animation.crossfade.toAttack;
            const fadeOut = isChain ? CONFIG.animation.crossfade.withinCombo : CONFIG.animation.crossfade.toBase;
            
            // Calculate playback speed - COMPLETE REFACTOR: handle ALL speed logic here
            const isLeg = chosenAnim.toLowerCase().includes('kick') || chosenAnim.toLowerCase().includes('atk2');
            
            // Base speeds: Initial attacks are 3.5x (hands) and 3.0x (legs)
            let playbackSpeed = isLeg ? 3.0 : 3.5;
            
            // Apply combo multiplier if this is a combo attack
            // Combo attacks are MUCH faster: 60.0x (hands) and 50.0x (legs)
            if (isChain) {
                // Direct calculation: combo multiplier makes combos ~17x faster
                const comboMultiplier = CONFIG.combat.comboSpeedMultiplier || 17.1;
                playbackSpeed *= comboMultiplier;
            } else {
                // For initial attacks only: apply character config as multiplier (if exists)
                // Check multiple possible animation names that might match
                const animVariants = [chosenAnim, type, attackInfo.group === 'hands' ? 'atk1' : 'atk2'];
                for (const animName of animVariants) {
                    const charSpeed = this.characterConfig?.animationSettings?.playbackSpeed?.[animName];
                    if (charSpeed !== undefined) {
                        playbackSpeed *= charSpeed;
                        break; // Use first match found
                    }
                }
            }
            
            this.currAct = this.animationController.playOneShot(chosenAnim, fadeIn, fadeOut, {
                priority: priority,
                autoReturn: true,
                timeScale: playbackSpeed,
                onFinished: () => {
                    this.state = 'IDLE';
                    this.atkGroup = null;
                    this.atkLimb = null;
                    this.activeAttackIndices = [];
                    this.comboCount = 0;
                    this.currAct = null;
                }
            });
            
            if (!this.currAct) {
                // Animation couldn't play - refund stamina and reset state
                this.st += cost; // Refund the stamina since attack didn't happen
                this.state = 'IDLE';
            }
        } else {
            // Fallback to old system
            const fade = isChain ? Math.min(this.animationFade, 0.05) : this.animationFade;
            this.play(chosenAnim, fade, false, isChain);
            if (!this.actions[chosenAnim]) {
                // Animation not found - refund stamina and reset state
                this.st += cost; // Refund the stamina since attack didn't happen
                this.state = 'IDLE';
            }
        }
        
        this.logInput(`atk${isChain ? ' (chain)' : ''}:${type}`);
    }

    jump() {
        if (this.state !== 'IDLE' && this.state !== 'WALK') return;
        if (!this.actions['jump']) return; // Animation not loaded
        
        // Check if we can interrupt current animation
        if (this.animationController && !this.animationController.canInterrupt(CONFIG.animation.priorities.JUMP)) {
            return; // Can't interrupt
        }
        
        this.state = 'JUMP';
        this.jumpInvulnerabilityTimer = 2.5;
        
        // Use AnimationController if available
        if (this.animationController) {
            const jumpDuration = CONFIG.animation.locomotion.jumpDuration || 0.6;
            const jumpCancelWindow = CONFIG.animation.locomotion.jumpCancelWindow || 0.2;
            
            this.currAct = this.animationController.playOneShot('jump', 
                CONFIG.animation.crossfade.toJump, 
                CONFIG.animation.crossfade.toBase, 
                {
                    priority: CONFIG.animation.priorities.JUMP,
                    autoReturn: true,
                    desiredDuration: jumpDuration,
                    cancelWindow: jumpCancelWindow,
                    onFinished: () => {
                        this.state = 'IDLE';
                        this.currAct = null;
                    }
                });
        } else {
            // Fallback to old system
            this.play('jump', this.animationFade);
        }
        
        this.logInput('jump');
    }

    crouch() {
        // State checks - prevent crouching if in invalid states
        if (this.state === 'ATTACK' || this.state === 'STUN' || this.state === 'DEAD' || this.state === 'WIN') return;
        if (!this.actions['crouch']) return; // Animation not loaded
        if (this.state === 'CROUCH' || this.state === 'CROUCH_EXITING') return; // Already crouched or exiting
        if (this.state !== 'IDLE' && this.state !== 'WALK') return; // Can only crouch from IDLE or WALK
        
        this.state = 'CROUCH';
        
        // Use AnimationController if available
        if (this.animationController) {
            // Simply play the crouch animation - let AnimationController handle all logic
            // If already playing and clamped, playOneShot will return null, but that's fine
            // because the state check above prevents this from being called when already crouched
            this.currAct = this.animationController.playOneShot('crouch', 
                CONFIG.animation.crossfade.toCrouch, 
                CONFIG.animation.crossfade.toCrouch, 
                {
                    priority: CONFIG.animation.priorities.CROUCH,
                    autoReturn: false, // Don't auto-return, stay crouched
                    desiredDuration: this.crouchDuration,
                    reverse: false,
                    clamp: true,
                    loop: false,
                    onFinished: () => {
                        // Animation finished - stay clamped at end (handled by AnimationController.update)
                        // Keep CROUCH state active
                    }
                });
        } else {
            // Fallback to old system
            this.play('crouch', this.animationFade, false);
        }
        
        this.logInput('crouch');
    }

    exitCrouch() {
        if (this.state !== 'CROUCH') return;
        
        this.state = 'CROUCH_EXITING';
        
        // Use AnimationController if available
        if (this.animationController) {
            this.currAct = this.animationController.playOneShot('crouch', 
                CONFIG.animation.crossfade.toCrouch, 
                CONFIG.animation.crossfade.toBase, 
                {
                    priority: CONFIG.animation.priorities.CROUCH,
                    autoReturn: true,
                    desiredDuration: this.crouchDuration,
                    reverse: true, // KEY: reverse animation
                    clamp: false,
                    loop: false,
                    onFinished: () => {
                        this.state = 'IDLE';
                        this.currAct = null;
                        // Transition back to base locomotion
                        if (this.animationController) {
                            this.animationController.transitionToBase(CONFIG.animation.crossfade.toBase);
                        }
                    }
                });
        } else {
            // Fallback to old system
            this.play('crouch', this.animationFade, true);
        }
    }

    getAttackInput(keys) {
        if (keys['ArrowLeft']) return 'leftHand';
        if (keys['ArrowUp']) return 'rightHand';
        if (keys['ArrowDown']) return 'leftLeg';
        if (keys['ArrowRight']) return 'rightLeg';
        return null;
    }

    keyDown(keys, key) {
        if (!keys) return false;
        return !!(keys[key] || keys[key.toLowerCase?.()] || keys[key.toUpperCase?.()]);
    }

    logInput(label) {
        this.inputLog.push({ label, t: performance.now() });
        if (this.inputLog.length > 8) this.inputLog.shift();
    }

    updateInput(dt, keys, camera, inputHandler = null) {
        // If already crouched or exiting, handle that first
        if (this.state === 'CROUCH') {
            // Check for crouch release (S key)
            const isCrouchHeld = this.keyDown(keys, 's');
            if (!isCrouchHeld) {
                // Exit crouch if S is released while in CROUCH state
                this.exitCrouch();
                return; // Don't process other inputs while exiting crouch
            }
            // While crouched, can't move or attack
            this.desiredVelocity.set(0, 0, 0);
            return; // Don't process other inputs while crouched
        }
        
        if (this.state === 'CROUCH_EXITING') {
            // While exiting crouch, can't move or attack
            this.desiredVelocity.set(0, 0, 0);
            return; // Don't process other inputs while exiting
        }
        
        // Check for crouch - use edge detection to enter (only trigger once per key press)
        // But use keyDown check to stay crouched (key is held)
        if (inputHandler && (this.state === 'IDLE' || this.state === 'WALK')) {
            // Only enter crouch on initial key press (edge-triggered)
            if (inputHandler.consumeKey('s')) {
                this.crouch();
                return; // Don't process other inputs while entering crouch
            }
        }

        // Attack controls (only when not crouched) - use edge-triggered input
        if (inputHandler) {
            // Use edge-triggered input detection (consumes key press, prevents multiple triggers)
            if (inputHandler.consumeKey('ArrowLeft')) {
                this.attack('leftHand');
                this.desiredVelocity.set(0, 0, 0);
                return;
            }
            if (inputHandler.consumeKey('ArrowUp')) {
                this.attack('rightHand');
                this.desiredVelocity.set(0, 0, 0);
                return;
            }
            if (inputHandler.consumeKey('ArrowDown')) {
                this.attack('leftLeg');
                this.desiredVelocity.set(0, 0, 0);
                return;
            }
            if (inputHandler.consumeKey('ArrowRight')) {
                this.attack('rightLeg');
                this.desiredVelocity.set(0, 0, 0);
                return;
            }
        } else {
            // Fallback to old system if inputHandler not available
            const attackInput = this.getAttackInput(keys);
            if (attackInput) { 
                this.attack(attackInput); 
                // Clear movement when attacking
                this.desiredVelocity.set(0, 0, 0);
                return; 
            }
        }
        
        // W = Jump
        if (this.keyDown(keys, 'w')) { 
            this.jump(); 
            // Clear movement when jumping
            this.desiredVelocity.set(0, 0, 0);
            return; 
        }

        // Get character's forward direction (toward opponent)
        const charForward = new THREE.Vector3(0, 0, 1);
        charForward.applyQuaternion(this.mesh.quaternion);
        charForward.y = 0;
        charForward.normalize();

        // A/D = Move back and forth (toward/away from opponent)
        // D = move forward (toward opponent), A = move backward (away from opponent)
        let mov = new THREE.Vector3();
        let isBackward = false;
        
        if (this.keyDown(keys, 'd')) {
            mov.addScaledVector(charForward, 1); // Move toward opponent
            isBackward = false;
        }
        if (this.keyDown(keys, 'a')) {
            mov.addScaledVector(charForward, -1); // Move away from opponent
            isBackward = true;
        }

        // Set desired velocity for MotionController
        if (mov.lengthSq() > 0) {
            mov.normalize();
            this.desiredVelocity.copy(mov).multiplyScalar(this.moveSpeed);
            this.moveDirection = isBackward ? -1 : 1;
        } else {
            this.desiredVelocity.set(0, 0, 0);
            this.moveDirection = 0;
        }
        
        // MotionController will handle smooth movement in update()
        // Locomotion blending will be updated in update() based on actual velocity
    }

    updateAI(dt, opp, collisionSystem) {
        // Delegate to AI Controller if available
        if (this.aiController && collisionSystem) {
            this.aiController.updateAI(this, dt, opp, collisionSystem);
        } else {
            // Fallback to simple AI if controller not available
            console.warn('AI Controller not available, using fallback AI');
            const dist = this.mesh.position.distanceTo(opp.mesh.position);
            if (dist < 2.5 && this.state === 'IDLE' && Math.random() < 0.3) {
                const attacks = ['leftHand', 'rightHand', 'leftLeg', 'rightLeg'];
                const attackType = attacks[Math.floor(Math.random() * attacks.length)];
                this.attack(attackType);
            } else if (dist > 2.5) {
                const dir = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position).normalize();
                this.mesh.position.addScaledVector(dir, this.moveSpeed * dt);
                this.play('walk', this.animationFade);
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
}

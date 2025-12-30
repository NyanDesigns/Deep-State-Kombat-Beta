import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { BoneDiscovery } from '../utils/BoneDiscovery.js';
import { HitboxSystem } from '../utils/HitboxSystem.js';

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

        // Initial rotation to face the center
        this.mesh.rotation.y = id === 'p1' ? Math.PI / 2 : -Math.PI / 2;

        // Recalculate collision bounds using scaled size
        box.setFromObject(this.mesh);
        box.getSize(size);

        this.collisionRadius = Math.max(size.x, size.z) * 0.5 + 0.3;
        if (!isFinite(this.collisionRadius) || this.collisionRadius < 0.5) {
            this.collisionRadius = 1.2;
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

        this.state = 'IDLE';
        this.play('idle');

        // Combat vars
        this.hitRegistered = false;
        this.stunTime = 0;
        this.aiTimer = 0;
        this.aiMoveDecision = 'chase'; // AI movement decision: 'chase', 'retreat', or 'attack'
        this.moveDirection = 0; // 1 = forward, -1 = backward, 0 = none

        // Hitbox system - using spheres with character-specific sizes
        const headRadius = characterConfig?.hitboxes?.head || 0.4;
        const torsoRadius = characterConfig?.hitboxes?.torso || 0.6;

        this.hurtSpheres = {
            head: new THREE.Sphere(new THREE.Vector3(), headRadius),
            torso: new THREE.Sphere(new THREE.Vector3(), torsoRadius)
        };

        // Multi-sphere attack hitboxes: each hand has fist+elbow, each leg has foot+knee
        const handSizes = characterConfig?.hitboxes?.attackHands || [0.25, 0.22, 0.25, 0.22];
        const legSizes = characterConfig?.hitboxes?.attackLegs || [0.28, 0.24, 0.28, 0.24];

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
        this.loadAnim('idle', THREE.LoopRepeat, false, clips);
        this.loadAnim('walk', THREE.LoopRepeat, false, clips);
        this.loadAnim('atk1', THREE.LoopOnce, false, clips);
        this.loadAnim('atk2', THREE.LoopOnce, false, clips);
        this.loadAnim('hit', THREE.LoopOnce, false, clips);
        this.loadAnim('jump', THREE.LoopOnce, false, clips);
        this.loadAnim('crouch', THREE.LoopOnce, false, clips);
        this.loadAnim('win', THREE.LoopRepeat, false, clips);
        this.loadAnim('die', THREE.LoopOnce, true, clips); // Clamp at end

        this.state = 'IDLE';
        this.play('idle', 0);
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

        // Collision box visualization (cylinder representing the collision capsule)
        this.collisionBoxVisualization = new THREE.Group();
        scene.add(this.collisionBoxVisualization);
        this.collisionBoxVisualization.visible = false;

        // Calculate visualization radius (much thinner than actual collision radius)
        // Use the same bounding box calculation as collisionRadius but without padding and scaled down
        const box = new THREE.Box3().setFromObject(this.mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        // Use 55% of the base radius (without the +0.3 padding) to make it much thinner
        const baseRadius = Math.max(size.x, size.z) * 0.5;
        const visualizationRadius = baseRadius * 0.55;

        // Create cylinder visualization for collision capsule
        const collisionMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.5 
        });

        // The cylinder will be created and updated dynamically based on collisionHeight
        const collisionCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(visualizationRadius, visualizationRadius, this.collisionHeight, 16),
            collisionMaterial
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
        }
        if (torsoHelper) {
            torsoHelper.position.copy(this.hurtSpheres.torso.center);
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

    loadAnim(name, loop, clamp = false, clips = []) {
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

        if (clipIndex !== null && clips[clipIndex]) {
            const clip = clips[clipIndex];
            const act = this.mixer.clipAction(clip);
            act.setLoop(loop);
            act.clampWhenFinished = clamp;
            this.actions[name] = act;
        }
    }

    play(name, fade = null, reverse = false) {
        const next = this.actions[name];
        if (!next) return;
        const fadeTime = (fade === null || fade === undefined) ? this.animationFade : fade;

        // If same animation is already playing, just update direction if needed
        if (this.currAct === next) {
            const currentTimeScale = next.timeScale || 1;
            const needsReverse = reverse && currentTimeScale !== -1;
            const needsForward = !reverse && currentTimeScale !== 1;

            if (needsReverse || needsForward) {
                // Reverse the animation direction smoothly
                const clip = next.getClip();
                const currentTime = next.time;
                const duration = clip.duration;

                if (needsReverse) {
                    // Switch from forward to reverse
                    next.timeScale = -1;
                    next.time = duration - currentTime;
                } else {
                    // Switch from reverse to forward
                    next.timeScale = 1;
                    next.time = duration - currentTime;
                }
            }
            return;
        }

        // New animation - fade in
        next.reset().fadeIn(fadeTime).play();
        if (reverse) {
            next.timeScale = -1;
            next.time = next.getClip().duration; // Start from end when reversed
        } else {
            next.timeScale = 1;
            next.time = 0; // Start from beginning when forward
        }
        if (this.currAct) this.currAct.fadeOut(fadeTime);
        this.currAct = next;
    }

    update(dt, opp, gameState, keys = {}, camera = null) {
        this.mixer.update(dt);

        if (gameState !== 'FIGHT' && gameState !== 'OVER') return;
        if (this.state === 'DEAD' || this.state === 'WIN') return;

        if (gameState === 'FIGHT' && opp) {
            const target = opp.mesh.position.clone();
            target.y = this.mesh.position.y;
            this.mesh.lookAt(target);
        }

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
                this.play('idle', this.animationFade);
            }
            return;
        }

        if (this.state === 'ATTACK') {
            if (!this.currAct || !this.currAct.isRunning()) {
                this.state = 'IDLE';
                this.play('idle', this.animationFade);
            }
            return;
        }

        if (this.state === 'JUMP' || this.state === 'CROUCH') {
            if (!this.currAct || !this.currAct.isRunning()) {
                this.state = 'IDLE';
                this.play('idle', this.animationFade);
            }
            return;
        }

        const regen = this.characterConfig?.stats?.staminaRegen ?? CONFIG.combat.regen;
        if (this.st < this.maxSt) {
            this.st = Math.min(this.maxSt, this.st + regen * dt);
        }
        this.updateUI();

        if (gameState === 'FIGHT') {
            if (this.isAI) {
                this.updateAI(dt, opp);
            } else {
                this.updateInput(dt, keys, camera);
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

        const attackSpheres = this.atkType === 'light' ?
            (this.attackSpheres.hands || []) :
            (this.attackSpheres.legs || []);

        if (!attackSpheres || attackSpheres.length === 0) return null;

        let hit = false;

        for (let i = 0; i < attackSpheres.length; i++) {
            const attackSphere = attackSpheres[i];

            if (attackSphere.center.x === Infinity ||
                attackSphere.center.y === Infinity ||
                attackSphere.center.z === Infinity) {
                continue;
            }

            if (this.sphereIntersectsSphere(attackSphere, opp.hurtSpheres.head) ||
                this.sphereIntersectsSphere(attackSphere, opp.hurtSpheres.torso)) {
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
        const damage = combatStats.dmg;
        const impactPos = opp.mesh.position.clone();
        impactPos.y += opp.collisionHeight * 0.5;
        opp.takeDamage(damage, this.atkType);

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

    takeDamage(amt, type) {
        this.hp = Math.max(0, this.hp - amt);
        this.st = Math.max(0, this.st - 10);
        if (this.hp <= 0) {
            this.state = 'DEAD';
            this.play('die', this.animationFade);
        } else {
            this.state = 'STUN';
            this.stunTime = 0.5;
            this.play('hit', this.animationFade);
        }
        this.flashColor();
        this.updateUI();
        return this.state;
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
        return this.characterConfig?.combat?.[type] || CONFIG.combat[type];
    }

    attack(type) {
        const combatStats = this.getCombatStats(type);
        const cost = combatStats.cost;
        if (this.st < cost) return;
        this.st -= cost;
        this.state = 'ATTACK';
        this.atkType = type;
        this.hitRegistered = false;
        this.play(type === 'light' ? 'atk1' : 'atk2', this.animationFade);
    }

    jump() {
        if (this.state !== 'IDLE') return;
        if (!this.actions['jump']) return; // Animation not loaded
        this.state = 'JUMP';
        this.play('jump', this.animationFade);
    }

    crouch() {
        if (this.state !== 'IDLE') return;
        if (!this.actions['crouch']) return; // Animation not loaded
        this.state = 'CROUCH';
        this.play('crouch', this.animationFade);
    }

    updateInput(dt, keys, camera) {
        if (keys['ArrowUp']) { this.attack('light'); return; }
        if (keys['ArrowDown']) { this.attack('heavy'); return; }
        if (keys[' ']) { this.jump(); return; }
        if (keys['Control']) { this.crouch(); return; }

        // Calculate camera-relative movement vectors
        const cameraForward = new THREE.Vector3();
        if (camera && camera.getWorldDirection) {
            camera.getWorldDirection(cameraForward);
        } else {
            cameraForward.set(0, 0, 1);
        }
        cameraForward.y = 0; // Keep movement on horizontal plane
        cameraForward.normalize();

        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

        // Get character's forward direction (where they're facing)
        const charForward = new THREE.Vector3(0, 0, 1);
        charForward.applyQuaternion(this.mesh.quaternion);
        charForward.y = 0;
        charForward.normalize();

        // Create movement vector relative to camera view
        let mov = new THREE.Vector3();
        if (keys['a']) mov.addScaledVector(cameraRight, -1);
        if (keys['d']) mov.addScaledVector(cameraRight, 1);
        if (keys['w']) mov.addScaledVector(cameraForward, 1);
        if (keys['s']) mov.addScaledVector(cameraForward, -1);

        if (mov.lengthSq() > 0) {
            const movDir = mov.clone().normalize();
            mov.normalize().multiplyScalar(this.moveSpeed * dt);

            // Determine if moving forward or backward relative to character facing
            // Dot product: positive = forward, negative = backward
            const dot = movDir.dot(charForward);
            const isBackward = dot < -0.1; // Moving opposite to facing direction

            this.mesh.position.add(mov);
            if (this.mesh.position.length() > 20) this.mesh.position.setLength(20);

            // Play walk animation forward or reversed based on movement direction
            this.moveDirection = isBackward ? -1 : 1;
            this.play('walk', this.animationFade, isBackward);
        } else {
            this.moveDirection = 0;
            this.play('idle', this.animationFade);
        }
    }

    updateAI(dt, opp) {
        const aiConfig = this.characterConfig?.ai || {};
        const aggression = aiConfig.aggression ?? 0.5;
        const retreatDistance = aiConfig.retreatDistance ?? 2.0;
        const attackChance = aiConfig.attackChance ?? 0.5;
        const dist = this.mesh.position.distanceTo(opp.mesh.position);

        // Update decision timer (only for decision-making, not movement)
        this.aiTimer -= dt;
        const shouldMakeDecision = this.aiTimer <= 0;
        
        if (shouldMakeDecision) {
            // Make new decision periodically
            this.aiTimer = Math.random() * 0.3 + 0.1; // Faster decision updates
            
            // Store current decision and execute attacks immediately
            if (dist < retreatDistance && Math.random() > aggression) {
                this.aiMoveDecision = 'retreat';
            } else if (dist < 2.8 && Math.random() < attackChance && this.state === 'IDLE') {
                // Attack decision - execute immediately
                this.aiMoveDecision = 'attack';
                this.attack(Math.random() > 0.6 ? 'heavy' : 'light');
                return; // Don't move this frame if attacking
            } else {
                this.aiMoveDecision = 'chase';
            }
        }

        // Execute movement continuously based on current decision (skip if attacking)
        if (this.state === 'ATTACK' || this.state === 'STUN') {
            return; // Don't move during attack or stun
        }

        if (this.aiMoveDecision === 'retreat') {
            // Retreat - move away from opponent
            const dir = new THREE.Vector3().subVectors(this.mesh.position, opp.mesh.position).normalize();
            this.mesh.position.addScaledVector(dir, this.moveSpeed * dt);
            this.play('walk', this.animationFade);
        } else {
            // Chase - move towards opponent (default, or when attack decision is active but can't attack yet)
            const dir = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position).normalize();
            this.mesh.position.addScaledVector(dir, this.moveSpeed * dt);
            this.play('walk', this.animationFade);
        }

        // Keep within arena bounds
        if (this.mesh.position.length() > 20) this.mesh.position.setLength(20);
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

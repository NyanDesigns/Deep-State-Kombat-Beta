import * as THREE from 'three';
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

        // Setup Mesh
        this.mesh = gltf.scene.clone(); // Clone to allow multiple instances
        scene.add(this.mesh);
        this.mesh.position.copy(pos);

        // Normalize Scale with character-specific override
        const box = new THREE.Box3().setFromObject(this.mesh);
        const h = box.max.y - box.min.y;
        const targetHeight = 1.7; // Default target height
        const scale = characterConfig?.scale || (targetHeight / h);
        this.mesh.scale.setScalar(scale);
        box.setFromObject(this.mesh);
        const size = box.getSize(new THREE.Vector3());
        this.collisionRadius = Math.max(size.x, size.z) * 0.6 + 0.35;
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
        if (keys['w']) { this.jump(); return; }
        if (keys['s']) { this.crouch(); return; }

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
        if (keys['a']) mov.addScaledVector(cameraRight, -1);  // Side-step left
        if (keys['d']) mov.addScaledVector(cameraRight, 1);   // Side-step right

        if (mov.lengthSq() > 0) {
            const movDir = mov.clone().normalize();
            mov.multiplyScalar(this.moveSpeed * dt);

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
        this.aiTimer -= dt;
        if (this.aiTimer > 0) return;

        const aiConfig = this.characterConfig?.ai || {};
        const aggression = aiConfig.aggression ?? 0.5;
        const retreatDistance = aiConfig.retreatDistance ?? 2.0;
        const attackChance = aiConfig.attackChance ?? 0.5;
        const dist = this.mesh.position.distanceTo(opp.mesh.position);

        if (dist < retreatDistance && Math.random() > aggression) {
            const dir = new THREE.Vector3().subVectors(this.mesh.position, opp.mesh.position).normalize();
            this.mesh.position.addScaledVector(dir, this.moveSpeed * dt);
            this.play('walk', this.animationFade);
        } else if (dist < 2.8 && Math.random() < attackChance) {
            this.attack(Math.random() > 0.6 ? 'heavy' : 'light');
        } else {
            const dir = new THREE.Vector3().subVectors(opp.mesh.position, this.mesh.position).normalize();
            this.mesh.position.addScaledVector(dir, this.moveSpeed * dt);
            this.play('walk', this.animationFade);
        }

        // Keep within arena bounds
        if (this.mesh.position.length() > 20) this.mesh.position.setLength(20);

        this.aiTimer = Math.random() * 0.5 + 0.2;
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

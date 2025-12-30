import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { BoneDiscovery } from '../utils/BoneDiscovery.js';

// Placeholder for PreviewScene - will be enhanced with character system integration
export class PreviewScene {
    constructor(sceneManager, renderSystem) {
        this.sceneManager = sceneManager;
        this.renderSystem = renderSystem; // Master render system for unified pixelation
        this.previewScenes = {};
        this.miniScenes = {}; // For grid cell mini-scenes
        this.backgroundScene = null; // For large background preview
    }

    init() {
        this.createPreviewScenes();
        // Note: Background preview is PNG-only, no 3D scene needed
    }

    createPreviewScenes() {
        ['p1', 'p2'].forEach(id => {
            const canvas = document.getElementById(id + '-preview');
            if (!canvas) return;

            const container = canvas.parentElement;

            // Set canvas size
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;

            // Create preview scene
            const previewScene = new THREE.Scene();
            previewScene.background = new THREE.Color(0x0a0a0a);

            // Create preview camera
            const aspect = canvas.width / canvas.height;
            const previewCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
            previewCamera.position.set(0, 1, 3);

            // No longer create individual renderer - use master RenderSystem
            // The renderSystem will handle rendering through the unified pixelation pipeline

            // Add lighting to preview
            const previewAmb = new THREE.HemisphereLight(0x404040, 0x202020, 0.8);
            previewScene.add(previewAmb);

            const previewDir = new THREE.DirectionalLight(0xffffff, 1.2);
            previewDir.position.set(2, 4, 2);
            previewDir.castShadow = true;
            previewScene.add(previewDir);

            // Add ground plane for preview
            const groundGeo = new THREE.CircleGeometry(2, 32);
            const groundMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.3 });
            const ground = new THREE.Mesh(groundGeo, groundMat);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -1;
            previewScene.add(ground);

            // Store preview data (no renderer - use master renderSystem)
            this.previewScenes[id] = {
                scene: previewScene,
                camera: previewCamera,
                canvas: canvas,
                mixer: null,
                model: null,
                clock: new THREE.Clock()
            };
        });

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Create background character preview scene (full-screen dramatic display)
     */
    createBackgroundScene() {
        const canvas = document.getElementById('background-3d-canvas');
        if (!canvas) return;

        // Set canvas to full screen
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);

        // Create camera with dramatic angle
        const aspect = canvas.width / canvas.height;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        camera.position.set(-2, 2, 5);
        camera.lookAt(0, 1, 0);

        // No longer create individual renderer - use master RenderSystem

        // Add dramatic lighting
        const ambLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambLight);

        const keyLight = new THREE.DirectionalLight(0xffa500, 1.5);
        keyLight.position.set(3, 5, 3);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0xff6600, 0.8);
        rimLight.position.set(-3, 3, -2);
        scene.add(rimLight);

        // Store background scene data (no renderer - use master renderSystem)
        this.backgroundScene = {
            scene: scene,
            camera: camera,
            canvas: canvas,
            mixer: null,
            model: null,
            clock: new THREE.Clock()
        };
    }

    /**
     * Create mini-scene for character grid cell
     * @param {string} cellId - Unique identifier for the grid cell
     * @param {HTMLCanvasElement} canvas - Canvas element for this cell
     */
    createMiniScene(cellId, canvas) {
        if (!canvas) {
            console.error(`Canvas not found for ${cellId}`);
            return null;
        }

        // Get canvas dimensions - use parent card size if canvas is hidden
        let width = 200;
        let height = 200;
        
        // Try to get actual dimensions from canvas
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            width = rect.width;
            height = rect.height;
        } else {
            // Canvas might be hidden, try parent card
            const parent = canvas.parentElement;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                if (parentRect.width > 0 && parentRect.height > 0) {
                    width = parentRect.width;
                    height = parentRect.height;
                } else {
                    // Use CSS computed style
                    const style = window.getComputedStyle(parent);
                    const styleWidth = parseInt(style.width);
                    const styleHeight = parseInt(style.height);
                    if (styleWidth > 0 && styleHeight > 0) {
                        width = styleWidth;
                        height = styleHeight;
                    }
                }
            }
        }
        
        console.log(`Canvas ${cellId} dimensions: ${width}x${height}`);
        
        // Set canvas internal resolution (device pixel ratio for crisp rendering)
        const dpr = window.devicePixelRatio || 1;
        const internalWidth = width * dpr;
        const internalHeight = height * dpr;
        canvas.width = internalWidth;
        canvas.height = internalHeight;
        
        // Scale canvas CSS to match display size
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        console.log(`Creating mini-scene for ${cellId}: canvas size=${width}x${height}, internal=${internalWidth}x${internalHeight}, dpr=${dpr}`);

        // Create mini scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // Slightly lighter for better visibility

        // Create camera - portrait framing for grid cells
        // Camera moved DOWN in world coordinates (Y position decreased) to look UP at face
        const aspect = width / height;
        const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 50);
        camera.position.set(0, 1.2, 1.8);  // Moved camera DOWN in Y coordinate (from 3.0 to 1.2)
        camera.lookAt(0, 2.0, 0);           // LookAt moved UP to focus on face/head area
        
        // Store camera info for debugging
        console.log(`Camera setup for ${cellId}: position=(0, 1.2, 1.8), lookAt=(0, 2.0, 0), aspect=${aspect.toFixed(2)}`);

        // No longer create individual renderer - use master RenderSystem
        // The renderSystem will handle rendering through the unified pixelation pipeline
        
        console.log(`Mini-scene setup for ${cellId}: size=${width}x${height}, internal=${internalWidth}x${internalHeight}, dpr=${dpr}`);

        // Add brighter lighting for better visibility
        const ambLight = new THREE.HemisphereLight(0xffffff, 0x404040, 1.4);
        scene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
        dirLight.position.set(1, 3, 2);
        scene.add(dirLight);

        // Add fill light from front to brighten the character's face
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
        fillLight.position.set(0, 2, 3);
        scene.add(fillLight);

        // Store mini scene data (no renderer - use master renderSystem)
        const miniSceneData = {
            scene: scene,
            camera: camera,
            canvas: canvas,
            mixer: null,
            model: null,
            clock: new THREE.Clock(),
            lastUpdate: 0 // For throttling
        };

        this.miniScenes[cellId] = miniSceneData;
        
        // Initial render will happen in update() loop via master renderSystem
        console.log(`Mini-scene created for ${cellId}`);
        
        return miniSceneData;
    }

    /**
     * Load model into background scene
     * @param {Object} gltf - Loaded GLTF model
     */
    loadBackgroundModel(gltf) {
        if (!this.backgroundScene) return;

        // Remove existing model
        if (this.backgroundScene.model) {
            this.backgroundScene.scene.remove(this.backgroundScene.model);
        }

        // Use SkeletonUtils for correct skinning/animation cloning
        const model = SkeletonUtils.clone(gltf.scene);

        // Scale and position model (larger for background)
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = size.y || 1;
        model.scale.setScalar(2.5 / h);
        model.position.y = 0;

        // Apply materials with dramatic lighting
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                c.visible = true;
            }
        });

        // Add to scene
        this.backgroundScene.scene.add(model);
        this.backgroundScene.model = model;

        // Setup animation mixer
        this.backgroundScene.mixer = new THREE.AnimationMixer(model);

        // Play idle animation
        if (gltf.animations && gltf.animations.length > 0) {
            const idleClip = gltf.animations.find(clip =>
                clip.name.toLowerCase().includes('idle') ||
                clip.name.toLowerCase().includes('stand')
            ) || gltf.animations[0];

            if (idleClip) {
                const action = this.backgroundScene.mixer.clipAction(idleClip);
                action.play();
            }
        }

        // Position model at slight angle
        model.rotation.y = Math.PI / 8;
    }

    /**
     * Load model into mini-scene
     * @param {string} cellId - Cell identifier
     * @param {Object} gltf - Loaded GLTF model
     */
    loadMiniSceneModel(cellId, gltf) {
        const miniScene = this.miniScenes[cellId];
        if (!miniScene) return;

        // Remove existing model
        if (miniScene.model) {
            miniScene.scene.remove(miniScene.model);
        }

        // Use SkeletonUtils for correct skinning/animation cloning
        const model = SkeletonUtils.clone(gltf.scene);

        // Ensure model is visible and ready for measurement
        model.visible = true;
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = false;
                c.receiveShadow = false;
                c.frustumCulled = false; // Prevent disappearing while framing
            }
        });
        model.updateMatrixWorld(true);

        // Scale to a frustum-safe target height
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = size.y || 1;
        const targetHeight = 18.0; // Maximal aggressive scale to dominate the portrait with the head
        const scale = targetHeight / h;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        // Locate head/neck via bones; fallback to box top
        let headBone = null;
        model.traverse(obj => {
            if (headBone) return;
            if (obj.isSkinnedMesh && obj.skeleton) {
                const bones = BoneDiscovery.discoverBones(obj.skeleton);
                headBone = bones.head || bones.spine;
            }
        });

        let headPos = headBone ? BoneDiscovery.getBoneWorldPosition(headBone) : new THREE.Vector3();
        if (!BoneDiscovery.isValidPosition(headPos)) {
            box.setFromObject(model);
            box.getSize(size);
            const center = box.getCenter(new THREE.Vector3());
            headPos = new THREE.Vector3(center.x, box.max.y, center.z);
        }

        // Move model so the head lands at a consistent target point
        const headTarget = new THREE.Vector3(0, 1.0, 0); // Lower anchor to push the model down in frame while keeping face centered
        const moveToTarget = headTarget.clone().sub(headPos);
        model.position.add(moveToTarget);
        const extraDownOffset = -8.5; // move model up a bit relative to previous extreme offset
        const extraLeftOffset = 0.4; // shift model right in frame (positive X)
        model.position.y += extraDownOffset;
        model.position.x += extraLeftOffset;
        model.updateMatrixWorld(true);

        // Compute portrait bounding sphere (favor head/shoulders instead of whole body)
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalSphere = new THREE.Sphere();
        finalBox.getBoundingSphere(finalSphere);

        const portraitBox = finalBox.clone();
        const portraitHeightUp = 0.08;   // keep ultra-tight above the head
        const portraitHeightDown = 0.12; // keep ultra-tight below to focus on face/shoulders only
        portraitBox.min.y = Math.max(headTarget.y - portraitHeightDown, finalBox.min.y);
        portraitBox.max.y = Math.min(headTarget.y + portraitHeightUp, finalBox.max.y);
        if (portraitBox.min.y >= portraitBox.max.y) {
            portraitBox.min.y = finalBox.min.y;
            portraitBox.max.y = headTarget.y;
        }
        const portraitSphere = new THREE.Sphere();
        portraitBox.getBoundingSphere(portraitSphere);
        const effectiveSphere = portraitSphere.radius > 0 ? portraitSphere : finalSphere;

        // Fit camera distance so the whole model stays in view
        const cam = miniScene.camera;
        const fovY = THREE.MathUtils.degToRad(cam.fov || 36);
        const aspect = cam.aspect || 1;
        const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
        const fitMargin = 0.2; // zoomed out a bit more
        const distV = (effectiveSphere.radius * fitMargin) / Math.tan(fovY / 2);
        const distH = (effectiveSphere.radius * fitMargin) / Math.tan(fovX / 2);
        const fitDist = Math.max(distV, distH, (cam.near || 0.1) * 3.5); // avoid near-plane clipping

        // Position camera in front of the model, looking at the head target
        const viewDir = new THREE.Vector3(0, 0, 1); // camera sits in +Z, looks toward -Z
        const camPos = headTarget.clone().add(viewDir.multiplyScalar(fitDist));
        cam.position.copy(camPos);
        cam.lookAt(headTarget);
        cam.updateProjectionMatrix();

        console.log(`Bone/frustum-based framing for ${cellId}:`);
        console.log(`  Scale: ${scale.toFixed(3)}, targetHeight: ${targetHeight.toFixed(2)}, radius: ${effectiveSphere.radius.toFixed(3)}`);
        console.log(`  Head target: (${headTarget.x.toFixed(2)}, ${headTarget.y.toFixed(2)}, ${headTarget.z.toFixed(2)})`);
        console.log(`  Camera pos: (${cam.position.x.toFixed(2)}, ${cam.position.y.toFixed(2)}, ${cam.position.z.toFixed(2)}), fovY=${cam.fov}`);
        console.log(`  Fit distances: vertical=${distV.toFixed(2)}, horizontal=${distH.toFixed(2)}, chosen=${fitDist.toFixed(2)}`);

        // Ensure materials are visible and properly lit without overriding everything
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = false;
                c.receiveShadow = false;
                c.visible = true;

                // If the material is missing or problematic, fix it
                if (c.material) {
                    const materials = Array.isArray(c.material) ? c.material : [c.material];
                    materials.forEach(mat => {
                        if (mat) {
                            mat.visible = true;
                            mat.needsUpdate = true;
                            // Ensure transparency doesn't hide the character
                            if (mat.opacity < 0.1) mat.opacity = 1.0;
                            mat.transparent = mat.opacity < 1.0;
                        }
                    });
                }
            }
        });

        // Add to scene
        miniScene.scene.add(model);
        miniScene.model = model;

        // Ensure model and all children are visible
        model.traverse((child) => {
            if (child.isMesh || child.isGroup) {
                child.visible = true;
            }
        });

        // Verify model is in scene
        if (!miniScene.scene.children.includes(model)) {
            console.error(`Model not added to scene for ${cellId}!`);
            miniScene.scene.add(model);
        }

        console.log(`Model added to scene for ${cellId}, scene children count: ${miniScene.scene.children.length}`);
        console.log(`Scene children for ${cellId}:`, miniScene.scene.children.map(c => c.name || c.type).join(', '));

        // Set character to face front (no rotation)
        model.rotation.y = 0;

        // Setup animation mixer and play idle (5x slower)
        miniScene.mixer = new THREE.AnimationMixer(model);
        if (gltf.animations && gltf.animations.length > 0) {
            const clips = gltf.animations;
            const pickClip = keywords =>
                clips.find(clip => {
                    const name = (clip.name || '').toLowerCase();
                    return keywords.some(k => name.includes(k));
                });
            const idleClip = pickClip(['idle', 'stand']) || clips[0];
            if (idleClip) {
                const action = miniScene.mixer.clipAction(idleClip);
                action.timeScale = 0.2; // 5x slower
                action.play();
            }
        }

        // Render immediately after model is loaded using master renderSystem
        if (this.renderSystem && miniScene.scene && miniScene.camera && miniScene.canvas) {
            const rect = miniScene.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.renderSystem.renderSceneToCanvas(
                    miniScene.scene,
                    miniScene.camera,
                    miniScene.canvas,
                    rect.width,
                    rect.height
                );
                console.log(`Rendered mini-scene ${cellId} after model load via master renderSystem`);
            }
        } else {
            console.error(`Cannot render mini-scene ${cellId}: renderSystem=${!!this.renderSystem}, scene=${!!miniScene.scene}, camera=${!!miniScene.camera}, canvas=${!!miniScene.canvas}`);
        }
    }

    /**
     * Clear mini-scene model
     * @param {string} cellId - Cell identifier
     */
    clearMiniScene(cellId) {
        const miniScene = this.miniScenes[cellId];
        if (miniScene && miniScene.model) {
            miniScene.scene.remove(miniScene.model);
            miniScene.model = null;
            miniScene.mixer = null;
        }
    }

    /**
     * Dispose of a mini-scene completely
     * @param {string} cellId - Cell identifier
     */
    disposeMiniScene(cellId) {
        const miniScene = this.miniScenes[cellId];
        if (miniScene) {
            this.clearMiniScene(cellId);
            // Clean up via master renderSystem if it has disposal method
            if (this.renderSystem && miniScene.canvas && this.renderSystem.disposePreviewCanvas) {
                this.renderSystem.disposePreviewCanvas(miniScene.canvas);
            }
            delete this.miniScenes[cellId];
        }
    }

    loadModel(id, gltf) {
        const preview = this.previewScenes[id];
        if (!preview) return;

        // Remove existing model
        if (preview.model) {
            preview.scene.remove(preview.model);
        }

        // Use SkeletonUtils for correct skinning/animation cloning
        const model = SkeletonUtils.clone(gltf.scene);

        // Scale and position model
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = size.y || 1;
        model.scale.setScalar(1.5 / h); // Slightly larger for preview
        model.position.y = -0.5; // Ground level

        // Apply materials and shadows
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                c.visible = true;
                if (!c.material.map) {
                    c.material = new THREE.MeshStandardMaterial({
                        color: id === 'p1' ? 0x44aa44 : 0xaa4444,
                        roughness: 0.6,
                        metalness: 0.2
                    });
                }
            }
        });

        // Add to preview scene
        preview.scene.add(model);
        preview.model = model;

        // Setup animation mixer and play idle (5x slower)
        preview.mixer = new THREE.AnimationMixer(model);
        if (gltf.animations && gltf.animations.length > 0) {
            const clips = gltf.animations;
            const pickClip = keywords =>
                clips.find(clip => {
                    const name = (clip.name || '').toLowerCase();
                    return keywords.some(k => name.includes(k));
                });
            const idleClip = pickClip(['idle', 'stand']) || clips[0];
            if (idleClip) {
                const action = preview.mixer.clipAction(idleClip);
                action.timeScale = 0.2; // 5x slower
                action.play();
            }
        }

        // Position character to face center
        const targetRotation = id === 'p1' ? Math.PI / 6 : -Math.PI / 6;
        model.rotation.y = targetRotation;

        // Update loading indicator
        const loadingEl = document.getElementById(id + '-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    clearModel(id) {
        const preview = this.previewScenes[id];
        if (preview && preview.model) {
            preview.scene.remove(preview.model);
            preview.model = null;
        }
    }

    update() {
        // Note: Background preview is PNG-only, no 3D rendering needed
        
        // Update mini-scenes with throttling (30fps instead of 60fps for performance)
        const now = Date.now();
        Object.entries(this.miniScenes).forEach(([cellId, miniScene]) => {
            if (!miniScene) return;

            // Update animation mixer if it exists
            if (miniScene.mixer) {
                // Throttle to ~30fps
                if (now - miniScene.lastUpdate > 33) {
                    const delta = miniScene.clock.getDelta();
                    miniScene.mixer.update(delta);

                    // Keep character facing front (no rotation)
                    if (miniScene.model) {
                        miniScene.model.rotation.y = 0;
                    }

                    miniScene.lastUpdate = now;
                }
            }

            // Always render the scene, even if no model is loaded yet
            if (this.renderSystem && miniScene.scene && miniScene.camera && miniScene.canvas) {
                try {
                    // Check if canvas is visible before rendering
                    const canvas = miniScene.canvas;
                    const canvasStyle = window.getComputedStyle(canvas);
                    
                    // Render if canvas is visible (check both display and visibility)
                    if (canvas && canvasStyle.display !== 'none' && canvasStyle.visibility !== 'hidden') {
                        // Verify model is still in scene
                        if (miniScene.model && !miniScene.scene.children.includes(miniScene.model)) {
                            console.warn(`Model missing from scene for ${cellId}, re-adding...`);
                            miniScene.scene.add(miniScene.model);
                        }
                        // Ensure model is visible
                        if (miniScene.model && !miniScene.model.visible) {
                            console.warn(`Model not visible for ${cellId}, enabling visibility...`);
                            miniScene.model.visible = true;
                        }
                        
                        // Get canvas dimensions
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            this.renderSystem.renderSceneToCanvas(
                                miniScene.scene,
                                miniScene.camera,
                                canvas,
                                rect.width,
                                rect.height
                            );
                        }
                    }
                } catch (error) {
                    console.error(`Error rendering mini-scene ${cellId}:`, error);
                }
            }
        });

        // Update preview animations
        Object.values(this.previewScenes).forEach(preview => {
            if (preview && preview.mixer) {
                const delta = preview.clock.getDelta();
                preview.mixer.update(delta);

                // Gentle rotation for idle pose
                if (preview.model && preview.model.rotation) {
                    preview.model.rotation.y += delta * 0.2;
                }
            }

            // Render preview scene using master renderSystem
            if (this.renderSystem && preview && preview.scene && preview.camera && preview.canvas) {
                const rect = preview.canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    this.renderSystem.renderSceneToCanvas(
                        preview.scene,
                        preview.camera,
                        preview.canvas,
                        rect.width,
                        rect.height
                    );
                }
            }
        });
    }

    onResize() {
        // Note: Background preview is PNG-only, no canvas resizing needed
        
        // Resize mini-scenes
        Object.entries(this.miniScenes).forEach(([id, miniScene]) => {
            if (!miniScene || !miniScene.canvas) return;
            const canvas = miniScene.canvas;

            const rect = canvas.getBoundingClientRect();
            const width = rect.width || 200;
            const height = rect.height || 200;
            
            miniScene.camera.aspect = width / height;
            miniScene.camera.updateProjectionMatrix();
            
            // Canvas size will be handled by renderSystem when rendering
        });

        // Resize preview scenes
        Object.entries(this.previewScenes).forEach(([id, preview]) => {
            if (!preview || !preview.canvas) return;

            const canvas = preview.canvas;
            const container = canvas.parentElement;
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            canvas.width = width;
            canvas.height = height;
            
            preview.camera.aspect = width / height;
            preview.camera.updateProjectionMatrix();
            
            // Canvas rendering will be handled by renderSystem
        });
    }
}

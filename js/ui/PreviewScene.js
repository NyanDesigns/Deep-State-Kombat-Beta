import * as THREE from 'three';

// Placeholder for PreviewScene - will be enhanced with character system integration
export class PreviewScene {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
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

            // Create preview renderer
            const previewRenderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true,
                alpha: true,
                powerPreference: "low-power"
            });
            previewRenderer.setSize(canvas.width, canvas.height);
            previewRenderer.shadowMap.enabled = true;
            previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

            // Store preview data
            this.previewScenes[id] = {
                scene: previewScene,
                camera: previewCamera,
                renderer: previewRenderer,
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

        // Create renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

        // Store background scene data
        this.backgroundScene = {
            scene: scene,
            camera: camera,
            renderer: renderer,
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

        // Create camera - portrait framing for grid cells (closer, higher, tighter)
        const aspect = width / height;
        const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 50);
        camera.position.set(0, 1.6, 1.8);
        camera.lookAt(0, 1.2, 0);
        
        // Store camera info for debugging
        console.log(`Camera setup for ${cellId}: position=(0, 1.6, 1.8), lookAt=(0, 1.2, 0), aspect=${aspect.toFixed(2)}`);

        // Create renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false, // Set to false so background shows properly
            powerPreference: "low-power"
        });
        renderer.setSize(internalWidth, internalHeight, false); // false = don't update CSS
        renderer.setPixelRatio(dpr); // Use device pixel ratio
        renderer.setClearColor(0x1a1a1a, 1); // Ensure clear color matches scene background
        renderer.shadowMap.enabled = false; // Disable shadows for performance
        
        console.log(`Renderer created for ${cellId}: size=${internalWidth}x${internalHeight}, pixelRatio=${dpr}`);

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

        // Store mini scene data
        const miniSceneData = {
            scene: scene,
            camera: camera,
            renderer: renderer,
            mixer: null,
            model: null,
            clock: new THREE.Clock(),
            lastUpdate: 0 // For throttling
        };

        this.miniScenes[cellId] = miniSceneData;
        
        // Add a test object to verify rendering works (will be removed when model loads)
        const testGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const testMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const testCube = new THREE.Mesh(testGeometry, testMaterial);
        testCube.position.set(0, 1.2, 0);
        testCube.name = 'test-cube';
        scene.add(testCube);
        
        // Render initial frame to show scene background and test object
        renderer.render(scene, camera);
        console.log(`Initial render complete for ${cellId}`);
        
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

        // Clone and setup new model
        const model = gltf.scene.clone();

        // Scale and position model (larger for background)
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        model.scale.setScalar(2.5 / h);
        model.position.y = 0;

        // Apply materials with dramatic lighting
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
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

        // Clone and setup new model
        const model = gltf.scene.clone();

        // Scale and position model (compact for grid cell, portrait framing)
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        const center = box.getCenter(new THREE.Vector3());
        
        // Scale to fit portrait view (slightly larger for better visibility)
        const scale = 1.4 / h;
        model.scale.setScalar(scale);
        
        // Position model: center it at the camera's lookAt point (0, 1.2, 0)
        // First, get the original bounding box center
        // Then position so the center aligns with the lookAt point after scaling
        
        // Calculate where the model's center will be after scaling
        // The center point scales with the model, so we need to account for that
        const originalCenter = box.getCenter(new THREE.Vector3());
        
        // Position model so its center (after scaling) is at (0, 1.2, 0)
        // Since scaling happens around the origin, we need to:
        // 1. Move model so its center is at origin
        // 2. Scale it
        // 3. Move it to the target position
        model.position.set(
            -originalCenter.x * scale,  // Center horizontally
            1.2 - originalCenter.y * scale,  // Center vertically at camera lookAt
            -originalCenter.z * scale   // Center depth-wise
        );
        
        // Ensure model is visible
        model.visible = true;
        
        // Update matrix to get accurate bounding box
        model.updateMatrixWorld(true);
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalCenter = finalBox.getCenter(new THREE.Vector3());
        
        console.log(`Mini-scene model loaded for ${cellId}:`);
        console.log(`  Scale: ${scale.toFixed(2)}, Original height: ${h.toFixed(2)}`);
        console.log(`  Original center: (${originalCenter.x.toFixed(2)}, ${originalCenter.y.toFixed(2)}, ${originalCenter.z.toFixed(2)})`);
        console.log(`  Model position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
        console.log(`  Final center: (${finalCenter.x.toFixed(2)}, ${finalCenter.y.toFixed(2)}, ${finalCenter.z.toFixed(2)})`);
        console.log(`  Final bounding box: min=(${finalBox.min.x.toFixed(2)}, ${finalBox.min.y.toFixed(2)}, ${finalBox.min.z.toFixed(2)}), max=(${finalBox.max.x.toFixed(2)}, ${finalBox.max.y.toFixed(2)}, ${finalBox.max.z.toFixed(2)})`);

        // Ensure materials are visible and properly lit
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = false;
                c.receiveShadow = false;
                c.visible = true;
                // Ensure material is visible and properly configured
                if (c.material) {
                    if (Array.isArray(c.material)) {
                        c.material.forEach(mat => {
                            if (mat) {
                                mat.needsUpdate = true;
                                mat.visible = true;
                                if (mat.color) mat.color.setHex(0xffffff);
                                if (mat.emissive) mat.emissive.setHex(0x000000);
                                mat.transparent = false;
                                mat.opacity = 1.0;
                            }
                        });
                    } else {
                        c.material.needsUpdate = true;
                        c.material.visible = true;
                        if (c.material.color) c.material.color.setHex(0xffffff);
                        if (c.material.emissive) c.material.emissive.setHex(0x000000);
                        c.material.transparent = false;
                        c.material.opacity = 1.0;
                    }
                } else {
                    // If no material, create a basic one
                    c.material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        roughness: 0.7,
                        metalness: 0.3
                    });
                }
            }
        });

        // Keep test cube visible for debugging - remove it after a delay
        const testCube = miniScene.scene.getObjectByName('test-cube');
        if (testCube) {
            // Keep test cube for 2 seconds to verify rendering works
            setTimeout(() => {
                if (testCube.parent && testCube.parent === miniScene.scene) {
                    miniScene.scene.remove(testCube);
                    testCube.geometry.dispose();
                    testCube.material.dispose();
                    console.log(`Test cube removed from ${cellId}`);
                    
                    // Re-render immediately after removing test cube
                    if (miniScene.renderer && miniScene.scene && miniScene.camera) {
                        miniScene.renderer.render(miniScene.scene, miniScene.camera);
                    }
                }
            }, 2000);
        }
        
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

        // Setup animation mixer
        miniScene.mixer = new THREE.AnimationMixer(model);

        // Play idle animation
        if (gltf.animations && gltf.animations.length > 0) {
            const idleClip = gltf.animations.find(clip =>
                clip.name.toLowerCase().includes('idle') ||
                clip.name.toLowerCase().includes('stand')
            ) || gltf.animations[0];

            if (idleClip) {
                const action = miniScene.mixer.clipAction(idleClip);
                action.play();
            }
        }
        
        // Render immediately after model is loaded
        if (miniScene.renderer && miniScene.scene && miniScene.camera) {
            // Render multiple times to ensure it shows
            for (let i = 0; i < 3; i++) {
                miniScene.renderer.render(miniScene.scene, miniScene.camera);
            }
            console.log(`Rendered mini-scene ${cellId} after model load (3x)`);
        } else {
            console.error(`Cannot render mini-scene ${cellId}: renderer=${!!miniScene.renderer}, scene=${!!miniScene.scene}, camera=${!!miniScene.camera}`);
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
            if (miniScene.renderer) {
                miniScene.renderer.dispose();
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

        // Clone and setup new model
        const model = gltf.scene.clone();

        // Scale and position model
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        model.scale.setScalar(1.5 / h); // Slightly larger for preview
        model.position.y = -0.5; // Ground level

        // Apply materials and shadows
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
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

        // Setup animation mixer
        preview.mixer = new THREE.AnimationMixer(model);

        // Play idle animation if available
        if (gltf.animations && gltf.animations.length > 0) {
            const idleClip = gltf.animations.find(clip =>
                clip.name.toLowerCase().includes('idle') ||
                clip.name.toLowerCase().includes('stand')
            ) || gltf.animations[0];

            if (idleClip) {
                const idleAction = preview.mixer.clipAction(idleClip);
                idleAction.play();
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
            if (miniScene.renderer && miniScene.scene && miniScene.camera) {
                try {
                    // Check if canvas is visible before rendering
                    const canvas = miniScene.renderer.domElement;
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
                        
                        miniScene.renderer.render(miniScene.scene, miniScene.camera);
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

            // Render preview scene
            if (preview && preview.renderer && preview.scene && preview.camera) {
                preview.renderer.render(preview.scene, preview.camera);
            }
        });
    }

    onResize() {
        // Note: Background preview is PNG-only, no canvas resizing needed
        
        // Resize mini-scenes
        Object.entries(this.miniScenes).forEach(([id, miniScene]) => {
            if (!miniScene) return;
            const canvas = miniScene.renderer.domElement;
            if (!canvas) return;

            canvas.width = canvas.offsetWidth || 200;
            canvas.height = canvas.offsetHeight || 200;
            miniScene.camera.aspect = canvas.width / canvas.height;
            miniScene.camera.updateProjectionMatrix();
            miniScene.renderer.setSize(canvas.width, canvas.height);
        });

        // Resize preview scenes
        Object.entries(this.previewScenes).forEach(([id, preview]) => {
            if (!preview) return;

            const canvas = document.getElementById(id + '-preview');
            if (!canvas) return;

            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            preview.camera.aspect = canvas.width / canvas.height;
            preview.camera.updateProjectionMatrix();
            preview.renderer.setSize(canvas.width, canvas.height);
        });
    }
}

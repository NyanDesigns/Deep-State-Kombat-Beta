import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';
import { CRTShader } from '../shaders/CRTShader.js';

export class RenderSystem {
    constructor(sceneManager = null) {
        this.sceneManager = sceneManager;
        this.renderer = null;
        this.scene = null;
        this.camera = null;

        // Low-resolution render target for pixelation
        this.lowResRenderTarget = null;

        // Post-processing for main scene
        this.composer = null;

        // Pixelation scene objects for main display
        this.pixelationScene = null;
        this.pixelationCamera = null;
        this.pixelationQuad = null;

        // Clock for time-based effects (if no sceneManager)
        this.clock = new THREE.Clock();
        
        // Cache for preview scene renderers (canvas -> composer mapping)
        this.previewComposers = new Map();
    }

    init() {
        // If sceneManager exists, use its renderer, otherwise create one
        if (this.sceneManager) {
            this.renderer = this.sceneManager.renderer;
            this.scene = this.sceneManager.scene;
            this.camera = this.sceneManager.camera;
        } else {
            // Create a master renderer if no sceneManager provided
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance"
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            document.body.appendChild(this.renderer.domElement);
        }

        // Create low-resolution render target for pixelation
        this.lowResRenderTarget = new THREE.WebGLRenderTarget(
            CONFIG.pixelation.width,
            CONFIG.pixelation.height,
            {
                // Use linear filtering with higher resolution to soften pixelation
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            }
        );

        // Create scene and camera for displaying the pixelated texture
        this.pixelationScene = new THREE.Scene();
        this.pixelationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Create fullscreen quad to display the low-res render target
        const quadGeometry = new THREE.PlaneGeometry(2, 2);
        const quadMaterial = new THREE.ShaderMaterial({
            uniforms: CRTShader.uniforms,
            vertexShader: CRTShader.vertexShader,
            fragmentShader: CRTShader.fragmentShader
        });
        quadMaterial.uniforms.tDiffuse.value = this.lowResRenderTarget.texture;
        quadMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);

        this.pixelationQuad = new THREE.Mesh(quadGeometry, quadMaterial);
        this.pixelationScene.add(this.pixelationQuad);

        // Setup Post-Processing (for CRT effects on the fullscreen quad)
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.pixelationScene, this.pixelationCamera);
        this.composer.addPass(renderPass);

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Render the main scene (gameplay) through the pixelation pipeline
     * @param {number} hitStop - Hit stop duration (freezes frame if > 0)
     */
    render(hitStop = 0) {
        if (!this.scene || !this.camera) {
            return; // No main scene to render
        }

        // Hit Stop Check
        if (hitStop > 0) {
            // Still render the frame (freeze effect)
            this.renderSceneToPixelated(this.scene, this.camera);
            return; // Skip update, render static frame
        }

        // Render to pixelated output
        this.renderSceneToPixelated(this.scene, this.camera);
    }

    /**
     * Render any scene through the pixelation and CRT pipeline to the main canvas
     * @param {THREE.Scene} scene - Scene to render
     * @param {THREE.Camera} camera - Camera to use
     */
    renderSceneToPixelated(scene, camera) {
        if (!this.lowResRenderTarget) {
            // Fallback if render target not initialized
            this.renderer.render(scene, camera);
            return;
        }

        // Render scene to low-resolution render target
        this.renderer.setRenderTarget(this.lowResRenderTarget);
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(null);

        // Update CRT shader time uniform
        if (this.pixelationQuad && this.pixelationQuad.material) {
            const elapsedTime = this.sceneManager ? this.sceneManager.getElapsedTime() : this.clock.getElapsedTime();
            this.pixelationQuad.material.uniforms.time.value = elapsedTime;
        }

        // Render the fullscreen quad with CRT effects
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.pixelationScene, this.pixelationCamera);
        }
    }

    /**
     * Render a scene through the pixelation pipeline to a specific canvas
     * Used for preview scenes (character selection, etc.)
     * @param {THREE.Scene} scene - Scene to render
     * @param {THREE.Camera} camera - Camera to use
     * @param {HTMLCanvasElement} targetCanvas - Canvas to render to
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    renderSceneToCanvas(scene, camera, targetCanvas, width, height) {
        if (!targetCanvas) return;

        // Calculate low-res dimensions (maintain pixelation effect)
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const lowResWidth = Math.floor(width * 0.5); // More aggressive pixelation for previews
        const lowResHeight = Math.floor(height * 0.5);

        // Create or reuse render target for this canvas
        let renderTarget = this.previewComposers.get(targetCanvas);
        if (!renderTarget) {
            renderTarget = new THREE.WebGLRenderTarget(lowResWidth, lowResHeight, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            });
            this.previewComposers.set(targetCanvas, renderTarget);
        } else {
            // Update size if needed
            if (renderTarget.width !== lowResWidth || renderTarget.height !== lowResHeight) {
                renderTarget.setSize(lowResWidth, lowResHeight);
            }
        }

        // Create temporary renderer context for this canvas if needed
        // We'll use the main renderer but render to the canvas
        const originalCanvas = this.renderer.domElement;
        const originalSize = this.renderer.getSize(new THREE.Vector2());

        // Create a temporary renderer for this canvas
        let canvasRenderer = targetCanvas._renderer;
        if (!canvasRenderer) {
            canvasRenderer = new THREE.WebGLRenderer({
                canvas: targetCanvas,
                antialias: false,
                alpha: true,
                powerPreference: "low-power"
            });
            canvasRenderer.setSize(width, height, false);
            canvasRenderer.setPixelRatio(pixelRatio);
            targetCanvas._renderer = canvasRenderer;
        }

        // Render scene to low-res target
        canvasRenderer.setRenderTarget(renderTarget);
        canvasRenderer.render(scene, camera);
        canvasRenderer.setRenderTarget(null);

        // Create pixelation scene for this canvas
        let pixelationScene = targetCanvas._pixelationScene;
        let pixelationCamera = targetCanvas._pixelationCamera;
        let pixelationQuad = targetCanvas._pixelationQuad;

        if (!pixelationScene) {
            pixelationScene = new THREE.Scene();
            pixelationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            
            const quadGeometry = new THREE.PlaneGeometry(2, 2);
            const quadMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: renderTarget.texture },
                    time: { value: 0.0 },
                    resolution: { value: new THREE.Vector2(width, height) },
                    curvature: { value: CRTShader.uniforms.curvature.value },
                    scanlineIntensity: { value: CRTShader.uniforms.scanlineIntensity.value },
                    rgbShift: { value: CRTShader.uniforms.rgbShift.value }
                },
                vertexShader: CRTShader.vertexShader,
                fragmentShader: CRTShader.fragmentShader
            });
            
            pixelationQuad = new THREE.Mesh(quadGeometry, quadMaterial);
            pixelationScene.add(pixelationQuad);
            
            targetCanvas._pixelationScene = pixelationScene;
            targetCanvas._pixelationCamera = pixelationCamera;
            targetCanvas._pixelationQuad = pixelationQuad;
        }

        // Update shader uniforms
        if (pixelationQuad && pixelationQuad.material) {
            pixelationQuad.material.uniforms.tDiffuse.value = renderTarget.texture;
            pixelationQuad.material.uniforms.resolution.value.set(width, height);
            const elapsedTime = this.sceneManager ? this.sceneManager.getElapsedTime() : this.clock.getElapsedTime();
            pixelationQuad.material.uniforms.time.value = elapsedTime;
        }

        // Render pixelated scene to canvas
        canvasRenderer.render(pixelationScene, pixelationCamera);
    }

    onResize() {
        // Update composer and shader resolution
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }

        // Update CRT shader resolution uniform (for scanlines - use window resolution)
        if (this.pixelationQuad && this.pixelationQuad.material) {
            this.pixelationQuad.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        }

        // Keep the internal render target aligned with configured resolution after resizes
        if (this.lowResRenderTarget) {
            this.lowResRenderTarget.setSize(CONFIG.pixelation.width, CONFIG.pixelation.height);
        }

        // Update preview canvas renderers
        this.previewComposers.forEach((renderTarget, canvas) => {
            const renderer = canvas._renderer;
            if (renderer) {
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
                    renderer.setSize(rect.width, rect.height, false);
                    renderer.setPixelRatio(pixelRatio);
                    
                    // Update pixelation quad resolution
                    const pixelationQuad = canvas._pixelationQuad;
                    if (pixelationQuad && pixelationQuad.material) {
                        pixelationQuad.material.uniforms.resolution.value.set(rect.width, rect.height);
                    }
                }
            }
        });
    }

    /**
     * Clean up resources for a preview canvas
     * @param {HTMLCanvasElement} canvas - Canvas to clean up
     */
    disposePreviewCanvas(canvas) {
        const renderTarget = this.previewComposers.get(canvas);
        if (renderTarget) {
            renderTarget.dispose();
            this.previewComposers.delete(canvas);
        }

        const renderer = canvas._renderer;
        if (renderer) {
            renderer.dispose();
            delete canvas._renderer;
        }

        const pixelationScene = canvas._pixelationScene;
        if (pixelationScene) {
            pixelationScene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            delete canvas._pixelationScene;
            delete canvas._pixelationCamera;
            delete canvas._pixelationQuad;
        }
    }
}




import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CONFIG } from '../config.js';
import { CRTShader } from '../shaders/CRTShader.js';

export class RenderSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.renderer = sceneManager.renderer;
        this.scene = sceneManager.scene;
        this.camera = sceneManager.camera;

        // Low-resolution render target for pixelation
        this.lowResRenderTarget = null;

        // Post-processing
        this.composer = null;

        // Pixelation scene objects
        this.pixelationScene = null;
        this.pixelationCamera = null;
        this.pixelationQuad = null;
    }

    init() {
        // Refresh references now that the scene manager has been initialized
        this.renderer = this.sceneManager.renderer;
        this.scene = this.sceneManager.scene;
        this.camera = this.sceneManager.camera;

        // Create low-resolution render target for pixelation
        this.lowResRenderTarget = new THREE.WebGLRenderTarget(
            CONFIG.pixelation.width,
            CONFIG.pixelation.height,
            {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
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

    render(hitStop = 0) {
        // Hit Stop Check
        if (hitStop > 0) {
            // Still render the frame (freeze effect)
            this.renderToPixelated();
            return; // Skip update, render static frame
        }

        // Render to pixelated output
        this.renderToPixelated();
    }

    renderToPixelated() {
        if (!this.lowResRenderTarget) {
            // Fallback if render target not initialized
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Render main scene to low-resolution render target
        this.renderer.setRenderTarget(this.lowResRenderTarget);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);

        // Update CRT shader time uniform
        if (this.pixelationQuad && this.pixelationQuad.material) {
            this.pixelationQuad.material.uniforms.time.value = this.sceneManager.getElapsedTime();
        }

        // Render the fullscreen quad with CRT effects
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.pixelationScene, this.pixelationCamera);
        }
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
    }
}



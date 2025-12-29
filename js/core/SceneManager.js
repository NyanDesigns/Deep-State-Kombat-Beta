import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.lights = [];
    }

    init() {
        // Initialize renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        // Initialize scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);
        this.scene.fog = new THREE.Fog(0x101010, 15, 50);

        // Initialize camera - use pixelation resolution aspect ratio
        const pixelAspect = CONFIG.pixelation.width / CONFIG.pixelation.height;
        this.camera = new THREE.PerspectiveCamera(CONFIG.cam.fov, pixelAspect, 0.1, 100);
        this.camera.position.set(0, CONFIG.cam.height, CONFIG.cam.dist);

        // Initialize lights
        this.setupLights();

        // Initialize clock
        this.clock = new THREE.Clock();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupLights() {
        // Lights - Balanced brightness
        const amb = new THREE.HemisphereLight(0xffffff, 0x666666, 1.8);
        this.scene.add(amb);
        this.lights.push(amb);

        // Additional ambient for balanced fill
        const amb2 = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(amb2);
        this.lights.push(amb2);

        const dir = new THREE.DirectionalLight(0xffffff, 3.5);
        dir.position.set(8, 20, 8);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        this.scene.add(dir);
        this.lights.push(dir);

        // Secondary directional for balanced lighting
        const dir2 = new THREE.DirectionalLight(0xccddff, 2.0);
        dir2.position.set(-8, 18, -8);
        this.scene.add(dir2);
        this.lights.push(dir2);

        // Additional fill lights - balanced color variation
        const fill1 = new THREE.DirectionalLight(0x6688ff, 2.0);
        fill1.position.set(-10, 12, 10);
        this.scene.add(fill1);
        this.lights.push(fill1);

        const fill2 = new THREE.DirectionalLight(0xff8866, 2.0);
        fill2.position.set(10, 12, -10);
        this.scene.add(fill2);
        this.lights.push(fill2);

        const fill3 = new THREE.DirectionalLight(0x88ff88, 1.5);
        fill3.position.set(0, 15, 12);
        this.scene.add(fill3);
        this.lights.push(fill3);

        const fill4 = new THREE.DirectionalLight(0xff88ff, 1.5);
        fill4.position.set(0, 15, -12);
        this.scene.add(fill4);
        this.lights.push(fill4);

        // Rim Lights - Balanced intensity
        const rim1 = new THREE.SpotLight(0x6688ff, 4.0);
        rim1.position.set(-15, 8, 0);
        rim1.angle = Math.PI / 4;
        rim1.penumbra = 0.5;
        rim1.lookAt(0, 0, 0);
        this.scene.add(rim1);
        this.lights.push(rim1);

        const rim2 = new THREE.SpotLight(0xff8866, 4.0);
        rim2.position.set(15, 8, 0);
        rim2.angle = Math.PI / 4;
        rim2.penumbra = 0.5;
        rim2.lookAt(0, 0, 0);
        this.scene.add(rim2);
        this.lights.push(rim2);

        const rim3 = new THREE.SpotLight(0x88ff88, 4.0);
        rim3.position.set(0, 8, -15);
        rim3.angle = Math.PI / 4;
        rim3.penumbra = 0.5;
        rim3.lookAt(0, 0, 0);
        this.scene.add(rim3);
        this.lights.push(rim3);

        const rim4 = new THREE.SpotLight(0xff88ff, 4.0);
        rim4.position.set(0, 8, 15);
        rim4.angle = Math.PI / 4;
        rim4.penumbra = 0.5;
        rim4.lookAt(0, 0, 0);
        this.scene.add(rim4);
        this.lights.push(rim4);
    }

    addObject(object) {
        this.scene.add(object);
    }

    removeObject(object) {
        this.scene.remove(object);
    }

    getDeltaTime() {
        return this.clock.getDelta();
    }

    getElapsedTime() {
        return this.clock.getElapsedTime();
    }

    onResize() {
        // Camera aspect should match pixelation resolution, not window
        const pixelAspect = CONFIG.pixelation.width / CONFIG.pixelation.height;
        this.camera.aspect = pixelAspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}


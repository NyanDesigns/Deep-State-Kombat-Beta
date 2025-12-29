import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CameraController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.camera = sceneManager.camera;
        this.shake = 0;
    }

    update(dt, fighters, gameState) {
        if (!this.camera) {
            this.camera = this.sceneManager.camera;
        }
        // Handle camera shake
        if (this.shake > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shake;
            this.camera.position.y += (Math.random() - 0.5) * this.shake;
            this.shake -= dt * 2;
            if (this.shake < 0) this.shake = 0;
        }

        this.updateCameraPosition(dt, fighters, gameState);
    }

    updateCameraPosition(dt, fighters, gameState) {
        if (gameState === 'OVER') {
            // Cinematic Zoom on Winner
            const winId = fighters[0].hp > 0 ? 0 : 1;
            const target = fighters[winId].mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            const goalPos = fighters[winId].mesh.position.clone().add(new THREE.Vector3(0, 1.5, 3.5));
            this.camera.position.lerp(goalPos, dt);
            this.camera.lookAt(target);
            return;
        }

        // Gameplay Camera (Wider & Higher)
        const p1 = fighters[0].mesh.position;
        const p2 = fighters[1].mesh.position;
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dist = p1.distanceTo(p2);

        const target = mid.clone().add(new THREE.Vector3(0, 1.5, 0)); // Look at chest height
        const zDist = CONFIG.cam.dist + (dist * 0.5); // Dynamic Zoom
        const goal = new THREE.Vector3(mid.x, CONFIG.cam.height + (dist * 0.1), mid.z + zDist);

        this.camera.position.lerp(goal, dt * 5); // Increased lerp speed for better tracking
        this.camera.lookAt(target);
    }

    addShake(amount) {
        this.shake = Math.max(this.shake, amount);
    }
}


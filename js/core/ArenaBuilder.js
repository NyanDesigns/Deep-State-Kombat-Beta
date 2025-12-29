import * as THREE from 'three';

export class ArenaBuilder {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.scene;
    }

    buildArena() {
        this.scene = this.sceneManager.scene;
        this.createFloor();
        this.createBoundaryRings();
        this.createCornerLights();
        this.createOverheadLights();
        this.createWalls();
        this.createLightStrips();
    }

    createFloor() {
        // Enhanced Floor - Balanced with subtle emissive
        const tex = new THREE.CanvasTexture(this.createGridCanvas());
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(10, 10);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({
                map: tex,
                roughness: 0.3,
                metalness: 0.4,
                color: 0x666666,
                emissive: 0x111111,
                emissiveIntensity: 0.2
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Subtle ground glow plane
        const glowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.05,
                side: THREE.DoubleSide
            })
        );
        glowPlane.rotation.x = -Math.PI / 2;
        glowPlane.position.y = 0.05;
        this.scene.add(glowPlane);
    }

    createBoundaryRings() {
        // Arena boundary rings - Balanced with subtle emissive
        const ring1 = new THREE.Mesh(
            new THREE.RingGeometry(15, 15.3, 64),
            new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                emissive: 0xffaa00,
                emissiveIntensity: 0.8,
                side: THREE.DoubleSide
            })
        );
        ring1.rotation.x = -Math.PI / 2;
        ring1.position.y = 0.01;
        this.scene.add(ring1);

        const ring2 = new THREE.Mesh(
            new THREE.RingGeometry(22, 22.3, 64),
            new THREE.MeshStandardMaterial({
                color: 0xff6600,
                emissive: 0xff6600,
                emissiveIntensity: 0.8,
                side: THREE.DoubleSide
            })
        );
        ring2.rotation.x = -Math.PI / 2;
        ring2.position.y = 0.01;
        this.scene.add(ring2);

        // Additional subtle ring for ambient
        const ring3 = new THREE.Mesh(
            new THREE.RingGeometry(10, 10.2, 64),
            new THREE.MeshStandardMaterial({
                color: 0xffffaa,
                emissive: 0xffffaa,
                emissiveIntensity: 0.5,
                side: THREE.DoubleSide
            })
        );
        ring3.rotation.x = -Math.PI / 2;
        ring3.position.y = 0.02;
        this.scene.add(ring3);
    }

    createCornerLights() {
        // Corner lights - Balanced intensity
        const cornerLight1 = new THREE.PointLight(0xff4400, 4, 30);
        cornerLight1.position.set(-20, 4, -20);
        this.scene.add(cornerLight1);

        const cornerLight2 = new THREE.PointLight(0x44ff00, 4, 30);
        cornerLight2.position.set(20, 4, -20);
        this.scene.add(cornerLight2);

        const cornerLight3 = new THREE.PointLight(0x4400ff, 4, 30);
        cornerLight3.position.set(-20, 4, 20);
        this.scene.add(cornerLight3);

        const cornerLight4 = new THREE.PointLight(0xffff00, 4, 30);
        cornerLight4.position.set(20, 4, 20);
        this.scene.add(cornerLight4);
    }

    createOverheadLights() {
        // Balanced overhead lights
        const overhead1 = new THREE.PointLight(0xffffee, 3.0, 20);
        overhead1.position.set(0, 10, 0);
        this.scene.add(overhead1);

        const overhead2 = new THREE.PointLight(0xccddff, 2.5, 20);
        overhead2.position.set(-10, 10, 0);
        this.scene.add(overhead2);

        const overhead3 = new THREE.PointLight(0xffddcc, 2.5, 20);
        overhead3.position.set(10, 10, 0);
        this.scene.add(overhead3);

        const overhead4 = new THREE.PointLight(0xddffdd, 2.5, 20);
        overhead4.position.set(0, 10, -10);
        this.scene.add(overhead4);

        const overhead5 = new THREE.PointLight(0xffddff, 2.5, 20);
        overhead5.position.set(0, 10, 10);
        this.scene.add(overhead5);
    }

    createWalls() {
        // Arena walls - Balanced with subtle emissive
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x303030,
            transparent: true,
            opacity: 0.4,
            emissive: 0x101010,
            emissiveIntensity: 0.2
        });

        const wall1 = new THREE.Mesh(new THREE.BoxGeometry(50, 8, 1), wallMat);
        wall1.position.set(0, 4, -25);
        this.scene.add(wall1);

        const wall2 = new THREE.Mesh(new THREE.BoxGeometry(50, 8, 1), wallMat);
        wall2.position.set(0, 4, 25);
        this.scene.add(wall2);

        const wall3 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 50), wallMat);
        wall3.position.set(-25, 4, 0);
        this.scene.add(wall3);

        const wall4 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 50), wallMat);
        wall4.position.set(25, 4, 0);
        this.scene.add(wall4);
    }

    createLightStrips() {
        // Subtle light strips on walls for balanced ambient
        const lightStripMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.8
        });

        const strip1 = new THREE.Mesh(new THREE.BoxGeometry(45, 0.3, 0.2), lightStripMat);
        strip1.position.set(0, 6, -24.5);
        this.scene.add(strip1);

        const strip2 = new THREE.Mesh(new THREE.BoxGeometry(45, 0.3, 0.2), lightStripMat);
        strip2.position.set(0, 6, 24.5);
        this.scene.add(strip2);

        const strip3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 45), lightStripMat);
        strip3.position.set(-24.5, 6, 0);
        this.scene.add(strip3);

        const strip4 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 45), lightStripMat);
        strip4.position.set(24.5, 6, 0);
        this.scene.add(strip4);
    }

    createGridCanvas() {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        for (let i = 0; i < 512; i += 64) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 512);
            ctx.stroke();
        }
        for (let i = 0; i < 512; i += 64) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(512, i);
            ctx.stroke();
        }
        return c;
    }
}



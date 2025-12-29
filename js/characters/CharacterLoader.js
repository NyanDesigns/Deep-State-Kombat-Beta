import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { CharacterConfig } from './CharacterConfig.js';
import { CONFIG } from '../config.js';

export class CharacterLoader {
    constructor() {
        this.configValidator = new CharacterConfig();
    }

    /**
     * Load character configuration from a JSON file
     * @param {string} path - Path to the character.json file
     * @returns {Promise<Object>} - Loaded and validated character configuration
     */
    async loadCharacterConfig(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load character config: ${response.statusText}`);
            }

            const config = await response.json();

            // Validate the configuration
            const validation = this.configValidator.validate(config);
            if (!validation.valid) {
                console.warn(`Character config validation errors for ${path}:`, validation.errors);
                // Continue with defaults for invalid fields
            }

            // Merge with defaults
            const mergedConfig = this.configValidator.mergeWithDefaults(config);

            return mergedConfig;
        } catch (error) {
            console.error(`Error loading character config from ${path}:`, error);
            throw error;
        }
    }

    /**
     * Load character 3D model (GLB/GLTF or OBJ)
     * @param {string} path - Path to the model file
     * @returns {Promise<Object>} - Loaded model object (GLTF format)
     */
    async loadCharacterModel(path) {
        return new Promise((resolve, reject) => {
            const isOBJ = path.toLowerCase().endsWith('.obj');

            if (isOBJ) {
                // Load OBJ file
                this.loadOBJModel(path).then(resolve).catch(reject);
            } else {
                // Load GLB/GLTF file
                const loader = new GLTFLoader();

                loader.load(
                    path,
                    (gltf) => {
                        resolve(gltf);
                    },
                    (progress) => {
                        // Optional: emit progress events
                        console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => {
                        console.error(`Error loading character model from ${path}:`, error);
                        reject(error);
                    }
                );
            }
        });
    }

    /**
     * Load OBJ model file
     * @param {string} path - Path to the OBJ file
     * @returns {Promise<Object>} - GLTF-like object with scene and animations
     */
    async loadOBJModel(path) {
        return new Promise((resolve, reject) => {
            const objLoader = new OBJLoader();
            const mtlLoader = new MTLLoader();

            // Try to load MTL file first
            const mtlPath = path.replace('.obj', '.mtl');
            const baseUrl = path.substring(0, path.lastIndexOf('/') + 1);

            mtlLoader.setPath(baseUrl);
            mtlLoader.load(
                mtlPath.split('/').pop(), // Just the filename
                (materials) => {
                    materials.preload();
                    objLoader.setMaterials(materials);
                    this.loadOBJFile(objLoader, path, resolve, reject);
                },
                undefined,
                () => {
                    // MTL not found, load OBJ without materials
                    this.loadOBJFile(objLoader, path, resolve, reject);
                }
            );
        });
    }

    loadOBJFile(loader, path, resolve, reject) {
        loader.load(
            path,
            (object) => {
                // Convert OBJ to GLTF-like format
                const gltfLike = {
                    scene: object,
                    animations: [], // OBJ files don't have animations
                    asset: {}
                };
                resolve(gltfLike);
            },
            (progress) => {
                console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error(`Error loading OBJ model from ${path}:`, error);
                reject(error);
            }
        );
    }

    /**
     * Load both character config and model
     * @param {string} configPath - Path to character.json
     * @param {string} modelPath - Path to GLB/GLTF file
     * @returns {Promise<Object>} - { config, model }
     */
    async loadCharacter(configPath, modelPath) {
        try {
            const [config, model] = await Promise.all([
                this.loadCharacterConfig(configPath),
                this.loadCharacterModel(modelPath)
            ]);

            return { config, model };
        } catch (error) {
            console.error('Error loading character:', error);
            throw error;
        }
    }

    /**
     * Create a temporary character config for custom uploaded models
     * @param {string} fileName - Original file name
     * @param {Object} gltf - Loaded GLTF object
     * @returns {Object} - Temporary character configuration
     */
    createCustomCharacterConfig(fileName, gltf) {
        const baseName = fileName.replace(/\.(glb|gltf)$/i, '');
        const id = `custom_${Date.now()}`;

        const config = this.configValidator.createDefault(id, baseName);

        // Try to auto-detect animations from the GLTF
        if (gltf.animations && gltf.animations.length > 0) {
            const animationMap = this.mapAnimationsFromGLTF(gltf.animations);
            config.animations = { ...config.animations, ...animationMap };
        }

        return config;
    }

    /**
     * Attempt to map animations from GLTF animation names
     * @param {Array} animations - GLTF animations array
     * @returns {Object} - Mapped animation names/indices
     */
    mapAnimationsFromGLTF(animations) {
        const mapping = {};

        animations.forEach((clip, index) => {
            const name = clip.name.toLowerCase();

            // Animation name mapping logic (similar to original setupFile)
            if (name.includes('idle') || name.includes('stand')) {
                mapping.idle = index;
            } else if (name.includes('walk') || name.includes('run')) {
                mapping.walk = index;
            } else if (name.includes('jump') || name.includes('leap')) {
                mapping.jump = index;
            } else if (name.includes('crouch') || name.includes('duck') || name.includes('squat')) {
                mapping.crouch = index;
            } else if (name.includes('punch') || name.includes('jab')) {
                mapping.atk1 = index;
            } else if (name.includes('kick') || name.includes('heavy')) {
                mapping.atk2 = index;
            } else if (name.includes('hit') || name.includes('damage')) {
                mapping.hit = index;
            } else if (name.includes('win') || name.includes('victory') || name.includes('taunt') || name.includes('pose')) {
                mapping.win = index;
            } else if (name.includes('die') || name.includes('death') || name.includes('down')) {
                mapping.die = index;
            }
        });

        return mapping;
    }
}

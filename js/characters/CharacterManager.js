import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterLoader } from './CharacterLoader.js';
import { CHARACTERS } from './characters.js';

// Hardcoded list of available characters (those with 3D models)
const AVAILABLE_CHARACTERS = ['brandon'];

export class CharacterManager {
    constructor() {
        this.loader = new CharacterLoader();
        this.characters = new Map();
        this.loadedModels = new Map();
    }

    /**
     * Initialize the character manager by loading all available characters
     */
    async initialize() {
        for (const charData of CHARACTERS) {
            try {
                const config = await this.loader.loadCharacterConfig(charData.configPath);
                const hydratedConfig = {
                    ...config,
                    id: config.id || charData.id,
                    name: config.name || charData.name,
                    modelPath: charData.modelPath || config.modelPath,
                    thumbnail: charData.thumbnail ?? config.thumbnail
                };
                this.registerCharacter(hydratedConfig);
            } catch (error) {
                console.warn(`Failed to load character config for ${charData.id}:`, error);
            }
        }
    }

    /**
     * Register a character configuration
     * @param {Object} config - Character configuration object
     */
    registerCharacter(config) {
        this.characters.set(config.id, config);
    }

    /**
     * Get a character configuration by ID
     * @param {string} id - Character ID
     * @returns {Object|null} - Character configuration or null if not found
     */
    getCharacter(id) {
        return this.characters.get(id) || null;
    }

    /**
     * Get all registered characters
     * @returns {Array} - Array of character configurations
     */
    getAllCharacters() {
        return Array.from(this.characters.values());
    }

    /**
     * Load a character by ID
     * @param {string} id - Character ID
     * @returns {Promise<Object>} - Loaded character data { config, model }
     */
    async loadCharacter(id) {
        const config = this.getCharacter(id);
        if (!config) {
            throw new Error(`Character ${id} not found in registry`);
        }

        if (this.loadedModels.has(id)) {
            return { config, model: this.loadedModels.get(id) };
        }

        let model = null;
        try {
            model = await this.loader.loadCharacterModel(config.modelPath);
        } catch (error) {
            console.warn(`Failed to load model for ${id} at ${config.modelPath}:`, error);
            const fallback = CHARACTERS.find(c => c.id === 'brandon');
            if (fallback && fallback.modelPath !== config.modelPath) {
                try {
                    model = await this.loader.loadCharacterModel(fallback.modelPath);
                } catch (fallbackError) {
                    console.error('Fallback model load failed:', fallbackError);
                    throw error;
                }
            } else {
                throw error;
            }
        }
        this.loadedModels.set(id, model);
        return { config, model };
    }

    /**
     * Get a loaded character model
     * @param {string} id - Character ID
     * @returns {Object|null} - GLTF model object or null if not loaded
     */
    getLoadedModel(id) {
        return this.loadedModels.get(id) || null;
    }

    /**
     * Create a custom character from uploaded file
     * @param {File} file - Uploaded GLB/GLTF file
     * @returns {Promise<Object>} - Custom character data { config, model }
     */
    async createCustomCharacter(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);

            const loader = new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    try {
                        const config = this.loader.createCustomCharacterConfig(file.name, gltf);
                        this.registerCharacter(config);
                        this.loadedModels.set(config.id, gltf);
                        resolve({ config, model: gltf });
                        URL.revokeObjectURL(url);
                    } catch (error) {
                        reject(error);
                    }
                },
                undefined,
                (error) => {
                    reject(error);
                    URL.revokeObjectURL(url);
                }
            );
        });
    }

    /**
     * Scan the characters directory for available characters
     * @returns {Promise<Array>} - Array of discovered character IDs
     */
    async scanCharacterDirectory() {
        // This would typically scan the assets/characters/ directory
        // For now, return the predefined characters
        return CHARACTERS.map(char => char.id);
    }

    /**
     * Check if a character is loaded
     * @param {string} id - Character ID
     * @returns {boolean} - True if character is loaded
     */
    isCharacterLoaded(id) {
        return this.loadedModels.has(id);
    }

    /**
     * Unload a character to free memory
     * @param {string} id - Character ID
     */
    unloadCharacter(id) {
        this.loadedModels.delete(id);
    }

    /**
     * Get character preview/thumbnail path
     * @param {string} id - Character ID
     * @returns {string|null} - Thumbnail path or null
     */
    getCharacterThumbnail(id) {
        const config = this.getCharacter(id);
        return config ? config.thumbnail || null : null;
    }

    /**
     * Check if a character is available (has 3D model)
     * @param {string} id - Character ID
     * @returns {boolean} - True if character is available
     */
    isCharacterAvailable(id) {
        return AVAILABLE_CHARACTERS.includes(id);
    }
}

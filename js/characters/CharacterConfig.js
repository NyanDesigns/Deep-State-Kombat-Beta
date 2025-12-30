import { CONFIG, DEFAULT_CHARACTER_STATS, DEFAULT_COMBAT_STATS } from '../config.js';

/**
 * Character configuration schema and validation
 */
export class CharacterConfig {
    constructor() {
        this.schema = {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            modelPath: { type: 'string', required: true },
            thumbnail: { type: ['string', 'object'], required: false },
            stats: {
                type: 'object',
                required: false,
                schema: {
                    hp: { type: 'number', required: false, default: DEFAULT_CHARACTER_STATS.hp },
                    stamina: { type: 'number', required: false, default: DEFAULT_CHARACTER_STATS.stamina },
                    staminaRegen: { type: 'number', required: false, default: DEFAULT_CHARACTER_STATS.staminaRegen },
                    moveSpeed: { type: 'number', required: false, default: DEFAULT_CHARACTER_STATS.moveSpeed },
                    jumpHeight: { type: 'number', required: false },
                    weight: { type: 'number', required: false }
                }
            },
            combat: {
                type: 'object',
                required: false,
                schema: {
                    light: {
                        type: 'object',
                        required: false,
                        schema: {
                            dmg: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.light.dmg },
                            cost: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.light.cost },
                            range: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.light.range },
                            window: { type: 'array', required: false, default: DEFAULT_COMBAT_STATS.light.window }
                        }
                    },
                    heavy: {
                        type: 'object',
                        required: false,
                        schema: {
                            dmg: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.heavy.dmg },
                            cost: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.heavy.cost },
                            range: { type: 'number', required: false, default: DEFAULT_COMBAT_STATS.heavy.range },
                            window: { type: 'array', required: false, default: DEFAULT_COMBAT_STATS.heavy.window }
                        }
                    }
                }
            },
            animations: {
                type: 'object',
                required: true,
                schema: {
                    idle: { type: ['string', 'number'], required: true },
                    walk: { type: ['string', 'number'], required: true },
                    jump: { type: ['string', 'number'], required: true },
                    crouch: { type: ['string', 'number'], required: true },
                    atk1: { type: ['string', 'number'], required: true },
                    atk2: { type: ['string', 'number'], required: true },
                    hit: { type: ['string', 'number'], required: true },
                    win: { type: ['string', 'number'], required: false },
                    die: { type: ['string', 'number'], required: false }
                }
            },
            animationSettings: {
                type: 'object',
                required: false,
                schema: {
                    fadeTime: { type: 'number', required: false },
                    playbackSpeed: { type: 'object', required: false }
                }
            },
            hitboxes: {
                type: 'object',
                required: false,
                schema: {
                    head: { type: 'number', required: false },
                    torso: { type: 'number', required: false },
                    attackHands: { type: 'array', required: false },
                    attackLegs: { type: 'array', required: false }
                }
            },
            scale: { type: 'number', required: false },
            color: { type: 'number', required: false },
            ai: {
                type: 'object',
                required: false,
                schema: {
                    aggression: { type: 'number', required: false, min: 0, max: 1 },
                    retreatDistance: { type: 'number', required: false },
                    attackChance: { type: 'number', required: false, min: 0, max: 1 }
                }
            }
        };
    }

    /**
     * Validate a character configuration object
     * @param {Object} config - Character configuration to validate
     * @returns {Object} - { valid: boolean, errors: string[] }
     */
    validate(config) {
        const errors = [];

        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { valid: false, errors };
        }

        this.validateObject(config, this.schema, '', errors);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Recursively validate an object against a schema
     */
    validateObject(obj, schema, path, errors) {
        for (const [key, rule] of Object.entries(schema)) {
            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;

            if (rule.required && (value === undefined || value === null)) {
                errors.push(`Missing required field: ${currentPath}`);
                continue;
            }

            if (value === undefined || value === null) {
                continue; // Skip optional fields that aren't provided
            }

            // Type checking
            if (rule.type) {
                const types = Array.isArray(rule.type) ? rule.type : [rule.type];
                const valueType = typeof value;

                if (rule.type === 'array' && !Array.isArray(value)) {
                    errors.push(`Field ${currentPath} must be an array`);
                } else if (!types.includes(valueType) && !(rule.type === 'array' && Array.isArray(value))) {
                    errors.push(`Field ${currentPath} must be of type ${types.join(' or ')}, got ${valueType}`);
                }
            }

            // Range checking for numbers
            if (typeof value === 'number' && (rule.min !== undefined || rule.max !== undefined)) {
                if (rule.min !== undefined && value < rule.min) {
                    errors.push(`Field ${currentPath} must be >= ${rule.min}`);
                }
                if (rule.max !== undefined && value > rule.max) {
                    errors.push(`Field ${currentPath} must be <= ${rule.max}`);
                }
            }

            // Recursive validation for nested objects
            if (rule.schema && typeof value === 'object' && !Array.isArray(value)) {
                this.validateObject(value, rule.schema, currentPath, errors);
            }

            // Array validation
            if (rule.type === 'array' && Array.isArray(value) && rule.schema) {
                value.forEach((item, index) => {
                    if (typeof item === 'object') {
                        this.validateObject(item, rule.schema, `${currentPath}[${index}]`, errors);
                    }
                });
            }
        }
    }

    /**
     * Merge character config with defaults
     * @param {Object} config - Character configuration
     * @returns {Object} - Merged configuration with defaults applied
     */
    mergeWithDefaults(config) {
        const merged = JSON.parse(JSON.stringify(config)); // Deep clone

        // Apply default stats
        if (!merged.stats) merged.stats = {};
        merged.stats = { ...DEFAULT_CHARACTER_STATS, ...merged.stats };

        // Apply default combat stats
        if (!merged.combat) merged.combat = {};
        if (!merged.combat.light) merged.combat.light = {};
        if (!merged.combat.heavy) merged.combat.heavy = {};

        merged.combat.light = { ...DEFAULT_COMBAT_STATS.light, ...merged.combat.light };
        merged.combat.heavy = { ...DEFAULT_COMBAT_STATS.heavy, ...merged.combat.heavy };

        // Apply default animation settings
        if (!merged.animationSettings) merged.animationSettings = {};
        if (!merged.animationSettings.fadeTime) merged.animationSettings.fadeTime = 0.1;

        return merged;
    }

    /**
     * Create a default character configuration
     * @param {string} id - Character ID
     * @param {string} name - Character name
     * @returns {Object} - Default character configuration
     */
    createDefault(id, name) {
        return {
            id,
            name,
            modelPath: `assets/characters/${id}/model.glb`,
            stats: { ...DEFAULT_CHARACTER_STATS },
            combat: {
                light: { ...DEFAULT_COMBAT_STATS.light },
                heavy: { ...DEFAULT_COMBAT_STATS.heavy }
            },
            animations: {
                idle: 'idle',
                walk: 'walk',
                jump: 'jump',
                crouch: 'crouch',
                atk1: 'attack1',
                atk2: 'attack2',
                hit: 'hit',
                win: 'win',
                die: 'die'
            },
            animationSettings: {
                fadeTime: 0.1
            }
        };
    }
}




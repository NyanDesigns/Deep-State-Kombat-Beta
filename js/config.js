// Game configuration constants
export const CONFIG = {
    cam: { dist: 18.0, height: 2.5, fov: 40 }, // Zoomed out even more
    pixelation: { width: 320, height: 240 }, // Low resolution for true pixelation
    combat: {
        hp: 100,
        stamina: 100,
        regen: 12,
        timer: 99,
        // Separate windows for timing
        light: { dmg: 6, cost: 15, range: 2.2, window: [0.2, 0.5] },
        heavy: { dmg: 15, cost: 30, range: 2.8, window: [0.4, 0.8] }, // Later window for heavy
        hitAngle: 0.6
    }
};

// Default character stats - these can be overridden by character configs
export const DEFAULT_CHARACTER_STATS = {
    hp: 100,
    stamina: 100,
    staminaRegen: 12,
    moveSpeed: 4.0
};

// Default combat stats - these can be overridden by character configs
export const DEFAULT_COMBAT_STATS = {
    light: {
        dmg: 6,
        cost: 15,
        range: 2.2,
        window: [0.2, 0.5]
    },
    heavy: {
        dmg: 15,
        cost: 30,
        range: 2.8,
        window: [0.4, 0.8]
    }
};


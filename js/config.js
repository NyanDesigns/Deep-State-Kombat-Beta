// Game configuration constants
export const CONFIG = {
    cam: { dist: 7.5, height: 2.0, fov: 45 }, // Restore camera framing; sizing handled via model scale instead
    pixelation: { width: 1280, height: 720 }, // Higher internal render resolution to reduce pixelation
    combat: {
        hp: 100,
        stamina: 100,
        regen: 12,
        timer: 99,
        // Separate windows for timing - earlier windows for faster hits
        light: { dmg: 6, cost: 8, range: 2.2, window: [0.1, 0.35] }, // Lower cost to support combos
        heavy: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] }, // Lower cost to support combos
        leftHand: { dmg: 6, cost: 8, range: 2.2, window: [0.1, 0.35] },
        rightHand: { dmg: 6, cost: 8, range: 2.2, window: [0.1, 0.35] },
        leftLeg: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] },
        rightLeg: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] },
        hitAngle: 0.6,
        // Combo system configuration
        comboSpeedMultiplier: 1.5,  // Combo attacks play at 1.5x speed (minimum)
        // Movement configuration for combo system
        movement: {
            pushback: {
                light: 0.8,
                heavy: 1.5
            },
            forward: {
                light: 0.56,  // 70% of 0.8
                heavy: 1.05   // 70% of 1.5
            },
            frictionFactor: 0.25,  // When too close
            forwardFrictionFactor: 0.3,  // Slightly more friction for forward movement
            collisionBuffer: 1.2  // Multiplier for collision distance check
        }
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
        cost: 8,
        range: 2.2,
        window: [0.1, 0.35] // Earlier window for faster hits
    },
    heavy: {
        dmg: 15,
        cost: 18,
        range: 2.8,
        window: [0.25, 0.55] // Earlier window for faster hits
    },
    leftHand: {
        dmg: 6,
        cost: 8,
        range: 2.2,
        window: [0.1, 0.35]
    },
    rightHand: {
        dmg: 6,
        cost: 8,
        range: 2.2,
        window: [0.1, 0.35]
    },
    leftLeg: {
        dmg: 15,
        cost: 18,
        range: 2.8,
        window: [0.25, 0.55]
    },
    rightLeg: {
        dmg: 15,
        cost: 18,
        range: 2.8,
        window: [0.25, 0.55]
    }
};

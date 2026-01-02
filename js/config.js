// Game configuration constants
export const CONFIG = {
    cam: { dist: 7.5, height: 2.0, fov: 45 }, // Restore camera framing; sizing handled via model scale instead
    pixelation: { width: 1280, height: 720 }, // Higher internal render resolution to reduce pixelation
    combat: {
        hp: 100,
        stamina: 100,
        regen: 5, // Reduced from 12 to slow down regeneration
        timer: 99,
        // Separate windows for timing - earlier windows for faster hits
        // Stamina costs: Reduced - ~5-6 kicks deplete full bar (100 stamina / 5-6 = ~17-20 per kick)
        light: { dmg: 6, cost: 9, range: 2.2, window: [0.1, 0.35] }, // Reduced cost
        heavy: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] }, // ~5-6 kicks deplete full bar
        leftHand: { dmg: 6, cost: 9, range: 2.2, window: [0.1, 0.35] },
        rightHand: { dmg: 6, cost: 9, range: 2.2, window: [0.1, 0.35] },
        leftLeg: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] },
        rightLeg: { dmg: 15, cost: 18, range: 2.8, window: [0.25, 0.55] },
        hitAngle: 0.6,
        // Combo system configuration
        comboSpeedMultiplier: 17.1,  // Combo attacks play at 17.1x speed (hands: 3.5 * 17.1 ≈ 60.0x, legs: 3.0 * 17.1 ≈ 51.3x)
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
    },
    animation: {
        crossfade: {
            toAttack: 0.12,
            toHit: 0.08,
            toBase: 0.20,
            withinCombo: 0.05,
            toJump: 0.08,
            toCrouch: 0.05
        },
        motion: {
            acceleration: 12.0,
            damping: 8.0,
            turnSpeed: 10.0
        },
        locomotion: {
            minBaseWeight: 0.1,  // Prevents floor clipping
            walkThreshold: 0.1,  // Speed to start blending walk
            crouchDuration: 0.5, // Unified crouch timing
            jumpDuration: 0.6,   // Jump animation duration
            jumpCancelWindow: 0.2 // When jump can be interrupted (20%)
        },
        priorities: {
            DEAD: 100,
            HIT: 90,
            ATK2: 50,
            ATK1: 40,
            JUMP: 30,
            CROUCH: 30,
            LOCOMOTION: 10
        }
    }
};

// Default character stats - these can be overridden by character configs
export const DEFAULT_CHARACTER_STATS = {
    hp: 100,
    stamina: 100,
    staminaRegen: 5, // Reduced from 12 to slow down regeneration
    moveSpeed: 4.0
};

// Default combat stats - these can be overridden by character configs
export const DEFAULT_COMBAT_STATS = {
    light: {
        dmg: 6,
        cost: 9,
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
        cost: 9,
        range: 2.2,
        window: [0.1, 0.35]
    },
    rightHand: {
        dmg: 6,
        cost: 9,
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

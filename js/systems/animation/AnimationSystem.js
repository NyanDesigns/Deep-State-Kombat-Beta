import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { AnimationController } from '../AnimationController.js';

/**
 * AnimationSystem - Main entry point for all animation operations
 * Unifies AnimationController and removes dual animation systems
 */
export class AnimationSystem {
    constructor(mixer, actions, config = {}) {
        this.mixer = mixer;
        this.actions = actions;
        this.config = config;
        
        // Initialize AnimationController
        const animConfig = {
            priorities: config.priorities || CONFIG.animation?.priorities,
            crossfade: config.crossfade || CONFIG.animation?.crossfade,
            locomotion: config.locomotion || CONFIG.animation?.locomotion,
            playbackSpeed: config.playbackSpeed || {}
        };
        
        this.animationController = new AnimationController(mixer, actions, animConfig);
    }

    /**
     * Initialize animation system (called after animations are loaded)
     * @param {object} config - Configuration object
     */
    initialize(config = {}) {
        // Update config if provided
        if (config.priorities) {
            this.animationController.priorities = config.priorities;
        }
        if (config.crossfade) {
            this.animationController.crossfadeTimes = config.crossfade;
        }
        if (config.locomotion) {
            this.animationController.locomotionConfig = config.locomotion;
        }
    }

    /**
     * Play a one-shot animation (unified entry point)
     * @param {string} name - Animation name
     * @param {object} options - Animation options
     * @returns {THREE.AnimationAction|null} Animation action or null
     */
    playOneShot(name, options = {}) {
        // Extract fade times from options or use defaults
        const fadeIn = options.fadeIn !== undefined 
            ? options.fadeIn 
            : (options.priority === CONFIG.animation.priorities.HIT 
                ? CONFIG.animation.crossfade.toHit 
                : CONFIG.animation.crossfade.toAttack);
        
        const fadeOut = options.fadeOut !== undefined 
            ? options.fadeOut 
            : CONFIG.animation.crossfade.toBase;
        
        // Call AnimationController
        return this.animationController.playOneShot(name, fadeIn, fadeOut, options);
    }

    /**
     * Update locomotion blend based on speed and direction
     * @param {number} speedNormalized - Normalized speed (0-1)
     * @param {number} direction - Movement direction (1 = forward, -1 = backward, 0 = none)
     */
    updateLocomotionBlend(speedNormalized, direction = 1) {
        this.animationController.updateLocomotionBlend(speedNormalized, direction);
    }

    /**
     * Update animation system (called each frame)
     * @param {number} dt - Delta time
     */
    update(dt) {
        this.animationController.update(dt);
    }

    /**
     * Transition back to base locomotion layer
     * @param {number} fadeTime - Fade time for transition (optional)
     */
    transitionToBase(fadeTime = null) {
        this.animationController.transitionToBase(fadeTime);
    }

    /**
     * Get current animation action
     * @returns {THREE.AnimationAction|null} Current action or null
     */
    getCurrentAnimation() {
        return this.animationController.getCurrentAnimation();
    }

    /**
     * Get current animation state name
     * @returns {string} Current animation state
     */
    getCurrentAnimationState() {
        return this.animationController.getCurrentAnimationState();
    }

    /**
     * Get current animation priority
     * @returns {number} Current priority
     */
    getCurrentPriority() {
        return this.animationController.getCurrentPriority();
    }

    /**
     * Check if a new action can interrupt the current one
     * @param {number} priority - Priority of new action
     * @returns {boolean} True if can interrupt
     */
    canInterrupt(priority) {
        return this.animationController.canInterrupt(priority);
    }

    /**
     * Prevent auto-return for current animation
     */
    preventAutoReturn() {
        this.animationController.preventAutoReturn();
    }

    /**
     * Apply playback curves (for jump animation speed variation)
     * @param {THREE.AnimationAction} action - Animation action
     */
    applyPlaybackCurves(action) {
        if (!action) return;
        const clip = action.getClip();
        if (!clip || clip.duration <= 0) return;

        const clipName = clip.name?.toLowerCase() || '';
        const isJump = clipName.includes('jump');

        // Only apply curves to jump (crouch is now looping, so keep constant speed)
        if (!isJump) return;

        const ratio = Math.min(Math.max(action.time / clip.duration, 0), 1);

        // Fast at start, ease down toward end (quadratic ease-out)
        const startSpeed = 6.0;
        const endSpeed = 2.8;
        const ease = Math.pow(1 - ratio, 2); // 1 at start, 0 at end
        const targetSpeed = endSpeed + (startSpeed - endSpeed) * ease;

        const direction = action.timeScale < 0 ? -1 : 1;
        action.setEffectiveTimeScale(direction * targetSpeed);
    }
}



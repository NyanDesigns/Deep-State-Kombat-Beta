import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Priority system for animation layers
 */
const PRIORITY = {
    DEAD: 100,
    HIT: 90,
    ATK2: 50,
    ATK1: 40,
    JUMP: 30,
    CROUCH: 30,
    LOCOMOTION: 10
};

/**
 * AnimationController - Centralized animation management with layer system
 * 
 * Features:
 * - Base Locomotion Layer: Always-running idle/walk blend (prevents floor clipping)
 * - Action Layer: One-shot animations (attacks, hit, jump, crouch) with priorities
 * - Crossfade transitions: Smooth blending between animations
 * - Animation finished events: Automatic return to base layer
 */
export class AnimationController {
    constructor(mixer, actions, config = {}) {
        this.mixer = mixer;
        this.actions = actions;
        this.config = config;
        
        // Priority system (from config or defaults)
        this.priorities = config.priorities || PRIORITY;
        
        // Base locomotion layer (always active)
        this.baseLayer = {
            idle: null,
            walk: null,
            idleWeight: 1.0,
            walkWeight: 0.0
        };
        
        // Action layer (one-shot animations)
        this.actionLayer = {
            current: null,
            currentPriority: 0,
            currentName: null,
            autoReturn: true,
            cancelWindow: 0,
            onFinished: null
        };
        
        // Transition settings
        this.crossfadeTimes = config.crossfade || {
            toAttack: 0.12,
            toHit: 0.08,
            toBase: 0.20,
            withinCombo: 0.05,
            toJump: 0.08,
            toCrouch: 0.05
        };
        
        // Locomotion settings
        this.locomotionConfig = config.locomotion || {
            minBaseWeight: 0.1,
            walkThreshold: 0.1
        };
        
        // Initialize base layer
        this.initializeBaseLayers();
        
        // Setup mixer event listeners
        this.setupEventListeners();
    }
    
    /**
     * Initialize base locomotion layer (idle + walk)
     */
    initializeBaseLayers() {
        // Get idle and walk actions
        this.baseLayer.idle = this.actions['idle'] || this.actions['breath'];
        this.baseLayer.walk = this.actions['walk'];
        
        // Start base layer animations
        if (this.baseLayer.idle) {
            this.baseLayer.idle.reset().fadeIn(0).play();
            this.baseLayer.idle.setEffectiveWeight(1.0);
        }
        
        if (this.baseLayer.walk) {
            this.baseLayer.walk.reset().fadeIn(0).play();
            this.baseLayer.walk.setEffectiveWeight(0.0);
        }
    }
    
    /**
     * Setup mixer event listeners for animation finished events
     */
    setupEventListeners() {
        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e.action);
        });
    }
    
    /**
     * Handle animation finished event
     * This is the PRIMARY mechanism for detecting animation completion
     */
    onAnimationFinished(action) {
        // Only handle action layer animations
        if (this.actionLayer.current !== action) {
            return;
        }
        
        // Call user callback if provided
        if (this.actionLayer.onFinished) {
            this.actionLayer.onFinished();
            this.actionLayer.onFinished = null;
        }
        
        // Auto-return to base layer if enabled and not clamped
        if (this.actionLayer.autoReturn && !action.clampWhenFinished) {
            this.transitionToBase(this.crossfadeTimes.toBase);
        }
    }
    
    /**
     * Update locomotion blend based on speed and direction
     * @param {number} speedNormalized - Normalized speed (0-1)
     * @param {number} direction - Movement direction (1 = forward, -1 = backward, 0 = none)
     */
    updateLocomotionBlend(speedNormalized, direction = 1) {
        if (!this.baseLayer.idle && !this.baseLayer.walk) return;
        
        // Ensure base layer is always active (prevents floor clipping)
        const minWeight = this.locomotionConfig.minBaseWeight;
        
        // Calculate blend weights
        const walkWeight = Math.max(0, Math.min(1, speedNormalized));
        const idleWeight = Math.max(minWeight, 1.0 - walkWeight);
        
        // Update weights
        if (this.baseLayer.idle) {
            this.baseLayer.idle.setEffectiveWeight(idleWeight);
        }
        
        if (this.baseLayer.walk) {
            // Set walk weight
            this.baseLayer.walk.setEffectiveWeight(walkWeight);
            
            // Set direction via timeScale
            if (this.baseLayer.walk && walkWeight > 0) {
                const baseSpeed = this.config.playbackSpeed?.walk || 1.0;
                const timeScale = direction >= 0 ? baseSpeed : -baseSpeed;
                this.baseLayer.walk.setEffectiveTimeScale(timeScale);
            }
        }
    }
    
    /**
     * Play a one-shot animation on the action layer
     * @param {string} name - Animation name
     * @param {number} fadeIn - Fade in time
     * @param {number} fadeOut - Fade out time
     * @param {object} options - Additional options
     */
    playOneShot(name, fadeIn, fadeOut, options = {}) {
        const action = this.actions[name];
        if (!action) {
            console.warn(`AnimationController: Animation "${name}" not found`);
            return null;
        }
        
        // SIMPLIFIED: Only prevent if the EXACT same action is actively running
        // This allows retriggering after animation finishes, and allows different instances
        // of the same animation clip to play (e.g., restarting from beginning)
        if (this.actionLayer.current === action && action.isRunning() && !action.paused) {
            // Same action is actively running - don't restart it
            return null;
        }
        
        // Check priority/interrupt rules
        const priority = options.priority || this.getPriorityForAnimation(name);
        if (!this.canInterrupt(priority)) {
            return null;
        }
        
        // Fade out current action if it's different
        if (this.actionLayer.current && this.actionLayer.current !== action) {
            this.actionLayer.current.fadeOut(fadeOut || this.crossfadeTimes.toBase);
        }
        
        // Get clip for duration calculations
        const clip = action.getClip();
        
        // Calculate playback speed
        let playbackSpeed = 1.0;
        if (options.desiredDuration && clip && clip.duration > 0) {
            playbackSpeed = clip.duration / options.desiredDuration;
        } else if (options.timeScale !== undefined) {
            playbackSpeed = options.timeScale;
        } else {
            playbackSpeed = this.config.playbackSpeed?.[name] || 1.0;
        }
        
        // Apply direction (reverse = negative timeScale)
        const direction = options.reverse ? -1 : 1;
        action.setEffectiveTimeScale(direction * playbackSpeed);
        
        // Reset and set starting time
        action.reset();
        if (options.reverse) {
            action.time = clip ? clip.duration : 0; // Start from end for reverse
        } else {
            action.time = 0; // Start from beginning for forward
        }
        
        // Set loop mode
        if (options.loop !== undefined) {
            action.setLoop(options.loop);
        }
        
        // Set clamp
        if (options.clamp !== undefined) {
            action.clampWhenFinished = options.clamp;
        }
        
        // Crossfade from previous action or fade in
        if (this.actionLayer.current && this.actionLayer.current !== action) {
            action.crossFadeFrom(this.actionLayer.current, fadeIn || this.crossfadeTimes.toAttack, true);
        } else {
            action.fadeIn(fadeIn || this.crossfadeTimes.toAttack);
        }
        
        // Play the action
        action.play();
        
        // Update action layer tracking
        this.actionLayer.current = action;
        this.actionLayer.currentPriority = priority;
        this.actionLayer.currentName = name;
        this.actionLayer.autoReturn = options.autoReturn !== false; // Default true
        this.actionLayer.cancelWindow = options.cancelWindow || 0;
        
        // Store callback
        if (options.onFinished) {
            this.actionLayer.onFinished = options.onFinished;
        } else {
            this.actionLayer.onFinished = null;
        }
        
        return action;
    }
    
    /**
     * Transition back to base locomotion layer
     * @param {number} fadeTime - Fade time for transition
     */
    transitionToBase(fadeTime) {
        if (this.actionLayer.current) {
            this.actionLayer.current.fadeOut(fadeTime || this.crossfadeTimes.toBase);
        }
        
        // Clear action layer (don't call onFinished here - it was already called in onAnimationFinished)
        this.actionLayer.current = null;
        this.actionLayer.currentPriority = 0;
        this.actionLayer.currentName = null;
        this.actionLayer.autoReturn = true;
        this.actionLayer.onFinished = null;
    }
    
    /**
     * Get priority for an animation name
     */
    getPriorityForAnimation(name) {
        const nameLower = name.toLowerCase();
        
        if (nameLower.includes('die') || nameLower.includes('death')) return this.priorities.DEAD;
        if (nameLower.includes('hit') || nameLower.includes('damage')) return this.priorities.HIT;
        if (nameLower.includes('kick') || nameLower.includes('atk2') || nameLower.includes('heavy')) return this.priorities.ATK2;
        if (nameLower.includes('punch') || nameLower.includes('atk1') || nameLower.includes('light')) return this.priorities.ATK1;
        if (nameLower.includes('jump')) return this.priorities.JUMP;
        if (nameLower.includes('crouch')) return this.priorities.CROUCH;
        
        return this.priorities.LOCOMOTION;
    }
    
    /**
     * Check if a new action can interrupt the current one
     * @param {number} newPriority - Priority of the new action
     */
    canInterrupt(newPriority) {
        // No current action - can always interrupt
        if (!this.actionLayer.current) return true;
        
        // Check if current action is in cancel window
        if (this.actionLayer.cancelWindow > 0 && this.actionLayer.current) {
            const clip = this.actionLayer.current.getClip();
            if (clip && clip.duration > 0) {
                const ratio = this.actionLayer.current.time / clip.duration;
                if (ratio >= this.actionLayer.cancelWindow) {
                    // In cancel window - can be interrupted by same or higher priority
                    return newPriority >= this.actionLayer.currentPriority;
                }
            }
        }
        
        // Normal priority check - higher priority can interrupt
        return newPriority >= this.actionLayer.currentPriority;
    }
    
    /**
     * Get current animation priority
     */
    getCurrentPriority() {
        return this.actionLayer.currentPriority || this.priorities.LOCOMOTION;
    }
    
    /**
     * Get current animation state name
     */
    getCurrentAnimationState() {
        return this.actionLayer.currentName || 'LOCOMOTION';
    }
    
    /**
     * Get current action
     */
    getCurrentAnimation() {
        return this.actionLayer.current;
    }
    
    /**
     * Prevent auto-return for current animation (useful for clamped animations like crouch)
     */
    preventAutoReturn() {
        if (this.actionLayer.current) {
            this.actionLayer.autoReturn = false;
        }
    }
    
    /**
     * Update animation controller (called each frame)
     * @param {number} dt - Delta time
     */
    update(dt) {
        // Ensure clamped animations stay at the end position
        if (this.actionLayer.current) {
            const action = this.actionLayer.current;
            const clip = action.getClip();
            
            if (action.clampWhenFinished && clip && clip.duration > 0) {
                // Keep clamped animations at the end
                if (action.time >= clip.duration) {
                    action.time = clip.duration;
                    // Ensure it stays active (not paused)
                    if (action.paused) {
                        action.paused = false;
                    }
                    if (!action.isRunning()) {
                        action.play();
                    }
                }
                // Prevent auto-return for clamped animations
                this.actionLayer.autoReturn = false;
            }
        }
        
        // NOTE: We do NOT poll for animation completion here
        // Animation completion is handled entirely by the 'finished' event
        // This ensures animations play their full duration without being cut short
    }
}

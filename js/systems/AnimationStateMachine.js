import { CONFIG } from '../config.js';

/**
 * AnimationStateMachine - Manage animation state transitions with rules and validation
 * 
 * Features:
 * - State transition validation
 * - Priority-based state changes
 * - State history tracking (for debugging)
 */
export class AnimationStateMachine {
    constructor(config = {}) {
        this.config = config;
        
        // Priority system
        this.priorities = config.priorities || {
            DEAD: 100,
            HIT: 90,
            ATK2: 50,
            ATK1: 40,
            JUMP: 30,
            CROUCH: 30,
            LOCOMOTION: 10
        };
        
        // Current state
        this.currentState = 'LOCOMOTION';
        
        // State history (for debugging)
        this.stateHistory = [];
        this.maxHistorySize = 10;
        
        // Transition rules
        this.transitionRules = {
            // Can always transition to DEAD
            DEAD: () => true,
            
            // HIT can interrupt most things except DEAD
            HIT: (fromState) => fromState !== 'DEAD',
            
            // Attacks can interrupt locomotion, jump, crouch
            ATTACK: (fromState) => {
                return fromState === 'LOCOMOTION' || 
                       fromState === 'WALK' || 
                       fromState === 'IDLE' ||
                       fromState === 'JUMP' ||
                       fromState === 'CROUCH';
            },
            
            // Jump can interrupt locomotion
            JUMP: (fromState) => {
                return fromState === 'LOCOMOTION' || 
                       fromState === 'WALK' || 
                       fromState === 'IDLE';
            },
            
            // Crouch can interrupt locomotion
            CROUCH: (fromState) => {
                return fromState === 'LOCOMOTION' || 
                       fromState === 'WALK' || 
                       fromState === 'IDLE';
            },
            
            // Locomotion can be entered from most states
            LOCOMOTION: (fromState) => {
                return fromState !== 'DEAD';
            }
        };
    }
    
    /**
     * Check if a transition is allowed
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is allowed
     */
    canTransition(fromState, toState) {
        // Same state - always allowed (no-op)
        if (fromState === toState) return true;
        
        // Check transition rules
        const rule = this.transitionRules[toState];
        if (rule) {
            return rule(fromState);
        }
        
        // Default: check priority
        const fromPriority = this.priorities[fromState] || 0;
        const toPriority = this.priorities[toState] || 0;
        
        return toPriority >= fromPriority;
    }
    
    /**
     * Request a state transition
     * @param {string} toState - Target state
     * @param {object} params - Transition parameters
     * @returns {boolean} True if transition was successful
     */
    requestTransition(toState, params = {}) {
        const fromState = this.currentState;
        
        if (this.canTransition(fromState, toState)) {
            // Record transition in history
            this.recordTransition(fromState, toState, params);
            
            // Update current state
            this.currentState = toState;
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Record a state transition in history
     * @param {string} fromState - Previous state
     * @param {string} toState - New state
     * @param {object} params - Transition parameters
     */
    recordTransition(fromState, toState, params) {
        this.stateHistory.push({
            from: fromState,
            to: toState,
            timestamp: performance.now(),
            params: params
        });
        
        // Limit history size
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Set current state (for initialization)
     * @param {string} state - State to set
     */
    setCurrentState(state) {
        this.currentState = state;
    }
    
    /**
     * Get state history
     * @returns {Array} State history
     */
    getStateHistory() {
        return [...this.stateHistory];
    }
    
    /**
     * Clear state history
     */
    clearHistory() {
        this.stateHistory = [];
    }
    
    /**
     * Get priority for a state
     * @param {string} state - State name
     * @returns {number} Priority value
     */
    getPriority(state) {
        return this.priorities[state] || 0;
    }
}





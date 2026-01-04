import { CONFIG } from '../config.js';

/**
 * StateManager - Unified state management system
 * Replaces Fighter.state (string) and integrates AnimationStateMachine functionality
 */
export class StateManager {
    constructor(config = {}) {
        this.config = config;
        
        // Priority system
        this.priorities = config.priorities || CONFIG.animation?.priorities || {
            DEAD: 100,
            HIT: 90,
            ATK2: 50,
            ATK1: 40,
            JUMP: 30,
            CROUCH: 30,
            LOCOMOTION: 10
        };
        
        // Current state
        this.currentState = 'IDLE';
        
        // State history (for debugging)
        this.stateHistory = [];
        this.maxHistorySize = 10;
        
        // Transition rules (integrated from AnimationStateMachine)
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
            },
            
            // IDLE and WALK are locomotion states
            IDLE: (fromState) => {
                return fromState !== 'DEAD';
            },
            WALK: (fromState) => {
                return fromState !== 'DEAD';
            },
            
            // STUN can be entered from most states
            STUN: (fromState) => {
                return fromState !== 'DEAD';
            }
        };
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Check if currently in a specific state
     * @param {string} state - State to check
     * @returns {boolean} True if in state
     */
    isInState(state) {
        return this.currentState === state;
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
    transitionTo(toState, params = {}) {
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
     * Set state directly (for initialization or forced transitions)
     * @param {string} state - State to set
     */
    setState(state) {
        const fromState = this.currentState;
        this.recordTransition(fromState, state, { forced: true });
        this.currentState = state;
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



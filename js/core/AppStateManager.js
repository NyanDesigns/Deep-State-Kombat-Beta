/**
 * AppStateManager - Centralized application state machine and lifecycle management
 * Manages application-level states (bootstrap, initializing, loading, ready, active)
 * Coordinates initialization flow and session detection
 */
export class AppStateManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.currentState = null;
        this.previousState = null;
        
        // State definitions
        this.STATES = {
            BOOTSTRAP: 'bootstrap',       // Creating system instances
            INITIALIZING: 'initializing', // Async initialization of systems
            LOADING: 'loading',           // UI loading sequence (first visit)
            READY: 'ready',               // All systems ready, at setup screen
            ACTIVE: 'active'              // Game in progress
        };

        // Event callbacks
        this.onStateChange = null;
        this.onBootstrapComplete = null;
        this.onInitializeComplete = null;
        this.onLoadingComplete = null;
        this.onReady = null;
    }

    /**
     * Set the current state and notify listeners
     * @param {string} newState - New state name
     */
    setState(newState) {
        if (this.currentState === newState) return;

        this.previousState = this.currentState;
        this.currentState = newState;

        if (this.onStateChange) {
            this.onStateChange(newState, this.previousState);
        }

        console.log(`AppState: ${this.previousState || 'null'} → ${newState}`);
    }

    /**
     * Get current state
     * @returns {string} Current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Get previous state
     * @returns {string} Previous state
     */
    getPreviousState() {
        return this.previousState;
    }

    /**
     * Check if currently in a specific state
     * @param {string} state - State to check
     * @returns {boolean} True if in the specified state
     */
    isState(state) {
        return this.currentState === state;
    }

    /**
     * Bootstrap phase - create all system instances
     * @param {Function} bootstrapCallback - Callback to create systems
     * @returns {Promise<Object>} Object containing all created systems
     */
    async bootstrap(bootstrapCallback) {
        this.setState(this.STATES.BOOTSTRAP);
        
        if (!bootstrapCallback) {
            throw new Error('Bootstrap callback is required');
        }

        const systems = await bootstrapCallback();
        
        if (this.onBootstrapComplete) {
            this.onBootstrapComplete(systems);
        }

        return systems;
    }

    /**
     * Initialize phase - initialize all systems
     * The loading strategy decision is made by the caller
     * @param {Function} initializeCallback - Callback to initialize systems and run loading
     * @returns {Promise<void>}
     */
    async initialize(initializeCallback) {
        this.setState(this.STATES.INITIALIZING);
        
        if (!initializeCallback) {
            throw new Error('Initialize callback is required');
        }

        // The callback handles system initialization and loading strategy
        await initializeCallback();
    }

    /**
     * Run first load sequence with full animations
     * @returns {Promise<void>}
     */
    async runFirstLoadSequence() {
        this.setState(this.STATES.LOADING);

        // Return a promise that will be resolved by LoadingOrchestrator
        // This method signature allows the orchestrator to be passed in
        return new Promise((resolve) => {
            this._firstLoadResolve = resolve;
            // Actual loading will be triggered by LoadingOrchestrator
        });
    }

    /**
     * Complete first load sequence
     * @returns {void}
     */
    completeFirstLoad() {
        this.storage.markSessionInitComplete();
        
        if (this._firstLoadResolve) {
            this._firstLoadResolve();
            this._firstLoadResolve = null;
        }

        if (this.onLoadingComplete) {
            this.onLoadingComplete();
        }

        this.setState(this.STATES.READY);
        
        if (this.onReady) {
            this.onReady();
        }
    }

    /**
     * Run quick load (skip animations for subsequent visits)
     * @returns {Promise<void>}
     */
    async runQuickLoad() {
        // Quick load happens almost instantly, but we still set loading state briefly
        this.setState(this.STATES.LOADING);
        
        // Brief delay to ensure UI is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (this.onLoadingComplete) {
            this.onLoadingComplete();
        }

        this.setState(this.STATES.READY);
        
        if (this.onReady) {
            this.onReady();
        }
    }

    /**
     * Mark application as active (game started)
     */
    setActive() {
        this.setState(this.STATES.ACTIVE);
    }

    /**
     * Return to ready state (from game back to setup)
     */
    returnToReady() {
        this.setState(this.STATES.READY);
    }

    /**
     * Check if application is ready for user interaction
     * @returns {boolean} True if ready
     */
    isReady() {
        return this.currentState === this.STATES.READY || 
               this.currentState === this.STATES.ACTIVE;
    }

    /**
     * Check if application is currently loading
     * @returns {boolean} True if loading
     */
    isLoading() {
        return this.currentState === this.STATES.LOADING ||
               this.currentState === this.STATES.INITIALIZING;
    }
}


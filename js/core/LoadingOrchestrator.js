import { FirstLoadStrategy, QuickLoadStrategy } from './LoadingStrategy.js';

/**
 * LoadingOrchestrator - Orchestrates the loading sequence using strategy pattern
 * Separates loading logic from UI animation concerns
 */
export class LoadingOrchestrator {
    constructor(strategy = null, uiController = null) {
        this.strategy = strategy;
        this.uiController = uiController;
        this.currentPhase = null;
        this.isCancelled = false;
        
        // Phase callbacks
        this.onParticlesReady = null;
        this.onTitleReady = null;
        this.onGridReady = null;
        this.onCharactersReady = null;
        this.onComplete = null;
        
        // Progress tracking
        this.onPhaseChange = null;
        this.onProgress = null;
        this.phaseCallbacks = new Map();
    }

    /**
     * Execute the loading sequence using the configured strategy
     * @returns {Promise<void>}
     */
    async execute() {
        if (!this.strategy) {
            throw new Error('LoadingStrategy must be set before execution');
        }

        this.isCancelled = false;
        this.currentPhase = null;

        try {
            await this.strategy.execute(this);
        } catch (error) {
            if (!this.isCancelled) {
                console.error('Loading sequence error:', error);
                throw error;
            }
        }
    }

    /**
     * Execute a loading phase
     * @param {string} phaseName - Name of the phase
     * @param {Function} phaseFn - Function to execute for this phase
     * @returns {Promise<void>}
     */
    async phase(phaseName, phaseFn) {
        if (this.isCancelled) {
            return;
        }

        this.currentPhase = phaseName;
        
        // Update UI state controller if available
        if (this.uiController) {
            this.uiController.setLoadingPhase(phaseName);
        }

        // Notify phase change
        if (this.onPhaseChange) {
            this.onPhaseChange(phaseName);
        }

        // Execute phase-specific callbacks
        const phaseCallback = this.phaseCallbacks.get(phaseName);
        if (phaseCallback) {
            await phaseCallback();
        }

        // Execute the phase function
        if (phaseFn) {
            await phaseFn();
        }
    }

    /**
     * Register a callback for a specific phase
     * @param {string} phaseName - Phase name
     * @param {Function} callback - Callback function
     */
    onPhase(phaseName, callback) {
        this.phaseCallbacks.set(phaseName, callback);
    }

    /**
     * Get current phase
     * @returns {string} Current phase name
     */
    getCurrentPhase() {
        return this.currentPhase;
    }

    /**
     * Cancel the loading sequence
     */
    cancel() {
        this.isCancelled = true;
        this.currentPhase = null;
    }

    /**
     * Check if loading is cancelled
     * @returns {boolean} True if cancelled
     */
    isCancelled() {
        return this.isCancelled;
    }

    /**
     * Set the loading strategy
     * @param {LoadingStrategy} strategy - Loading strategy instance
     */
    setStrategy(strategy) {
        this.strategy = strategy;
    }

    /**
     * Create orchestrator with FirstLoadStrategy
     * @param {UIStateController} uiController - UI state controller
     * @returns {LoadingOrchestrator}
     */
    static createFirstLoad(uiController = null) {
        return new LoadingOrchestrator(new FirstLoadStrategy(), uiController);
    }

    /**
     * Create orchestrator with QuickLoadStrategy
     * @param {UIStateController} uiController - UI state controller
     * @returns {LoadingOrchestrator}
     */
    static createQuickLoad(uiController = null) {
        return new LoadingOrchestrator(new QuickLoadStrategy(), uiController);
    }
}




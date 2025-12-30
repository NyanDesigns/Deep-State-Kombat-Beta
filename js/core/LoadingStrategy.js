/**
 * Base class for loading strategies
 * Defines the interface for different loading approaches
 */
export class LoadingStrategy {
    /**
     * Execute the loading strategy
     * @param {LoadingOrchestrator} orchestrator - The loading orchestrator instance
     * @returns {Promise<void>}
     */
    async execute(orchestrator) {
        throw new Error('LoadingStrategy.execute() must be implemented by subclass');
    }
}

/**
 * FirstLoadStrategy - Full cinematic loading sequence with animations
 * Used for first-time visitors
 */
export class FirstLoadStrategy extends LoadingStrategy {
    async execute(orchestrator) {
        // Phase 1: Particles start immediately
        await orchestrator.phase('particles', async () => {
            if (orchestrator.onParticlesReady) {
                orchestrator.onParticlesReady();
            }
        });

        // Phase 2: Title appears after short delay (150ms)
        await orchestrator.phase('title', async () => {
            await this.delay(150);
            if (orchestrator.onTitleReady) {
                orchestrator.onTitleReady();
            }
        });

        // Phase 3: Grid becomes visible after title animation (2800ms total)
        await orchestrator.phase('grid', async () => {
            await this.delay(2650); // 2800 - 150 initial delay
            if (orchestrator.onGridReady) {
                orchestrator.onGridReady();
            }
        });

        // Phase 4: Characters start loading sequentially (2950ms total)
        await orchestrator.phase('characters', async () => {
            await this.delay(150); // 2950 - 2800 previous phase
            if (orchestrator.onCharactersReady) {
                orchestrator.onCharactersReady();
            }
        });

        // Phase 5: Complete
        await orchestrator.phase('complete', async () => {
            if (orchestrator.onComplete) {
                orchestrator.onComplete();
            }
        });
    }

    /**
     * Helper to create a delay
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * QuickLoadStrategy - Instant setup without animations
 * Used for subsequent visits
 */
export class QuickLoadStrategy extends LoadingStrategy {
    async execute(orchestrator) {
        // Start particles if needed (but don't wait for animation)
        if (orchestrator.onParticlesReady) {
            orchestrator.onParticlesReady();
        }

        // Show title immediately
        if (orchestrator.onTitleReady) {
            orchestrator.onTitleReady();
        }

        // Show grid immediately
        if (orchestrator.onGridReady) {
            orchestrator.onGridReady();
        }

        // Initialize character selector without sequential loading
        if (orchestrator.onCharactersReady) {
            orchestrator.onCharactersReady();
        }

        // Set UI to loaded state immediately (after callbacks are set up)
        if (orchestrator.uiController) {
            orchestrator.uiController.setLoadedState();
        }

        // Mark complete immediately
        await orchestrator.phase('complete', async () => {
            if (orchestrator.onComplete) {
                orchestrator.onComplete();
            }
        });
    }
}


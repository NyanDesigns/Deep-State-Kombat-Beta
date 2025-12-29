/**
 * LoadingManager - Orchestrates the progressive loading sequence
 * Sequence: Particles → Title → Character Grid → Characters (sequential)
 */
export class LoadingManager {
    constructor() {
        this.currentPhase = 'particles'; // particles → title → grid → characters → complete
        this.onPhaseChange = null;
    }

    /**
     * Start the loading sequence
     * @param {Object} callbacks - Object with phase callbacks
     * @param {Function} callbacks.onParticlesReady - Called when particles should start
     * @param {Function} callbacks.onTitleReady - Called when title should appear
     * @param {Function} callbacks.onGridReady - Called when grid should become visible
     * @param {Function} callbacks.onCharactersReady - Called when character loading should start
     * @param {Function} callbacks.onComplete - Called when all loading is complete
     */
    start(callbacks = {}) {
        const {
            onParticlesReady,
            onTitleReady,
            onGridReady,
            onCharactersReady,
            onComplete
        } = callbacks;

        // Phase 1: Particles start immediately (0ms)
        this.setPhase('particles');
        if (onParticlesReady) {
            onParticlesReady();
        }

        // Phase 2: Title appears after short delay (100-200ms)
        setTimeout(() => {
            this.setPhase('title');
            if (onTitleReady) {
                onTitleReady();
            }
        }, 150);

        // Phase 3: Grid becomes visible after title animation completes (2.5s animation + buffer)
        // Title animation is 2.5s, so wait until it's mostly done before showing grid
        setTimeout(() => {
            this.setPhase('grid');
            if (onGridReady) {
                onGridReady();
            }
        }, 2800); // 150ms initial delay + 2500ms animation + 150ms buffer

        // Phase 4: Characters start loading sequentially after grid appears
        setTimeout(() => {
            this.setPhase('characters');
            if (onCharactersReady) {
                onCharactersReady();
            }
        }, 2950); // Grid appears + 150ms buffer (faster)
    }

    /**
     * Mark loading as complete
     * @param {Function} onComplete - Callback when complete
     */
    complete(onComplete) {
        this.setPhase('complete');
        if (onComplete) {
            onComplete();
        }
    }

    /**
     * Set the current loading phase
     * @param {string} phase - The phase name
     */
    setPhase(phase) {
        this.currentPhase = phase;
        
        // Update setup screen class for CSS state management
        const setupScreen = document.getElementById('setup-screen');
        if (setupScreen) {
            // Remove all loading phase classes
            setupScreen.classList.remove(
                'loading-particles',
                'loading-title',
                'loading-grid',
                'loading-characters',
                'loaded'
            );
            
            // Add current phase class
            switch (phase) {
                case 'particles':
                    setupScreen.classList.add('loading-particles');
                    break;
                case 'title':
                    setupScreen.classList.add('loading-title');
                    break;
                case 'grid':
                    setupScreen.classList.add('loading-grid');
                    break;
                case 'characters':
                    setupScreen.classList.add('loading-characters');
                    break;
                case 'complete':
                    setupScreen.classList.add('loaded');
                    break;
            }
        }

        if (this.onPhaseChange) {
            this.onPhaseChange(phase);
        }
    }

    /**
     * Get current loading phase
     * @returns {string} Current phase
     */
    getPhase() {
        return this.currentPhase;
    }
}


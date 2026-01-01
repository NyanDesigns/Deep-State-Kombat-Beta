/**
 * UIStateController - Centralized UI state management
 * Controls visibility states, CSS classes, and UI transitions
 * Coordinates between SetupScreen, HUD, PauseMenu, and other UI components
 */
export class UIStateController {
    constructor() {
        this.setupScreen = null;
        this.currentLoadingPhase = null;
        
        // UI element references (cached for performance)
        this.elements = {
            setupScreen: null,
            title: null,
            gridContainer: null,
            infoPanel: null,
            chooseFighterText: null,
            nameDisplays: null,
            p1PNG: null,
            p2PNG: null
        };

        // Initialize element references
        this.initializeElements();
    }

    /**
     * Cache DOM element references
     */
    initializeElements() {
        this.elements.setupScreen = document.getElementById('setup-screen');
        this.elements.title = document.querySelector('.game-title-logo');
        this.elements.gridContainer = document.getElementById('character-grid-container');
        this.elements.infoPanel = document.getElementById('character-info-panel');
        this.elements.chooseFighterText = document.getElementById('choose-fighter-text');
        this.elements.nameDisplays = document.querySelectorAll('.character-name-display');
        this.elements.p1PNG = document.getElementById('p1-background-png-image');
        this.elements.p2PNG = document.getElementById('p2-background-png-image');
    }

    /**
     * Set loading phase and update CSS classes
     * @param {string} phase - Loading phase name (particles, title, grid, characters, complete)
     */
    setLoadingPhase(phase) {
        this.currentLoadingPhase = phase;
        
        if (!this.elements.setupScreen) return;

        // Remove all loading phase classes
        this.elements.setupScreen.classList.remove(
            'loading-particles',
            'loading-title',
            'loading-grid',
            'loading-characters',
            'loaded'
        );
        
        // Add current phase class
        switch (phase) {
            case 'particles':
                this.elements.setupScreen.classList.add('loading-particles');
                break;
            case 'title':
                this.elements.setupScreen.classList.add('loading-title');
                break;
            case 'grid':
                this.elements.setupScreen.classList.add('loading-grid');
                break;
            case 'characters':
                this.elements.setupScreen.classList.add('loading-characters');
                break;
            case 'complete':
                this.elements.setupScreen.classList.add('loaded');
                break;
        }
    }

    /**
     * Set UI to fully loaded state (skip animations)
     * Instantly shows all elements in their final state
     */
    setLoadedState() {
        this.setLoadingPhase('complete');

        // Show title immediately
        if (this.elements.title) {
            this.elements.title.classList.add('title-visible');
        }

        // Show grid container immediately
        if (this.elements.gridContainer) {
            this.elements.gridContainer.classList.add('pop-visible');
        }

        // Show name displays immediately
        this.elements.nameDisplays.forEach(display => {
            display.classList.add('pop-visible');
        });

        // Show info panel immediately
        if (this.elements.infoPanel) {
            this.elements.infoPanel.classList.add('pop-visible');
        }

        // Show choose fighter text immediately
        if (this.elements.chooseFighterText) {
            this.elements.chooseFighterText.classList.add('slide-in');
        }

        // Show background PNGs immediately
        if (this.elements.p1PNG) {
            this.elements.p1PNG.style.display = 'block';
            this.elements.p1PNG.classList.add('slide-in');
        }

        if (this.elements.p2PNG) {
            this.elements.p2PNG.style.display = 'block';
            this.elements.p2PNG.classList.add('slide-in');
        }
    }

    /**
     * Show title animation
     */
    showTitle() {
        if (this.elements.title) {
            this.elements.title.classList.add('title-visible');
        }
    }

    /**
     * Show grid with pop-in animation
     */
    showGrid() {
        if (this.elements.gridContainer) {
            this.elements.gridContainer.classList.add('pop-visible');
        }

        // Stagger name displays slightly
        this.elements.nameDisplays.forEach((display, index) => {
            setTimeout(() => {
                display.classList.add('pop-visible');
            }, 200 + (index * 100)); // 200ms delay + 100ms between each
        });
    }

    /**
     * Show info panel
     */
    showInfoPanel() {
        if (this.elements.infoPanel) {
            setTimeout(() => {
                this.elements.infoPanel.classList.add('pop-visible');
            }, 100);
        }
    }

    /**
     * Show choose fighter text with slide-in animation
     */
    showChooseFighterText() {
        if (this.elements.chooseFighterText) {
            setTimeout(() => {
                this.elements.chooseFighterText.classList.add('slide-in');
            }, 350);
        }
    }

    /**
     * Show background PNGs with slide-in animation
     */
    showBackgroundPNGs() {
        // P1 PNG first
        if (this.elements.p1PNG) {
            setTimeout(() => {
                this.elements.p1PNG.style.display = 'block';
                this.elements.p1PNG.classList.add('slide-in');
            }, 700);
        }

        // P2 PNG after P1
        if (this.elements.p2PNG) {
            setTimeout(() => {
                this.elements.p2PNG.style.display = 'block';
                this.elements.p2PNG.classList.add('slide-in');
            }, 900);
        }
    }

    /**
     * Get current loading phase
     * @returns {string} Current phase
     */
    getCurrentPhase() {
        return this.currentLoadingPhase;
    }

    /**
     * Reset UI state (for returning to setup screen)
     */
    reset() {
        this.currentLoadingPhase = null;
        
        // Remove all phase classes
        if (this.elements.setupScreen) {
            this.elements.setupScreen.classList.remove(
                'loading-particles',
                'loading-title',
                'loading-grid',
                'loading-characters',
                'loaded'
            );
        }

        // Reset element classes (but keep them visible since we're resetting, not hiding)
        // This would be called when returning to setup screen from game
    }
}





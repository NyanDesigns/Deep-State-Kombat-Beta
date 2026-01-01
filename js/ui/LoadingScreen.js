/**
 * LoadingScreen - Tutorial loading screen component
 * Displays game title, control tutorial, and loading progress
 */
export class LoadingScreen {
    constructor() {
        this.element = null;
        this.progressBar = null;
        this.progressFill = null;
        this.isVisible = false;
    }

    /**
     * Initialize the loading screen
     */
    init() {
        this.element = document.getElementById('loading-screen');
        if (!this.element) {
            console.error('Loading screen element not found');
            return;
        }

        this.progressBar = this.element.querySelector('.loading-bar-container');
        this.progressFill = this.element.querySelector('.loading-bar-fill');
        
        // Initially hidden
        this.element.style.display = 'none';
    }

    /**
     * Show the loading screen and reset progress
     */
    show() {
        if (!this.element) {
            console.error('Loading screen element not found');
            return;
        }

        this.isVisible = true;
        this.element.style.display = 'flex';
        this.element.style.opacity = '0';
        
        // Reset progress
        this.updateProgress(0);
        
        // Fade in
        requestAnimationFrame(() => {
            this.element.style.transition = 'opacity 0.5s ease-in';
            this.element.style.opacity = '1';
        });
    }

    /**
     * Update the loading progress bar
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        if (!this.progressFill) return;
        
        const clampedPercent = Math.max(0, Math.min(100, percent));
        this.progressFill.style.width = `${clampedPercent}%`;
    }

    /**
     * Hide the loading screen with fade out
     */
    hide() {
        if (!this.element || !this.isVisible) return;

        this.isVisible = false;
        this.element.style.transition = 'opacity 0.5s ease-out';
        this.element.style.opacity = '0';

        // Remove from DOM after fade out
        setTimeout(() => {
            if (this.element) {
                this.element.style.display = 'none';
            }
        }, 500);
    }

    /**
     * Check if loading screen is visible
     * @returns {boolean} True if visible
     */
    isShown() {
        return this.isVisible;
    }
}


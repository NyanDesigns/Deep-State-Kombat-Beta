/**
 * LoadingScreen - Tutorial loading screen component
 * Displays game title, control tutorial, and loading progress
 */
export class LoadingScreen {
    constructor() {
        this.element = null;
        this.progressBar = null;
        this.progressFill = null;
        this.progressText = null;
        this.isVisible = false;
        this.waitingForEnter = false;
        this.enterKeyHandler = null;
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
        this.progressText = this.element.querySelector('.loading-bar-text');
        
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
        this.waitingForEnter = false;
        this.element.style.display = 'flex';
        this.element.style.opacity = '0';
        
        // Reset progress
        this.updateProgress(0);
        
        // Remove any existing enter key handler
        if (this.enterKeyHandler) {
            window.removeEventListener('keydown', this.enterKeyHandler);
            this.enterKeyHandler = null;
        }
        
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
        if (!this.progressFill || !this.progressText) return;
        
        const clampedPercent = Math.max(0, Math.min(100, percent));
        this.progressFill.style.width = `${clampedPercent}%`;
        
        // Update text: show percentage until 100%, then show "Press Enter to Play"
        if (clampedPercent >= 100) {
            this.progressText.textContent = 'Press Enter to Play';
            this.progressText.classList.add('ready');
        } else {
            this.progressText.textContent = `${Math.round(clampedPercent)}%`;
            this.progressText.classList.remove('ready');
        }
    }

    /**
     * Wait for Enter key press before proceeding
     * @returns {Promise<void>}
     */
    waitForEnter() {
        if (this.waitingForEnter) {
            return this.enterPromise;
        }

        this.waitingForEnter = true;
        
        // Update text to show ready state
        if (this.progressText) {
            this.progressText.textContent = 'Press Enter to Play';
            this.progressText.classList.add('ready');
        }

        return new Promise((resolve) => {
            this.enterKeyHandler = (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    window.removeEventListener('keydown', this.enterKeyHandler);
                    this.enterKeyHandler = null;
                    this.waitingForEnter = false;
                    resolve();
                }
            };
            window.addEventListener('keydown', this.enterKeyHandler);
        });
    }

    /**
     * Hide the loading screen with fade out
     */
    hide() {
        if (!this.element || !this.isVisible) return;

        // Remove enter key handler if it exists
        if (this.enterKeyHandler) {
            window.removeEventListener('keydown', this.enterKeyHandler);
            this.enterKeyHandler = null;
        }

        this.isVisible = false;
        this.waitingForEnter = false;
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


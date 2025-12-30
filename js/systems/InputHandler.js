export class InputHandler {
    constructor() {
        this.keys = {};
        this.onPause = null;
        this.onEscapeSetup = null; // Callback for Escape key in setup screen
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;

            // Escape key handling
            if (e.key === 'Escape') {
                // Check if we're in setup screen first
                if (this.onEscapeSetup) {
                    this.onEscapeSetup();
                } else if (this.onPause) {
                    // Otherwise use pause callback
                    this.onPause();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        window.addEventListener('blur', () => {
            this.clearKeys();
        });
    }

    isKeyPressed(key) {
        return !!this.keys[key];
    }

    getKeys() {
        return { ...this.keys };
    }

    clearKeys() {
        this.keys = {};
    }

    setPauseCallback(callback) {
        this.onPause = callback;
    }

    setEscapeSetupCallback(callback) {
        this.onEscapeSetup = callback;
    }
}




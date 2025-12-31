export class InputHandler {
    constructor() {
        this.keys = {};
        this.justPressed = {}; // Tracks keys that were just pressed this frame (edge detection)
        this.onPause = null;
        this.onEscapeSetup = null; // Callback for Escape key in setup screen
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            // Only mark as justPressed if it wasn't already pressed (prevents repeat keydown events)
            if (!this.keys[e.key]) {
                this.justPressed[e.key] = true;
            }
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
            this.justPressed[e.key] = false; // Clear justPressed on keyup
        });

        window.addEventListener('blur', () => {
            this.clearKeys();
        });
    }

    isKeyPressed(key) {
        return !!this.keys[key];
    }

    /**
     * Check if a key was just pressed this frame (edge detection)
     * @param {string} key - Key to check
     * @returns {boolean} - True if key was just pressed this frame
     */
    isKeyJustPressed(key) {
        return !!this.justPressed[key];
    }

    /**
     * Consume a key press (check and clear) - used for one-time actions like attacks
     * Each key can only be consumed once per frame
     * @param {string} key - Key to consume
     * @returns {boolean} - True if key was just pressed and is now consumed
     */
    consumeKey(key) {
        if (this.justPressed[key]) {
            this.justPressed[key] = false; // Consume the key press
            return true;
        }
        return false;
    }

    /**
     * Clear all justPressed keys - should be called at the start of each frame
     * This is handled automatically via consumeKey, but can be called manually if needed
     */
    clearJustPressed() {
        this.justPressed = {};
    }

    getKeys() {
        return { ...this.keys };
    }

    clearKeys() {
        this.keys = {};
        this.justPressed = {};
    }

    setPauseCallback(callback) {
        this.onPause = callback;
    }

    setEscapeSetupCallback(callback) {
        this.onEscapeSetup = callback;
    }
}




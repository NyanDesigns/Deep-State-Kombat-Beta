export class InputHandler {
    constructor() {
        this.keys = {};
        this.onPause = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;

            // Escape key for pause
            if (e.key === 'Escape' && this.onPause) {
                this.onPause();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
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
}


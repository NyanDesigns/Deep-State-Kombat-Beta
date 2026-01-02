export class KeyDisplay {
    constructor() {
        this.visible = false;
        this.pressedKeys = []; // Array of { key: string, timestamp: number, element: HTMLElement }
        this.fadeDuration = 2000; // 2 seconds fade out
        this.maxKeys = 10; // Maximum number of keys to display
        this.lastAddedKeys = new Set(); // Track keys added this frame to prevent duplicates
    }

    init() {
        // KeyDisplay is controlled by pause menu checkbox
    }

    show() {
        const container = document.getElementById('key-display');
        if (container) {
            container.style.display = 'flex';
            this.visible = true;
        }
    }

    hide() {
        const container = document.getElementById('key-display');
        if (container) {
            container.style.display = 'none';
            this.visible = false;
            // Clear all keys when hiding
            this.clearKeys();
        }
    }

    /**
     * Add a key press to the display
     * @param {string} key - The key that was pressed
     */
    addKeyPress(key) {
        if (!this.visible) return;

        const container = document.getElementById('key-display');
        if (!container) return;

        // Format the key name for display
        const displayKey = this.formatKeyName(key);

        // Remove oldest key if we've reached max
        if (this.pressedKeys.length >= this.maxKeys) {
            const oldest = this.pressedKeys.shift();
            if (oldest.element && oldest.element.parentNode) {
                oldest.element.parentNode.removeChild(oldest.element);
            }
        }

        // Create new key element
        const keyElement = document.createElement('div');
        keyElement.className = 'key-box';
        keyElement.textContent = displayKey;
        keyElement.style.opacity = '1';
        keyElement.style.transform = 'scale(1)';

        container.appendChild(keyElement);

        const timestamp = Date.now();
        this.pressedKeys.push({
            key: key,
            timestamp: timestamp,
            element: keyElement
        });

        // Start fade animation after a short delay
        setTimeout(() => {
            this.startFadeOut(keyElement, timestamp);
        }, 500);
    }

    /**
     * Format key name for better display
     * @param {string} key - The key code
     * @returns {string} - Formatted key name
     */
    formatKeyName(key) {
        // Handle special keys
        const keyMap = {
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            ' ': 'SPACE',
            'Enter': 'ENTER',
            'Shift': 'SHIFT',
            'Control': 'CTRL',
            'Alt': 'ALT',
            'Escape': 'ESC',
            'Tab': 'TAB',
            'Backspace': 'BACK',
            'Delete': 'DEL',
            'Meta': 'META'
        };

        if (keyMap[key]) {
            return keyMap[key];
        }

        // Return uppercase single character keys, or the key name as-is for longer keys
        return key.length === 1 ? key.toUpperCase() : key.toUpperCase();
    }

    /**
     * Start fade out animation for a key element
     * @param {HTMLElement} element - The key element
     * @param {number} timestamp - When the key was pressed
     */
    startFadeOut(element, timestamp) {
        const fadeStart = Date.now();
        const duration = this.fadeDuration;

        const animate = () => {
            if (!this.visible || !element.parentNode) return;

            const elapsed = Date.now() - fadeStart;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            element.style.opacity = (1 - easeOut).toString();
            element.style.transform = `scale(${1 - easeOut * 0.3})`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove element when fade is complete
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                // Remove from array
                const index = this.pressedKeys.findIndex(k => k.element === element);
                if (index !== -1) {
                    this.pressedKeys.splice(index, 1);
                }
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Clear all keys from the display
     */
    clearKeys() {
        const container = document.getElementById('key-display');
        if (container) {
            container.innerHTML = '';
        }
        this.pressedKeys = [];
    }

    /**
     * Update the display based on current key presses
     * @param {Object} keys - Object with key states from InputHandler
     * @param {Object} justPressed - Object with keys that were just pressed
     */
    update(keys, justPressed) {
        if (!this.visible) return;

        // Clear tracking set at start of each frame
        this.lastAddedKeys.clear();

        // Add keys that were just pressed
        for (const key in justPressed) {
            if (justPressed[key] && !this.lastAddedKeys.has(key)) {
                this.addKeyPress(key);
                this.lastAddedKeys.add(key);
            }
        }
    }
}


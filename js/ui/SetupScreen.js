// Placeholder for SetupScreen - will be enhanced with character system integration
export class SetupScreen {
    constructor() {
        this.onStartGame = null;
        this.startBtn = null;
    }

    init(onStartGame = null) {
        if (onStartGame) {
            this.onStartGame = onStartGame;
        }

        this.startBtn = document.getElementById('btn-start');
        if (this.startBtn) {
            // Remove any existing listeners by cloning
            const newBtn = this.startBtn.cloneNode(true);
            this.startBtn.parentNode.replaceChild(newBtn, this.startBtn);
            this.startBtn = newBtn;
            
            this.startBtn.addEventListener('click', () => {
                console.log('Start button clicked, onStartGame:', this.onStartGame);
                if (this.onStartGame) {
                    this.onStartGame();
                } else {
                    console.warn('onStartGame callback not set');
                }
            });
        }
    }

    show() {
        const screen = document.getElementById('setup-screen');
        if (screen) {
            screen.style.display = 'flex';
        }
    }

    hide() {
        const screen = document.getElementById('setup-screen');
        if (screen) {
            screen.style.display = 'none';
            screen.style.visibility = 'hidden';
            screen.style.opacity = '0';
        }
    }

    updateStartButton(enabled) {
        const startBtn = document.getElementById('btn-start');
        if (startBtn) {
            startBtn.disabled = !enabled;
        }
    }
}




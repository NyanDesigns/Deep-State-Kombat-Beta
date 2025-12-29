// Placeholder for SetupScreen - will be enhanced with character system integration
export class SetupScreen {
    constructor() {
        this.onStartGame = null;
    }

    init(onStartGame) {
        this.onStartGame = onStartGame;

        const startBtn = document.getElementById('btn-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.onStartGame) {
                    this.onStartGame();
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
        }
    }

    updateStartButton(enabled) {
        const startBtn = document.getElementById('btn-start');
        if (startBtn) {
            startBtn.disabled = !enabled;
        }
    }
}



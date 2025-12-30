export class PauseMenu {
    constructor() {
        this.visible = false;
        this.onResume = null;
        this.onRestart = null;
        this.onMainMenu = null;
        this.debugOptions = {
            hitboxes: false,
            collisionBox: false,
            params: false,
            range: false,
            timer: false,
            inputs: false
        };
        this.onDebugOptionChange = null;
    }

    init(onResume, onRestart, onMainMenu) {
        this.onResume = onResume;
        this.onRestart = onRestart;
        this.onMainMenu = onMainMenu;

        // Setup button event listeners
        this.setupButtons();
        this.setupDebugOptions();
    }

    setupButtons() {
        const resumeBtn = document.getElementById('btn-resume');
        const restartBtn = document.getElementById('btn-restart-pause');
        const mainMenuBtn = document.getElementById('btn-main-menu');

        if (resumeBtn) {
            resumeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                if (this.onResume) this.onResume();
            });
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                if (this.onRestart) this.onRestart();
            });
        }

        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                if (this.onMainMenu) this.onMainMenu();
            });
        }
    }

    setupDebugOptions() {
        const debugOptions = ['hitboxes', 'collision-box', 'params', 'range', 'timer', 'inputs'];

        debugOptions.forEach(option => {
            const checkbox = document.getElementById('debug-' + option);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const optionKey = option === 'collision-box' ? 'collisionBox' : option;
                    this.debugOptions[optionKey] = e.target.checked;
                    if (this.onDebugOptionChange) {
                        this.onDebugOptionChange(this.debugOptions);
                    }
                });
            }
        });
    }

    show() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'flex';
            this.visible = true;
        }
    }

    hide() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'none';
            this.visible = false;
        }
    }

    getDebugOptions() {
        return { ...this.debugOptions };
    }

    setDebugOptions(options) {
        this.debugOptions = { ...options };

        // Update checkboxes (map option keys to checkbox IDs)
        Object.keys(this.debugOptions).forEach(option => {
            const checkboxId = option === 'collisionBox' ? 'debug-collision-box' : 'debug-' + option;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = this.debugOptions[option];
            }
        });

        if (this.onDebugOptionChange) {
            this.onDebugOptionChange(this.debugOptions);
        }
    }
}




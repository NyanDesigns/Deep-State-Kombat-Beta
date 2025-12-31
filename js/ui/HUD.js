export class HUD {
    constructor() {
        this.visible = false;
    }

    show() {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = 'flex';
            this.visible = true;
        }
    }

    hide() {
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = 'none';
            this.visible = false;
        }
    }

    update(fighters, timer) {
        if (!this.visible) return;

        // Update timer
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = timer;
        }

        // Update fighter stats
        if (fighters && fighters.length >= 2) {
            fighters.forEach(fighter => {
                this.updateFighterUI(fighter);
            });
        }
    }

    updateFighterUI(fighter) {
        // Update HP bar
        const hpEl = document.getElementById(fighter.id + '-hp');
        if (hpEl) {
            const hpPercent = fighter.maxHp > 0 ? Math.max(0, (fighter.hp / fighter.maxHp) * 100) : 0;
            hpEl.style.width = hpPercent + '%';
        }

        // Update stamina bar
        const stEl = document.getElementById(fighter.id + '-st');
        if (stEl) {
            const stPercent = fighter.maxSt > 0 ? Math.max(0, (fighter.st / fighter.maxSt) * 100) : 0;
            stEl.style.width = stPercent + '%';
        }
    }

    reset() {
        // Reset all UI elements to default state
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = '99';
        }

        // Reset HP and stamina bars
        ['p1-hp', 'p1-st', 'p2-hp', 'p2-st'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.width = '100%';
            }
        });
    }
}






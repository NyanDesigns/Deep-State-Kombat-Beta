import { CONFIG } from '../config.js';

export class DebugPanel {
    constructor() {
        this.visible = false;
        this.showParams = false;
        this.showTimer = false;
        this.showInputs = false;
    }

    init() {
        // Debug panel is controlled by pause menu checkboxes
    }

    show() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = 'block';
            this.visible = true;
        }
    }

    hide() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = 'none';
            this.visible = false;
        }
    }

    update(fighters, gameState, timer) {
        if (!this.visible || (!this.showParams && !this.showInputs)) return;

        const panel = document.getElementById('debug-panel');
        if (!panel) return;

        let html = '';

        if (this.showParams) {
            html += '<strong>FIGHTER DATA</strong><br>';
        }

        if (fighters && fighters.length === 2) {
            const [p1, p2] = fighters;
            if (this.showParams) {
                html += `
                    <div style="color:#0f0">P1: HP=${Math.round(p1.hp)} ST=${Math.round(p1.st)} STATE=${p1.state}</div>
                    <div style="color:#f00">P2: HP=${Math.round(p2.hp)} ST=${Math.round(p2.st)} STATE=${p2.state}</div>
                    <div style="color:#ff0">TIMER=${timer}</div>
                    <div style="color:#0ff">DIST=${p1.mesh.position.distanceTo(p2.mesh.position).toFixed(2)}</div>
                `;
            }

            if (this.showTimer) {
                html += '<br><strong>ANIMATION DATA</strong><br>';
                if (p1.currAct) html += `<div>P1: ${p1.currAct.getClip().name} (${p1.currAct.time.toFixed(2)}/${p1.currAct.getClip().duration.toFixed(2)})</div>`;
                if (p2.currAct) html += `<div>P2: ${p2.currAct.getClip().name} (${p2.currAct.time.toFixed(2)}/${p2.currAct.getClip().duration.toFixed(2)})</div>`;
            }

            if (this.showParams) {
                html += '<br><strong>CONFIG</strong><br>';
                html += `<div>Light: ${CONFIG.combat.light.dmg}dmg/${CONFIG.combat.light.cost}st</div>`;
                html += `<div>Heavy: ${CONFIG.combat.heavy.dmg}dmg/${CONFIG.combat.heavy.cost}st</div>`;
            }

            if (this.showInputs) {
                const renderInputs = (f, color) => {
                    const recent = (f.inputLog || []).map(e => e.label).slice(-6).join(', ');
                    return `<div style="color:${color}">Last Inputs: ${recent || 'none'} | Combo: ${f.comboCount}/${f.maxCombo} ${f.comboWindowOpen ? '(window)' : ''} ${f.comboQueuedType ? 'queued:' + f.comboQueuedType : ''}</div>`;
                };
                html += '<br><strong>INPUT / COMBO</strong><br>';
                html += renderInputs(p1, '#0f0');
                html += renderInputs(p2, '#f00');
            }
        }

        panel.innerHTML = html;
    }

    setOptions(options) {
        this.showParams = options.params || false;
        this.showTimer = options.timer || false;
        this.showInputs = options.inputs || false;

        if (this.showParams || this.showInputs) {
            this.show();
        } else {
            this.hide();
        }
    }
}







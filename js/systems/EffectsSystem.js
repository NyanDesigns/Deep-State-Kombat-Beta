export class EffectsSystem {
    constructor(camera = null) {
        this.damageNumbers = [];
        this.camera = camera;
    }

    setCamera(camera) {
        this.camera = camera;
    }

    spawnDamage(damage, position, isCritical) {
        if (!this.camera || !position || typeof position.clone !== 'function') return;
        const dmgLayer = document.getElementById('dmg-layer');
        if (!dmgLayer) return;
        const dmgEl = document.createElement('div');
        dmgEl.className = 'dmg';
        dmgEl.innerText = damage;
        dmgEl.style.color = isCritical ? '#ff0000' : '#ffcc00';
        dmgEl.style.fontSize = isCritical ? '5em' : '3em';

        // Project to screen space
        const tempV = position.clone();
        tempV.y += 2.0;
        tempV.project(this.camera);

        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        dmgEl.style.left = x + 'px';
        dmgEl.style.top = y + 'px';

        dmgLayer.appendChild(dmgEl);

        // Remove after animation
        setTimeout(() => dmgEl.remove(), 800);
    }

    update(dt) {
        // Update any ongoing effects
        // This could include particle systems, trails, etc.
    }

    clear() {
        // Clear all effects
        const dmgLayer = document.getElementById('dmg-layer');
        if (dmgLayer) {
            dmgLayer.innerHTML = '';
        }
    }
}



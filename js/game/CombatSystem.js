import { CONFIG } from '../config.js';

export class CombatSystem {
    constructor() {
        this.shake = 0;
        this.hitStop = 0;
        this.onShake = null; // Callback for screen shake
        this.onHitStop = null; // Callback for hit stop
        this.onDamage = null; // Callback for damage effects
    }

    update(dt) {
        // Update shake
        if (this.shake > 0) {
            this.shake -= dt * 2;
            if (this.shake < 0) this.shake = 0;
        }

        // Update hit stop
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            if (this.hitStop < 0) this.hitStop = 0;
        }
    }

    checkCollisions(fighters) {
        const events = [];
        if (fighters.length !== 2 || this.hitStop > 0) return events;

        const [fighter1, fighter2] = fighters;
        const hitOne = fighter1.checkHit(fighter2);
        const hitTwo = fighter2.checkHit(fighter1);

        if (hitOne) events.push(hitOne);
        if (hitTwo) events.push(hitTwo);

        return events;
    }

    applyHitEffects(atkType) {
        // Heavy hit FX
        if (atkType === 'heavy') {
            this.shake = 0.5;
            this.hitStop = 0.15; // Pause game for impact
        } else {
            this.shake = 0.2;
        }

        if (this.onShake) {
            this.onShake(this.shake);
        }

        if (this.onHitStop) {
            this.onHitStop(this.hitStop);
        }
    }

    spawnDamageEffect(damage, position, isCritical, onSpawnDamage) {
        if (onSpawnDamage) {
            onSpawnDamage(damage, position, isCritical);
        }
    }

    getShake() {
        return this.shake;
    }

    getHitStop() {
        return Math.max(0, this.hitStop);
    }

    isInHitStop() {
        return this.hitStop > 0;
    }
}




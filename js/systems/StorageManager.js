export class StorageManager {
    constructor() {
        // Storage manager for localStorage operations
    }

    saveModelSettings(id, fileName, clips) {
        const settings = {
            fileName: fileName,
            animations: {}
        };

        const types = ['idle', 'walk', 'jump', 'crouch', 'atk1', 'atk2', 'hit', 'win', 'die'];
        types.forEach(type => {
            const sel = document.getElementById(id + '-' + type);
            if (sel && sel.value) {
                settings.animations[type] = {
                    index: parseInt(sel.value),
                    name: clips[parseInt(sel.value)]?.name || ''
                };
            }
        });

        localStorage.setItem(`fighter3d_${id}_settings`, JSON.stringify(settings));
    }

    loadModelSettings(id) {
        const saved = localStorage.getItem(`fighter3d_${id}_settings`);
        return saved ? JSON.parse(saved) : null;
    }

    clearModelSettings(id) {
        localStorage.removeItem(`fighter3d_${id}_settings`);
    }

    saveCharacterConfig(characterId, config) {
        localStorage.setItem(`character_${characterId}_config`, JSON.stringify(config));
    }

    loadCharacterConfig(characterId) {
        const saved = localStorage.getItem(`character_${characterId}_config`);
        return saved ? JSON.parse(saved) : null;
    }

    saveGameSettings(settings) {
        localStorage.setItem('game_settings', JSON.stringify(settings));
    }

    loadGameSettings() {
        const saved = localStorage.getItem('game_settings');
        return saved ? JSON.parse(saved) : {
            debug: {
                hitboxes: false,
                params: false,
                range: false,
                timer: false
            }
        };
    }
}



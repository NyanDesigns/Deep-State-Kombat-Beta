/**
 * StorageManager - Handles localStorage operations for game settings and character configurations
 */
export class StorageManager {
    constructor() {
        this.GAME_SETTINGS_KEY = 'deepKombat_gameSettings';
        this.MODEL_SETTINGS_PREFIX = 'deepKombat_model_';
        this.SESSION_STATE_KEY = 'deepKombat_sessionState';
        this.APP_VERSION_KEY = 'deepKombat_appVersion';
        this.USER_PREF_KEY = 'deepKombat_userPreferences';
        this.APP_VERSION = '1.0.0';
    }

    /**
     * Save game settings (debug options, etc.)
     * @param {Object} settings - Settings object to save
     */
    saveGameSettings(settings) {
        try {
            localStorage.setItem(this.GAME_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save game settings:', error);
        }
    }

    /**
     * Load game settings
     * @returns {Object|null} - Settings object or null if not found
     */
    loadGameSettings() {
        try {
            const data = localStorage.getItem(this.GAME_SETTINGS_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to load game settings:', error);
            return null;
        }
    }

    /**
     * Save model/character settings for a player slot
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     * @param {string} characterName - Character name or ID
     * @param {Array} animations - Array of animation clips (optional, used to extract names)
     */
    saveModelSettings(playerSlot, characterName, animations) {
        try {
            const key = `${this.MODEL_SETTINGS_PREFIX}${playerSlot}`;
            
            // Read current dropdown values from DOM
            const animationTypes = ['idle', 'walk', 'jump', 'crouch', 'atk1', 'atk2', 'hit', 'win', 'die'];
            const animationMappings = {};
            
            animationTypes.forEach(type => {
                const select = document.getElementById(`${playerSlot}-${type}`);
                if (select && select.value !== '') {
                    const index = parseInt(select.value, 10);
                    const name = animations && animations[index] ? animations[index].name : `Animation_${index}`;
                    animationMappings[type] = { index, name };
                }
            });
            
            const settings = {
                characterName,
                animations: animationMappings
            };
            localStorage.setItem(key, JSON.stringify(settings));
        } catch (error) {
            console.warn(`Failed to save model settings for ${playerSlot}:`, error);
        }
    }

    /**
     * Load model settings for a player slot
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     * @returns {Object|null} - Settings object with characterName and animations, or null if not found
     */
    loadModelSettings(playerSlot) {
        try {
            const key = `${this.MODEL_SETTINGS_PREFIX}${playerSlot}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn(`Failed to load model settings for ${playerSlot}:`, error);
            return null;
        }
    }

    /**
     * Clear model settings for a player slot
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    clearModelSettings(playerSlot) {
        try {
            const key = `${this.MODEL_SETTINGS_PREFIX}${playerSlot}`;
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Failed to clear model settings for ${playerSlot}:`, error);
        }
    }

    /**
     * Get session state information
     * @returns {Object} Session state object
     */
    getSessionState() {
        try {
            const data = localStorage.getItem(this.SESSION_STATE_KEY);
            const session = data ? JSON.parse(data) : null;
            
            if (!session) {
                return {
                    hasVisited: false,
                    lastVisit: null,
                    visitCount: 0,
                    initComplete: false,
                    version: this.APP_VERSION
                };
            }

            // Check if version changed and invalidate if needed
            if (session.version !== this.APP_VERSION) {
                if (this.shouldInvalidateCache(session.version, this.APP_VERSION)) {
                    // Version changed significantly, reset init state
                    session.initComplete = false;
                }
                session.version = this.APP_VERSION;
            }

            return {
                hasVisited: session.hasVisited || false,
                lastVisit: session.lastVisit || null,
                visitCount: session.visitCount || 0,
                initComplete: session.initComplete || false,
                version: session.version || this.APP_VERSION
            };
        } catch (error) {
            console.warn('Failed to load session state:', error);
            return {
                hasVisited: false,
                lastVisit: null,
                visitCount: 0,
                initComplete: false,
                version: this.APP_VERSION
            };
        }
    }

    /**
     * Mark session initialization as complete
     */
    markSessionInitComplete() {
        try {
            const session = this.getSessionState();
            session.hasVisited = true;
            session.lastVisit = Date.now();
            session.visitCount = (session.visitCount || 0) + 1;
            session.initComplete = true;
            session.version = this.APP_VERSION;
            
            localStorage.setItem(this.SESSION_STATE_KEY, JSON.stringify(session));
        } catch (error) {
            console.warn('Failed to mark session init complete:', error);
        }
    }

    /**
     * Check if this is the first visit
     * @returns {boolean} True if first visit
     */
    isFirstVisit() {
        const session = this.getSessionState();
        return !session.hasVisited || !session.initComplete;
    }

    /**
     * Get user preferences for initialization
     * @returns {Object} User preferences
     */
    getUserPreferences() {
        try {
            const data = localStorage.getItem(this.USER_PREF_KEY);
            return data ? JSON.parse(data) : { initMode: 'auto' };
        } catch (error) {
            console.warn('Failed to load user preferences:', error);
            return { initMode: 'auto' };
        }
    }

    /**
     * Get initialization preference mode
     * @returns {string} 'auto', 'always-animate', or 'always-skip'
     */
    getInitializationPreference() {
        const prefs = this.getUserPreferences();
        return prefs.initMode || 'auto';
    }

    /**
     * Set initialization preference mode
     * @param {string} mode - 'auto', 'always-animate', or 'always-skip'
     */
    setInitializationPreference(mode) {
        try {
            const prefs = this.getUserPreferences();
            prefs.initMode = mode;
            localStorage.setItem(this.USER_PREF_KEY, JSON.stringify(prefs));
        } catch (error) {
            console.warn('Failed to save initialization preference:', error);
        }
    }

    /**
     * Check if cache should be invalidated based on version change
     * @param {string} storedVersion - Previously stored version
     * @param {string} currentVersion - Current app version
     * @returns {boolean} True if cache should be invalidated
     */
    shouldInvalidateCache(storedVersion, currentVersion) {
        if (!storedVersion || !currentVersion) return true;
        
        // Simple semantic versioning check - invalidate on major version change
        const stored = storedVersion.split('.');
        const current = currentVersion.split('.');
        
        if (stored.length !== 3 || current.length !== 3) return true;
        
        // Invalidate on major version change (first number)
        return stored[0] !== current[0];
    }

    /**
     * Migrate old data format if needed
     * @param {string} fromVersion - Source version
     * @param {string} toVersion - Target version
     */
    migrateOldData(fromVersion, toVersion) {
        // Placeholder for future data migration logic
        console.log(`Migrating data from ${fromVersion} to ${toVersion}`);
    }

}

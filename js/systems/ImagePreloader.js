/**
 * ImagePreloader - Preloads character selection images and stores them in localStorage
 * for faster access during character selection
 */
export class ImagePreloader {
    constructor(storageManager = null) {
        this.storage = storageManager;
        this.IMAGE_CACHE_PREFIX = 'deepKombat_image_';
        this.CACHE_VERSION_KEY = 'deepKombat_imageCacheVersion';
        this.CACHE_VERSION = '1.0.0';
        this.preloadPromises = new Map();
    }

    /**
     * Get all image paths needed for character selection menu
     * @param {Array} characters - Array of character configurations
     * @returns {Array<string>} - Array of image paths to preload
     */
    getCharacterImagePaths(characters) {
        const imagePaths = [];
        
        characters.forEach(character => {
            if (!character || !character.id) return;
            
            const characterId = character.id.toLowerCase();
            const folderName = `${characterId.charAt(0).toUpperCase()}${characterId.slice(1)}`;
            const baseId = characterId;
            
            // All possible image variants used in character selection
            const variants = ['T', 'P1', 'P2', 'S', 'V', 'D'];
            variants.forEach(variant => {
                const imagePath = `assets/characters/${folderName}/visuals/${baseId}${variant}.png`;
                imagePaths.push({
                    path: imagePath,
                    characterId: characterId,
                    variant: variant
                });
            });
        });
        
        return imagePaths;
    }

    /**
     * Preload a single image and store it in localStorage
     * @param {string} imagePath - Path to the image
     * @param {string} characterId - Character ID
     * @param {string} variant - Image variant (T, P1, P2, S, V, D)
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    async preloadImage(imagePath, characterId, variant) {
        const cacheKey = `${this.IMAGE_CACHE_PREFIX}${characterId}_${variant}`;
        
        // Check if already cached in localStorage
        if (this.isImageCached(characterId, variant)) {
            return true;
        }

        // Check if already being loaded
        if (this.preloadPromises.has(cacheKey)) {
            return this.preloadPromises.get(cacheKey);
        }

        // Create loading promise
        const loadPromise = new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Convert image to base64 data URL
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    // Store in localStorage
                    const cacheData = {
                        dataUrl: dataUrl,
                        width: img.width,
                        height: img.height,
                        timestamp: Date.now(),
                        version: this.CACHE_VERSION
                    };
                    
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    this.preloadPromises.delete(cacheKey);
                    resolve(true);
                } catch (error) {
                    console.warn(`Failed to cache image ${imagePath}:`, error);
                    this.preloadPromises.delete(cacheKey);
                    resolve(false);
                }
            };
            
            img.onerror = () => {
                // Image doesn't exist or failed to load - this is expected for some variants
                // Don't cache failures, but don't treat as error
                this.preloadPromises.delete(cacheKey);
                resolve(false);
            };
            
            // Start loading
            img.src = imagePath;
        });

        this.preloadPromises.set(cacheKey, loadPromise);
        return loadPromise;
    }

    /**
     * Preload all character images
     * @param {Array} characters - Array of character configurations
     * @param {Function} onProgress - Optional progress callback (loaded, total)
     * @returns {Promise<void>}
     */
    async preloadAllImages(characters, onProgress = null) {
        const imagePaths = this.getCharacterImagePaths(characters);
        const total = imagePaths.length;
        let loaded = 0;
        
        // Update cache version
        localStorage.setItem(this.CACHE_VERSION_KEY, this.CACHE_VERSION);
        
        // Preload images in batches to avoid overwhelming the browser
        const batchSize = 6; // Load 6 images at a time
        for (let i = 0; i < imagePaths.length; i += batchSize) {
            const batch = imagePaths.slice(i, i + batchSize);
            const batchPromises = batch.map(({ path, characterId, variant }) => 
                this.preloadImage(path, characterId, variant)
            );
            
            await Promise.all(batchPromises);
            loaded += batch.length;
            
            if (onProgress) {
                onProgress(loaded, total);
            }
        }
    }

    /**
     * Check if an image is cached in localStorage
     * @param {string} characterId - Character ID
     * @param {string} variant - Image variant (T, P1, P2, S, V, D)
     * @returns {boolean} - True if cached
     */
    isImageCached(characterId, variant) {
        const cacheKey = `${this.IMAGE_CACHE_PREFIX}${characterId}_${variant}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return false;
            
            const cacheData = JSON.parse(cached);
            
            // Check cache version
            if (cacheData.version !== this.CACHE_VERSION) {
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get cached image data URL from localStorage
     * @param {string} characterId - Character ID
     * @param {string} variant - Image variant (T, P1, P2, S, V, D)
     * @returns {string|null} - Data URL or null if not cached
     */
    getCachedImage(characterId, variant) {
        const cacheKey = `${this.IMAGE_CACHE_PREFIX}${characterId}_${variant}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            
            // Check cache version
            if (cacheData.version !== this.CACHE_VERSION) {
                return null;
            }
            
            return cacheData.dataUrl;
        } catch (error) {
            console.warn(`Failed to get cached image for ${characterId}_${variant}:`, error);
            return null;
        }
    }

    /**
     * Clear all cached images from localStorage
     */
    clearImageCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.IMAGE_CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            localStorage.removeItem(this.CACHE_VERSION_KEY);
        } catch (error) {
            console.warn('Failed to clear image cache:', error);
        }
    }

    /**
     * Get image source, using cache if available, otherwise fallback to original path
     * @param {string} imagePath - Original image path
     * @param {string} characterId - Character ID
     * @param {string} variant - Image variant (T, P1, P2, S, V, D)
     * @returns {string} - Image source (data URL or original path)
     */
    getImageSource(imagePath, characterId, variant) {
        const cached = this.getCachedImage(characterId, variant);
        return cached || imagePath;
    }

    /**
     * Check if cache version is valid
     * @returns {boolean} - True if cache version matches
     */
    isCacheVersionValid() {
        try {
            const storedVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
            return storedVersion === this.CACHE_VERSION;
        } catch (error) {
            return false;
        }
    }
}


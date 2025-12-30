export class CharacterSelector {
    constructor(characterManager, previewScene, storageManager = null, imagePreloader = null) {
        this.characterManager = characterManager;
        this.previewScene = previewScene;
        this.storage = storageManager;
        this.imagePreloader = imagePreloader;
        this.selectedCharacters = { p1: null, p2: null };
        this.focusedCharacters = { p1: null, p2: null }; // Track focused state for each player
        this.currentlyFocusedCharacter = null;
        this.onCharacterSelected = null;
        this.onCustomFileSelected = null;
        // Random flicker state
        this.flickerInterval = null;
        this.isFlickering = false;
        this.flickeringPlayerSlot = null;
        // Track focused special cards (random/add-new)
        this.focusedSpecialCards = { p1: null, p2: null }; // 'random', 'add-new', or null
        // Track failed background loads to avoid noisy errors
        this.backgroundLoadFailures = new Set();
        // Keyboard navigation state
        this.keyboardFocusPosition = { row: 0, col: 0 }; // Current keyboard focus position
        this.isKeyboardNavigationActive = false; // Flag to track keyboard navigation mode
        this.gridLayout = [
            ['trump', 'random', 'obama'],     // Row 0
            ['epstein', 'add-new', 'brandon']  // Row 1
        ];
        this.keyboardNavigationBound = null; // Store bound handler for cleanup
    }

    /**
     * Initialize the character selector UI with sequential loading
     * @param {LoadingManager} loadingManager - Optional loading manager for sequential loading
     * @param {Function} onComplete - Callback when initialization is complete
     */
    init(loadingManager = null, onComplete = null) {
        this.setupCustomFileInputs();
        this.setupClearButtons();
        this.setupKeyboardNavigation();
        
        if (loadingManager) {
            // Sequential loading mode
            this.loadCharactersSequentially(loadingManager, onComplete);
        } else {
            // Immediate loading (backward compatibility)
            this.createCharacterGrid();
            this.setDefaultCharacters();
            this.updateStartButton();
            if (onComplete) onComplete();
        }
    }

    /**
     * Load characters sequentially with staggered delays
     * @param {LoadingManager} loadingManager - Loading manager instance
     * @param {Function} onComplete - Callback when all characters are loaded
     */
    loadCharactersSequentially(loadingManager, onComplete) {
        const container = document.getElementById('character-grid');
        if (!container) {
            console.error('Character grid container not found!');
            if (onComplete) onComplete();
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Define the fixed 2×3 grid layout
        const gridLayout = [
            ['trump', 'random', 'obama'],     // Row 1
            ['epstein', 'add-new', 'brandon']  // Row 2
        ];

        // Create grid structure with skeletons first
        const allCards = [];
        gridLayout.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'character-grid-row';

            row.forEach((cellType, colIndex) => {
                let card;

                if (cellType === 'random') {
                    card = this.createRandomSelectionCard();
                } else if (cellType === 'add-new') {
                    card = this.createAddNewCharacterCard();
                } else {
                    // It's a character - create placeholder skeleton first
                    const character = this.characterManager.getCharacter(cellType);
                    if (character) {
                        // Create skeleton placeholder
                        card = this.createCharacterCardSkeleton(character);
                        allCards.push({ card, character, cellType });
                    } else {
                        console.warn(`Character ${cellType} not found in registry`);
                        card = this.createPlaceholderCard(cellType);
                    }
                }

                rowDiv.appendChild(card);
            });

            container.appendChild(rowDiv);
        });

        // Now load characters sequentially with staggered delays
        let loadedCount = 0;
        const totalToLoad = allCards.length;
        const delayBetweenCards = 120; // 120ms between each character

        allCards.forEach((item, index) => {
            setTimeout(() => {
                // Replace skeleton with actual character card
                const parent = item.card.parentElement;
                const actualCard = this.createCharacterCard(item.character);
                parent.replaceChild(actualCard, item.card);
                
                loadedCount++;
                
                // Check if all characters are loaded
                if (loadedCount === totalToLoad) {
                    // Set default characters after all are loaded
                    this.setDefaultCharacters();
                    this.updateStartButton();
                    if (onComplete) {
                        setTimeout(() => onComplete(), 200); // Small delay for final animations
                    }
                }
            }, index * delayBetweenCards);
        });

        // If no characters to load, complete immediately
        if (totalToLoad === 0) {
            this.setDefaultCharacters();
            this.updateStartButton();
            if (onComplete) onComplete();
        }
    }

    /**
     * Create a skeleton placeholder for a character card (for sequential loading)
     * @param {Object} character - Character configuration
     * @returns {HTMLElement} - Skeleton card element
     */
    createCharacterCardSkeleton(character) {
        const card = document.createElement('div');
        card.className = 'character-card loading';
        card.dataset.characterId = character.id;

        // Create loading skeleton
        const skeleton = document.createElement('div');
        skeleton.className = 'character-card-skeleton';

        // Character name overlay - start hidden
        const name = document.createElement('div');
        name.className = 'character-name';
        name.textContent = character.name;
        name.style.opacity = '0';
        name.style.visibility = 'hidden';

        card.appendChild(skeleton);
        card.appendChild(name);

        return card;
    }

    /**
     * Set default characters (Trump for both players)
     */
    setDefaultCharacters() {
        const trumpCharacter = this.characterManager.getCharacter('trump');
        if (trumpCharacter) {
            // Set Trump as focused for both players by default
            this.focusedCharacters.p1 = trumpCharacter;
            this.focusedCharacters.p2 = trumpCharacter;
            
            // Initialize keyboard focus to Trump (row 0, col 0)
            this.keyboardFocusPosition = { row: 0, col: 0 };
            
            // Update visual focus indicators
            this.updateCharacterCardFocus('trump', 'p1');
            this.updateCharacterCardFocus('trump', 'p2');
            
            // Wait a bit before showing info to ensure smooth loading
            setTimeout(() => {
                // Update info panel and background with default character
                this.updateCharacterInfoPanel(trumpCharacter);
                this.updateCharacterNameDisplay(trumpCharacter, 'p1');
                this.updateCharacterNameDisplay(trumpCharacter, 'p2');
            }, 600);
            
            // Show Trump for both P1 and P2 by default
            this.showBackgroundPreview(trumpCharacter, 'p1');
            this.showBackgroundPreview(trumpCharacter, 'p2');
        }
    }

    getAnimationTypes() {
        return ['idle', 'walk', 'jump', 'crouch', 'atk1', 'atk2', 'hit', 'win', 'die'];
    }

    resetDropdowns(playerSlot) {
        this.getAnimationTypes().forEach(type => {
            const select = document.getElementById(`${playerSlot}-${type}`);
            if (select) {
                select.innerHTML = '';
            }
        });
    }

    applySavedAnimations(playerSlot, model) {
        if (!this.storage) return;
        const saved = this.storage.loadModelSettings(playerSlot);
        if (!saved || !saved.animations) return;

        Object.entries(saved.animations).forEach(([type, info]) => {
            const select = document.getElementById(`${playerSlot}-${type}`);
            if (select && model.animations && model.animations[info.index]) {
                select.value = info.index;
            }
        });
    }

    attachDropdownListeners(playerSlot, character, model) {
        if (!this.storage) return;

        this.getAnimationTypes().forEach(type => {
            const select = document.getElementById(`${playerSlot}-${type}`);
            if (!select) return;
            select.onchange = () => {
                this.storage.saveModelSettings(
                    playerSlot,
                    character.name || character.id,
                    model.animations || []
                );
            };
        });
    }

    setupClearButtons() {
        ['p1', 'p2'].forEach(playerSlot => {
            const btn = document.getElementById(`${playerSlot}-clear`);
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (this.storage) {
                    this.storage.clearModelSettings(playerSlot);
                }
                this.clearSelection(playerSlot);
            });
        });
    }

    /**
     * Create the character selection grid (fixed 2×3 layout)
     */
    createCharacterGrid() {
        const container = document.getElementById('character-grid');
        if (!container) {
            console.error('Character grid container not found!');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Define the fixed 2×3 grid layout
        const gridLayout = [
            ['trump', 'random', 'obama'],     // Row 1
            ['epstein', 'add-new', 'brandon']  // Row 2
        ];

        // Create grid rows and cells
        gridLayout.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'character-grid-row';

            row.forEach((cellType, colIndex) => {
                let card;

                if (cellType === 'random') {
                    card = this.createRandomSelectionCard();
                } else if (cellType === 'add-new') {
                    card = this.createAddNewCharacterCard();
                } else {
                    // It's a character - get the character config
                    const character = this.characterManager.getCharacter(cellType);
                    if (character) {
                        card = this.createCharacterCard(character);
                    } else {
                        console.warn(`Character ${cellType} not found in registry`);
                        card = this.createPlaceholderCard(cellType);
                    }
                }

                rowDiv.appendChild(card);
            });

            container.appendChild(rowDiv);
        });
    }

    /**
     * Create a character card element with PNG background and optional 3D canvas overlay
     * @param {Object} character - Character configuration
     * @returns {HTMLElement} - Character card element
     */
    createCharacterCard(character) {
        const card = document.createElement('div');
        card.className = 'character-card loading';
        card.dataset.characterId = character.id;

        // Create loading skeleton
        const skeleton = document.createElement('div');
        skeleton.className = 'character-card-skeleton';

        // Add PNG background image
        // Always use T.png with face-zoom for Brandon as placeholder, regardless of 3D model availability
        // For other characters without 3D models, also use T.png with face-zoom
        const has3DModel = this.characterManager.isCharacterAvailable(character.id);
        const isBrandon = character.id === 'brandon';
        // Always use thumbnail (T.png) mode for Brandon, or for characters without 3D models
        const useThumbnail = isBrandon || !has3DModel;
        const pngCandidates = this.getCharacterPNGCandidates(character, null, false, useThumbnail);
        const backgroundImg = document.createElement('img');
        backgroundImg.className = 'character-card-background';
        if (useThumbnail) {
            backgroundImg.classList.add('face-zoom');
        }
        backgroundImg.alt = character.name;
        backgroundImg.style.opacity = '0'; // Start hidden

        // Track loading state
        let backgroundLoaded = false;
        let modelLoaded = false;
        const checkLoadingComplete = () => {
            // Consider loading complete if background loaded OR model loaded (or no candidates/model available)
            const isComplete = backgroundLoaded || modelLoaded || 
                              (pngCandidates.length === 0 && !this.characterManager.isCharacterAvailable(character.id));
            if (isComplete && card.classList.contains('loading')) {
                // Small delay to ensure smooth transition
                setTimeout(() => {
                    card.classList.remove('loading');
                    // Force show name after loading completes
                    name.style.opacity = '1';
                    name.style.visibility = 'visible';
                }, 100);
            }
        };

        // Helper to set src while forcing reload when reusing the same path
        const setBackgroundSrc = (path, characterId = null, variant = null) => {
            if (!path) return;
            
            // Try to use cached image if preloader is available
            let imageSrc = path;
            if (this.imagePreloader && characterId && variant) {
                const cached = this.imagePreloader.getImageSource(path, characterId, variant);
                imageSrc = cached;
            }
            
            if (backgroundImg.src === imageSrc || backgroundImg.src.endsWith(path)) {
                backgroundImg.src = '';
                setTimeout(() => {
                    backgroundImg.src = imageSrc;
                }, 0);
            } else {
                backgroundImg.src = imageSrc;
            }
        };

        if (pngCandidates.length === 0) {
            backgroundImg.style.display = 'none';
            card.classList.add('no-image');
            // Delay a bit to show skeleton
            setTimeout(() => {
                backgroundLoaded = true;
                checkLoadingComplete();
            }, 500);
        } else {
            let pngIndex = 0;
            const tryNextBackground = () => {
                const candidate = pngCandidates[pngIndex];
                // Extract variant from path (e.g., "brandonT.png" -> "T")
                // Get filename from full path
                const filename = candidate.split('/').pop();
                const variantMatch = filename.match(/([A-Z0-9]+)\.png$/i);
                const variant = variantMatch ? variantMatch[1] : null;
                setBackgroundSrc(candidate, character.id, variant);
            };

            backgroundImg.onerror = () => {
                pngIndex += 1;
                if (pngIndex < pngCandidates.length) {
                    tryNextBackground();
                } else {
                    backgroundImg.style.display = 'none';
                    card.classList.add('no-image');
                    backgroundLoaded = true;
                    checkLoadingComplete();
                }
            };

            backgroundImg.onload = () => {
                backgroundLoaded = true;
                // Fade in background image
                setTimeout(() => {
                    backgroundImg.style.opacity = '1';
                }, 50);
                checkLoadingComplete();
            };

            // Start loading after a tiny delay to ensure skeleton shows first
            setTimeout(() => {
                tryNextBackground();
            }, 50);
        }

        // Create canvas for 3D model (will overlay on top of PNG)
        const canvas = document.createElement('canvas');
        canvas.className = 'character-card-canvas';
        canvas.id = `mini-canvas-${character.id}`;
        // Set initial dimensions - will be updated when scene is created
        canvas.width = 200;
        canvas.height = 200;
        canvas.style.display = 'block'; // Visible but transparent until 3D model loads
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.opacity = '0'; // Start transparent for cross-fade

        // Character name overlay - start hidden
        const name = document.createElement('div');
        name.className = 'character-name';
        name.textContent = character.name;
        name.style.opacity = '0';
        name.style.visibility = 'hidden';

        card.appendChild(skeleton);
        card.appendChild(backgroundImg);
        card.appendChild(canvas);
        card.appendChild(name);

        // Focus/hover handlers for background preview and info panel
        const handleFocus = (e) => {
            if (e.currentTarget === card || card.contains(e.target)) {
                this.onCharacterFocus(character);
            }
        };
        
        card.addEventListener('mouseenter', handleFocus);
        card.addEventListener('mouseover', handleFocus);

        // Click handler for character selection
        card.addEventListener('click', () => {
            this.selectCharacter(character);
        });

        // Try to load 3D model if available (only for Brandon currently)
        if (this.characterManager.isCharacterAvailable(character.id)) {
            setTimeout(() => {
                this.loadMiniSceneModel(character).then(() => {
                    // Cross-fade transition: PNG fades out, 3D canvas fades in
                    // Ensure canvas is visible (display block) but start at opacity 0
                    canvas.style.display = 'block';
                    canvas.style.visibility = 'visible';
                    
                    // Trigger cross-fade: PNG fades out, Canvas fades in simultaneously
                    requestAnimationFrame(() => {
                        backgroundImg.style.opacity = '0';
                        canvas.style.opacity = '1';
                    });
                    
                    // After transition completes (~500ms), completely hide PNG
                    setTimeout(() => {
                        backgroundImg.style.display = 'none';
                    }, 500);
                    
                    // Check if this character is focused - if not, pause the animation
                    const hasFocus = card.classList.contains('focused-p1') || 
                                   card.classList.contains('focused-p2') || 
                                   card.classList.contains('focused-both');
                    if (!hasFocus && this.previewScene) {
                        this.previewScene.pauseMiniSceneAnimation(character.id);
                    }
                    
                    modelLoaded = true;
                    checkLoadingComplete();
                    console.log(`3D model loaded and cross-fade started for ${character.id}`);
                }).catch((error) => {
                    console.error(`Failed to load 3D model for ${character.id}:`, error);
                    // Keep canvas hidden if loading failed - PNG will remain visible
                    canvas.style.display = 'none';
                    canvas.style.opacity = '0';
                    // Still mark as loaded (background will show)
                    modelLoaded = true;
                    checkLoadingComplete();
                });
            }, 150);
        } else {
            // Character not available, mark model as "loaded" (won't load)
            // Add a small delay to show skeleton
            setTimeout(() => {
                modelLoaded = true;
                checkLoadingComplete();
            }, 500);
        }

        return card;
    }

    /**
     * Create a random character selection card
     * @returns {HTMLElement} - Random selection card element
     */
    createRandomSelectionCard() {
        const card = document.createElement('div');
        card.className = 'character-card random-selection-card loading';
        card.dataset.cardType = 'random';

        // Create loading skeleton
        const skeleton = document.createElement('div');
        skeleton.className = 'character-card-skeleton';

        const icon = document.createElement('div');
        icon.className = 'random-icon';
        // Pixelated question mark - using bold monospace for retro pixelated look
        icon.innerHTML = '<span style="font-family: \'Courier New\', \'Courier\', monospace; font-weight: 900; letter-spacing: 0;">?</span>';

        const name = document.createElement('div');
        name.className = 'character-name';
        name.textContent = 'Random';
        name.style.opacity = '0';
        name.style.visibility = 'hidden';

        const description = document.createElement('div');
        description.className = 'character-stats';
        description.innerHTML = '<div class="stat">Pick Random</div>';
        description.style.opacity = '0';
        description.style.visibility = 'hidden';

        card.appendChild(skeleton);
        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(description);

        // Remove loading state after a short delay (special cards load instantly)
        setTimeout(() => {
            card.classList.remove('loading');
            name.style.opacity = '1';
            name.style.visibility = 'visible';
            description.style.opacity = '1';
            description.style.visibility = 'visible';
        }, 400);

        // Mouseenter handler - start flickering and apply focus
        card.addEventListener('mouseenter', () => {
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = 'random';
            this.startRandomFlicker(targetSlot);
            this.updateCardFocus(card, targetSlot);
        });

        // Mouseleave handler - stop flickering and clear focus
        card.addEventListener('mouseleave', () => {
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = null;
            this.stopRandomFlicker();
            this.clearCardFocus(targetSlot);
        });

        // Click handler for random selection
        card.addEventListener('click', () => {
            this.selectRandomCharacter();
        });

        return card;
    }

    /**
     * Create an "Add New Character" card
     * @returns {HTMLElement} - Add new character card element
     */
    createAddNewCharacterCard() {
        const card = document.createElement('div');
        card.className = 'character-card add-new-character-card loading';
        card.dataset.cardType = 'add-new';

        // Create loading skeleton
        const skeleton = document.createElement('div');
        skeleton.className = 'character-card-skeleton';

        const icon = document.createElement('div');
        icon.className = 'add-icon';
        icon.innerHTML = '+'; // Plus icon

        const name = document.createElement('div');
        name.className = 'character-name';
        name.textContent = 'Add New';
        name.style.opacity = '0';
        name.style.visibility = 'hidden';

        const description = document.createElement('div');
        description.className = 'character-stats';
        description.innerHTML = '<div class="stat">Custom Model</div>';
        description.style.opacity = '0';
        description.style.visibility = 'hidden';

        card.appendChild(skeleton);
        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(description);

        // Remove loading state after a short delay (special cards load instantly)
        setTimeout(() => {
            card.classList.remove('loading');
            name.style.opacity = '1';
            name.style.visibility = 'visible';
            description.style.opacity = '1';
            description.style.visibility = 'visible';
        }, 400);

        // Mouseenter handler - apply focus styling
        card.addEventListener('mouseenter', () => {
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = 'add-new';
            this.updateCardFocus(card, targetSlot);
        });

        // Mouseleave handler - clear focus
        card.addEventListener('mouseleave', () => {
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = null;
            this.clearCardFocus(targetSlot);
        });

        // Click handler for adding new character
        card.addEventListener('click', () => {
            this.showAddNewCharacterDialog();
        });

        return card;
    }

    /**
     * Create a placeholder card for missing characters
     * @param {string} characterId - Character ID that couldn't be found
     * @returns {HTMLElement} - Placeholder card element
     */
    createPlaceholderCard(characterId) {
        const card = document.createElement('div');
        card.className = 'character-card placeholder-card loading';

        // Create loading skeleton
        const skeleton = document.createElement('div');
        skeleton.className = 'character-card-skeleton';

        const thumbnail = document.createElement('div');
        thumbnail.className = 'character-thumbnail placeholder';
        thumbnail.textContent = characterId.charAt(0).toUpperCase();

        const name = document.createElement('div');
        name.className = 'character-name';
        name.textContent = characterId.charAt(0).toUpperCase() + characterId.slice(1);
        name.style.opacity = '0';
        name.style.visibility = 'hidden';

        const stats = document.createElement('div');
        stats.className = 'character-stats';
        stats.innerHTML = '<div class="stat">Coming Soon</div>';
        stats.style.opacity = '0';
        stats.style.visibility = 'hidden';

        card.appendChild(skeleton);
        card.appendChild(thumbnail);
        card.appendChild(name);
        card.appendChild(stats);

        // Remove loading after a delay
        setTimeout(() => {
            card.classList.remove('loading');
            name.style.opacity = '1';
            name.style.visibility = 'visible';
            stats.style.opacity = '1';
            stats.style.visibility = 'visible';
        }, 400);

        return card;
    }

    /**
     * Get the PNG preview path for a character
     * @param {string} characterId - Character ID
     * @returns {string|null} - PNG path or null if not found
     */
    getCharacterPNGCandidates(character, playerSlot = null, isSelected = false, useThumbnail = false) {
        if (!character) return [];
        const characterId = typeof character === 'string' ? character : character.id;
        if (!characterId) return [];

        const folderName = `${characterId.charAt(0).toUpperCase()}${characterId.slice(1)}`;
        const baseId = characterId.toLowerCase();
        const baseIdRegex = baseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildVariantPath = (variant) => `assets/characters/${folderName}/visuals/${baseId}${variant}.png`;

        const candidates = [];
        const variantOverrides = new Map();
        let customThumbnail = null;

        const addOverride = (variant, value) => {
            if (typeof value !== 'string') return;
            const trimmed = value.trim();
            if (trimmed) {
                variantOverrides.set(variant, trimmed);
            }
        };

        if (typeof character === 'object') {
            const thumbnailValue = character.thumbnail;
            if (thumbnailValue && typeof thumbnailValue === 'object') {
                addOverride('T', thumbnailValue.default || thumbnailValue.t || thumbnailValue.thumbnail);
                addOverride('T1', thumbnailValue.t1);
                addOverride('T2', thumbnailValue.t2);
                addOverride('P1', thumbnailValue.p1);
                addOverride('P2', thumbnailValue.p2);
                addOverride('S', thumbnailValue.selected || thumbnailValue.s);
                addOverride('V', thumbnailValue.victory || thumbnailValue.v);
                addOverride('D', thumbnailValue.defeat || thumbnailValue.d);
            } else if (typeof thumbnailValue === 'string') {
                const trimmed = thumbnailValue.trim();
                if (trimmed) {
                    const match = trimmed.match(new RegExp(`${baseIdRegex}(T1|T2|T|P1|P2|S|V|D)\\.png$`, 'i'));
                    if (match) {
                        variantOverrides.set(match[1].toUpperCase(), trimmed);
                    } else {
                        customThumbnail = trimmed;
                    }
                }
            }
        }

        const pushVariant = (variant) => {
            const path = variantOverrides.get(variant) || buildVariantPath(variant);
            candidates.push(path);
        };

        if (customThumbnail && useThumbnail) {
            candidates.push(customThumbnail);
        }

        if (isSelected) {
            pushVariant('S');
        }

        if (useThumbnail) {
            pushVariant('T');
        }

        if (playerSlot === 'p1') {
            if (variantOverrides.has('T1')) {
                candidates.push(variantOverrides.get('T1'));
            }
            pushVariant('P1');
            pushVariant('P2');
        } else if (playerSlot === 'p2') {
            if (variantOverrides.has('T2')) {
                candidates.push(variantOverrides.get('T2'));
            }
            pushVariant('P2');
            pushVariant('P1');
        } else if (!useThumbnail) {
            pushVariant('P1');
            pushVariant('P2');
        }

        if (!useThumbnail) {
            pushVariant('V');
            pushVariant('T');
        } else {
            pushVariant('V');
        }

        if (!isSelected) {
            pushVariant('S');
        }

        pushVariant('D');

        if (customThumbnail && !useThumbnail) {
            candidates.push(customThumbnail);
        }

        return [...new Set(candidates)];
    }

    getCharacterPNGPath(characterId) {
        const candidates = this.getCharacterPNGCandidates(characterId);
        return candidates.length > 0 ? candidates[0] : null;
    }

    /**
     * Handle character selection
     * @param {Object} character - Selected character configuration
     */
    async selectCharacter(character) {
        console.log('Selecting character:', character);
        
        // Check if character is available before trying to select
        if (!this.characterManager.isCharacterAvailable(character.id)) {
            console.warn(`Character ${character.id} is not available (coming soon)`);
            // Still allow selection for coming soon characters, but show a message
            alert(`${character.name} is coming soon! Only Brandon is currently available.`);
            return;
        }

        try {
            // Load character if not already loaded
            if (!this.characterManager.isCharacterLoaded(character.id)) {
                console.log('Loading character model...');
                await this.characterManager.loadCharacter(character.id);
                console.log('Character loaded successfully');
            }

            // Determine which player slot to fill
            const availableSlot = !this.selectedCharacters.p1 ? 'p1' : 'p2';
            console.log('Assigning to slot:', availableSlot);

            this.selectedCharacters[availableSlot] = character;
            // Also update focused character when selected
            this.focusedCharacters[availableSlot] = character;

            // Update UI
            this.updateCharacterCardSelection(character.id, availableSlot);
            // Remove focus indicator after transition animation completes (keep visible during transition)
            setTimeout(() => {
                document.querySelectorAll(`.character-card.focused-${availableSlot}`).forEach(card => {
                    card.classList.remove(`focused-${availableSlot}`);
                });
                // Also remove focused-both if this card had it
                const selectedCard = document.querySelector(`.character-card[data-character-id="${character.id}"]`);
                if (selectedCard) {
                    selectedCard.classList.remove(`focused-both`);
                }
            }, 600);
            this.updatePlayerPreview(availableSlot, character);
            
            // Update background preview and info panel to show selected character
            this.updateCharacterInfoPanel(character);
            this.showBackgroundPreview(character, availableSlot);
            
            // Don't update the other player's preview - keep them independent
            
            this.updateStartButton();
            this.updateReadyText();

            if (this.onCharacterSelected) {
                this.onCharacterSelected(availableSlot, character);
            }
        } catch (error) {
            console.error('Error selecting character:', error);
            alert(`Failed to load character: ${character.name}. Please try again.`);
        }
    }

    /**
     * Update character card visual selection state
     * @param {string} characterId - Character ID
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    updateCharacterCardSelection(characterId, playerSlot) {
        // Remove previous selections for this player
        document.querySelectorAll(`.character-card.selected-${playerSlot}`).forEach(card => {
            card.classList.remove(`selected-${playerSlot}`);
        });

        // Remove any existing transition classes for this player (clean up any ongoing transitions)
        document.querySelectorAll(`.character-card.transitioning-to-selected-${playerSlot}`).forEach(card => {
            card.classList.remove(`transitioning-to-selected-${playerSlot}`);
        });

        // Add selection to current character
        const card = document.querySelector(`.character-card[data-character-id="${characterId}"]`);
        if (card) {
            // Remove any existing selected class to ensure clean transition
            card.classList.remove(`selected-${playerSlot}`);
            
            // Ensure the card has focus state if it doesn't already (for smooth transition)
            // This ensures the animation starts from a visible state
            const hasFocus = card.classList.contains(`focused-${playerSlot}`) || 
                           card.classList.contains('focused-both');
            if (!hasFocus) {
                // Temporarily add focus to ensure smooth transition
                card.classList.add(`focused-${playerSlot}`);
                // Force a reflow to apply the focus styles
                void card.offsetWidth;
            }
            
            // Remove any hover effects that might interfere
            card.style.pointerEvents = 'none';
            
            // Force a reflow to ensure the transition starts from the current state
            void card.offsetWidth;
            
            // First add the transition class to trigger the animation
            card.classList.add(`transitioning-to-selected-${playerSlot}`);
            
            // Re-enable pointer events after a brief moment
            setTimeout(() => {
                card.style.pointerEvents = '';
            }, 50);
            
            console.log(`Transition animation started for ${characterId} (${playerSlot}), hasFocus: ${hasFocus}`);
            
            // After animation completes (600ms), remove transition class and add selected class
            setTimeout(() => {
                if (card.classList.contains(`transitioning-to-selected-${playerSlot}`)) {
                    card.classList.remove(`transitioning-to-selected-${playerSlot}`);
                    card.classList.add(`selected-${playerSlot}`);
                    // Remove temporary focus if we added it
                    if (!hasFocus) {
                        card.classList.remove(`focused-${playerSlot}`);
                    }
                    console.log(`Transition completed for ${characterId} (${playerSlot})`);
                }
            }, 600);
        }
    }

    /**
     * Update Ready text visibility based on selection state
     */
    updateReadyText() {
        const p1ReadyText = document.getElementById('p1-ready-text');
        const p2ReadyText = document.getElementById('p2-ready-text');
        
        if (p1ReadyText) {
            if (this.selectedCharacters.p1) {
                p1ReadyText.classList.add('visible');
            } else {
                p1ReadyText.classList.remove('visible');
            }
        }
        
        if (p2ReadyText) {
            if (this.selectedCharacters.p2) {
                p2ReadyText.classList.add('visible');
            } else {
                p2ReadyText.classList.remove('visible');
            }
        }
    }

    /**
     * Update character card visual focus state
     * @param {string} characterId - Character ID
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    updateCharacterCardFocus(characterId, playerSlot) {
        const otherSlot = playerSlot === 'p1' ? 'p2' : 'p1';
        const otherFocusedCharacter = this.focusedCharacters[otherSlot];
        
        // Clear any special card focus for this player (character cards and special cards are mutually exclusive)
        if (this.focusedSpecialCards[playerSlot]) {
            this.focusedSpecialCards[playerSlot] = null;
            this.clearCardFocus(playerSlot);
        }
        
        // Find the previous card that had focus for this player - pause animation if it had one
        const previousCards = document.querySelectorAll(`.character-card.focused-${playerSlot}, .character-card.focused-both`);
        previousCards.forEach(prevCard => {
            const prevCharacterId = prevCard.dataset.characterId;
            if (prevCharacterId) {
                // Pause animation for the previous card if it's a 3D model
                if (this.previewScene && this.characterManager.isCharacterAvailable(prevCharacterId)) {
                    this.previewScene.pauseMiniSceneAnimation(prevCharacterId);
                }
                
                // Remove this player's focus from the previous card
                prevCard.classList.remove(`focused-${playerSlot}`, `focused-both`);
                
                // If the previous card still has the other player's focus, restore it
                if (otherFocusedCharacter && otherFocusedCharacter.id === prevCharacterId) {
                    prevCard.classList.add(`focused-${otherSlot}`);
                }
            }
        });

        // Add focus to current character
        const card = document.querySelector(`.character-card[data-character-id="${characterId}"]`);
        if (card) {
            // Remove any existing focus classes from this card
            card.classList.remove(`focused-p1`, `focused-p2`, `focused-both`);
            
            // Check if both players are focused on this same card
            if (otherFocusedCharacter && otherFocusedCharacter.id === characterId) {
                // Both players are focused on the same card - use purple focus
                card.classList.add(`focused-both`);
            } else {
                // Only this player is focused - use individual focus
                card.classList.add(`focused-${playerSlot}`);
            }
            
            // Resume animation for the current card if it's a 3D model
            if (this.previewScene && this.characterManager.isCharacterAvailable(characterId)) {
                this.previewScene.resumeMiniSceneAnimation(characterId);
            }
        }
    }

    /**
     * Update card focus state (for random/add-new cards or direct card elements)
     * @param {HTMLElement} card - Card element
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    updateCardFocus(card, playerSlot) {
        const otherSlot = playerSlot === 'p1' ? 'p2' : 'p1';
        const otherFocusedCardType = this.focusedSpecialCards[otherSlot];
        const currentCardType = card.dataset.cardType;

        // Find the previous card that had focus for this player - pause animation if it had one
        const previousCards = document.querySelectorAll(`.character-card.focused-${playerSlot}, .character-card.focused-both`);
        previousCards.forEach(prevCard => {
            const prevCardType = prevCard.dataset.cardType;
            const prevCharacterId = prevCard.dataset.characterId;
            
            // Pause animation for previous character card if it's a 3D model
            if (prevCharacterId && this.previewScene && this.characterManager.isCharacterAvailable(prevCharacterId)) {
                this.previewScene.pauseMiniSceneAnimation(prevCharacterId);
            }
            
            if (prevCardType) {
                // Remove this player's focus from the previous special card
                prevCard.classList.remove(`focused-${playerSlot}`, `focused-both`);
                
                // If the previous card still has the other player's focus, restore it
                if (otherFocusedCardType && otherFocusedCardType === prevCardType) {
                    prevCard.classList.add(`focused-${otherSlot}`);
                }
            }
        });

        // Also clear any character card focus for this player (special cards and character cards are mutually exclusive)
        document.querySelectorAll(`.character-card[data-character-id].focused-${playerSlot}, .character-card[data-character-id].focused-both`).forEach(charCard => {
            const charId = charCard.dataset.characterId;
            
            // Pause animation for character card if it's a 3D model
            if (charId && this.previewScene && this.characterManager.isCharacterAvailable(charId)) {
                this.previewScene.pauseMiniSceneAnimation(charId);
            }
            
            charCard.classList.remove(`focused-${playerSlot}`, `focused-both`);
            // Restore other player's focus if needed
            const otherFocusedChar = this.focusedCharacters[otherSlot];
            if (otherFocusedChar && otherFocusedChar.id === charId) {
                charCard.classList.add(`focused-${otherSlot}`);
            }
        });

        // Add focus to current special card
        if (card) {
            // Remove any existing focus classes from this card
            card.classList.remove(`focused-p1`, `focused-p2`, `focused-both`);
            
            // Check if both players are focused on this same special card
            if (otherFocusedCardType && otherFocusedCardType === currentCardType) {
                // Both players are focused on the same special card - use purple focus
                card.classList.add(`focused-both`);
            } else {
                // Only this player is focused - use individual focus
                card.classList.add(`focused-${playerSlot}`);
            }
        }
    }

    /**
     * Clear card focus for a player slot (for special cards)
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    clearCardFocus(playerSlot) {
        // Remove focus from all special cards for this player
        document.querySelectorAll(`.character-card.focused-${playerSlot}, .character-card.focused-both`).forEach(card => {
            const cardType = card.dataset.cardType;
            if (cardType) {
                // This is a special card
                card.classList.remove(`focused-${playerSlot}`, `focused-both`);
                
                // If the other player is still focused on this card, restore their focus
                const otherSlot = playerSlot === 'p1' ? 'p2' : 'p1';
                const otherFocusedCardType = this.focusedSpecialCards[otherSlot];
                if (otherFocusedCardType && otherFocusedCardType === cardType) {
                    card.classList.add(`focused-${otherSlot}`);
                }
            }
        });
    }

    /**
     * Update player preview with selected character
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     * @param {Object} character - Character configuration
     */
    updatePlayerPreview(playerSlot, character) {
        console.log('Updating player preview for', playerSlot, character);
        const model = this.characterManager.getLoadedModel(character.id);
        console.log('Loaded model:', model);
        if (model) {
            console.log('Loading model in preview scene...');
            this.previewScene.loadModel(playerSlot, model);
            console.log('Model loaded in preview');
        } else {
            console.warn('No model found for character', character.id);
        }

        // Update UI elements
        const mapElement = document.getElementById(`${playerSlot}-map`);
        if (mapElement) {
            mapElement.style.opacity = '1';
            mapElement.style.pointerEvents = 'auto';
        }

        // Populate animation dropdowns
        this.populateAnimationDropdowns(playerSlot, character);
    }

    /**
     * Populate animation dropdowns for a character
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     * @param {Object} character - Character configuration
     */
    populateAnimationDropdowns(playerSlot, character) {
        const model = this.characterManager.getLoadedModel(character.id);
        if (!model || !model.animations) return;

        const types = this.getAnimationTypes();

        types.forEach(type => {
            const select = document.getElementById(`${playerSlot}-${type}`);
            if (!select) return;

            select.innerHTML = '';

            model.animations.forEach((clip, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.text = clip.name;

                // Auto-select based on character config or name matching
                const configAnim = character.animations?.[type];
                if (configAnim !== undefined) {
                    if (typeof configAnim === 'number' && configAnim === index) {
                        option.selected = true;
                    } else if (typeof configAnim === 'string' && clip.name.toLowerCase().includes(configAnim.toLowerCase())) {
                        option.selected = true;
                    }
                } else {
                    // Fallback to name matching
                    this.autoSelectAnimation(option, clip.name, type, index);
                }

                select.appendChild(option);
            });
        });

        this.applySavedAnimations(playerSlot, model);
        this.attachDropdownListeners(playerSlot, character, model);

        if (this.storage) {
            this.storage.saveModelSettings(playerSlot, character.name || character.id, model.animations || []);
        }
    }

    /**
     * Auto-select animation based on name matching (fallback logic)
     */
    autoSelectAnimation(option, clipName, type, index) {
        const name = clipName.toLowerCase();

        if (name.includes(type) ||
            (type === 'atk1' && name.includes('punch')) ||
            (type === 'atk2' && (name.includes('kick') || name.includes('heavy'))) ||
            (type === 'jump' && (name.includes('jump') || name.includes('leap'))) ||
            (type === 'crouch' && (name.includes('crouch') || name.includes('duck') || name.includes('squat'))) ||
            (type === 'win' && (name.includes('taunt') || name.includes('pose') || name.includes('idle'))) ||
            (type === 'die' && (name.includes('death') || name.includes('down') || name.includes('hit')))) {
            option.selected = true;
        }
    }

    /**
     * Setup custom file input handlers
     */
    setupCustomFileInputs() {
        ['p1', 'p2'].forEach(playerSlot => {
            const fileInput = document.getElementById(`${playerSlot}-file`);
            if (fileInput) {
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                    const { config, model } = await this.characterManager.createCustomCharacter(file);

                    this.selectedCharacters[playerSlot] = config;
                    this.previewScene.loadModel(playerSlot, model);
                    this.populateAnimationDropdowns(playerSlot, config);
                    if (this.storage) {
                        this.storage.saveModelSettings(playerSlot, config.name || config.id, model.animations || []);
                    }

                        // Update UI
                        const mapElement = document.getElementById(`${playerSlot}-map`);
                        if (mapElement) {
                            mapElement.style.opacity = '1';
                            mapElement.style.pointerEvents = 'auto';
                        }

                        this.updateStartButton();

                        if (this.onCustomFileSelected) {
                            this.onCustomFileSelected(playerSlot, config, model);
                        }
                    } catch (error) {
                        console.error('Error loading custom character:', error);
                    }
                });
            }
        });
    }

    /**
     * Update the start button based on character selections
     */
    updateStartButton() {
        const startBtn = document.getElementById('btn-start');
        const gridContainer = document.getElementById('character-grid-container');
        const chooseFighterText = document.getElementById('choose-fighter-text');
        const pressStartText = document.getElementById('press-start-text');
        
        if (!startBtn || !gridContainer) return;
        
        const hasP1 = this.selectedCharacters.p1 !== null;
        const hasP2 = this.selectedCharacters.p2 !== null;
        const bothSelected = hasP1 && hasP2;
        
        // Hide "Press P2 Start" text when P2 is selected
        if (pressStartText) {
            if (hasP2) {
                pressStartText.style.opacity = '0';
                pressStartText.style.visibility = 'hidden';
            } else {
                pressStartText.style.opacity = '1';
                pressStartText.style.visibility = 'visible';
            }
        }
        
        if (bothSelected) {
            // Hide grid and "Choose Your Fighter" text, show button
            gridContainer.style.display = 'none';
            if (chooseFighterText) {
                chooseFighterText.style.opacity = '0';
                chooseFighterText.style.visibility = 'hidden';
            }
            startBtn.style.display = 'block';
            startBtn.disabled = false;
        } else {
            // Show grid and "Choose Your Fighter" text, hide button
            gridContainer.style.display = 'flex';
            if (chooseFighterText) {
                chooseFighterText.style.opacity = '1';
                chooseFighterText.style.visibility = 'visible';
            }
            startBtn.style.display = 'none';
        }
    }

    /**
     * Get selected characters
     * @returns {Object} - { p1: character, p2: character }
     */
    getSelectedCharacters() {
        return { ...this.selectedCharacters };
    }

    /**
     * Clear character selection
     * @param {string} playerSlot - Player slot to clear ('p1' or 'p2')
     */
    clearSelection(playerSlot) {
        this.selectedCharacters[playerSlot] = null;

        // Update UI
        document.querySelectorAll(`.character-card.selected-${playerSlot}`).forEach(card => {
            card.classList.remove(`selected-${playerSlot}`);
        });

        this.resetDropdowns(playerSlot);
        this.previewScene.clearModel(playerSlot);

        const mapElement = document.getElementById(`${playerSlot}-map`);
        if (mapElement) {
            mapElement.style.opacity = '0.3';
            mapElement.style.pointerEvents = 'none';
        }

        // Restore focus indicator if there's a focused character for this slot
        if (this.focusedCharacters[playerSlot]) {
            this.updateCharacterCardFocus(this.focusedCharacters[playerSlot].id, playerSlot);
        }

        // Update background preview only for the cleared slot - keep other player's preview independent
        const characterToShow = this.selectedCharacters[playerSlot] || this.focusedCharacters[playerSlot] || this.characterManager.getCharacter('trump');
        
        if (characterToShow) {
            this.showBackgroundPreview(characterToShow, playerSlot);
            this.updateCharacterNameDisplay(characterToShow, playerSlot);
            // Update info panel only if clearing P1 (info panel typically shows P1's state)
            if (playerSlot === 'p1') {
                this.updateCharacterInfoPanel(characterToShow);
            }
        }

        this.updateStartButton();
        this.updateReadyText();
    }

    /**
     * Handle character focus (hover) - update background preview and info panel
     * @param {Object} character - Character configuration
     */
    onCharacterFocus(character) {
        if (!character || !character.id) {
            console.warn('Invalid character in onCharacterFocus');
            return;
        }

        // Clear keyboard navigation mode when mouse is used
        if (!this.isKeyboardNavigationActive) {
            // Mouse navigation - find position in grid and update keyboard focus position
            const position = this.findCharacterPosition(character.id);
            if (position) {
                this.keyboardFocusPosition = position;
            }
        }

        console.log(`Character focused: ${character.name} (${character.id})`);
        this.currentlyFocusedCharacter = character;

        // Determine which player slot to focus
        let focusSlot = 'p1';
        if (this.selectedCharacters.p1 && !this.selectedCharacters.p2) {
            focusSlot = 'p2';
        } else if (this.selectedCharacters.p1 && this.selectedCharacters.p2) {
            focusSlot = this.focusedCharacters.p1 === character ? 'p1' : 
                       (this.focusedCharacters.p2 === character ? 'p2' : 'p1');
        }

        // Update focused character for the determined slot
        this.focusedCharacters[focusSlot] = character;

        // Update visual focus indicator
        this.updateCharacterCardFocus(character.id, focusSlot);

        // Update preview only for the focused slot - keep P1 and P2 independent
        if (focusSlot === 'p1') {
            // Hovering for P1 slot
            if (this.selectedCharacters.p1) {
                // P1 is selected, show selected P1
                this.updateCharacterInfoPanel(this.selectedCharacters.p1);
                this.updateCharacterNameDisplay(this.selectedCharacters.p1, 'p1');
                this.showBackgroundPreview(this.selectedCharacters.p1, 'p1');
            } else {
                // P1 not selected, show hovered character
                this.updateCharacterInfoPanel(character);
                this.updateCharacterNameDisplay(character, 'p1');
                this.showBackgroundPreview(character, 'p1');
            }
            // Don't update P2 preview - keep it independent
        } else {
            // Hovering for P2 slot
            if (this.selectedCharacters.p2) {
                // P2 is selected, show selected P2
                this.updateCharacterNameDisplay(this.selectedCharacters.p2, 'p2');
                this.showBackgroundPreview(this.selectedCharacters.p2, 'p2');
            } else {
                // P2 not selected, show hovered character
                this.updateCharacterNameDisplay(character, 'p2');
                this.showBackgroundPreview(character, 'p2');
            }
            // Don't update P1 preview or info panel - keep them independent
        }
    }

    /**
     * Find character position in grid layout
     * @param {string} characterId - Character ID
     * @returns {{row: number, col: number}|null} - Position or null if not found
     */
    findCharacterPosition(characterId) {
        for (let row = 0; row < this.gridLayout.length; row++) {
            for (let col = 0; col < this.gridLayout[row].length; col++) {
                if (this.gridLayout[row][col] === characterId) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * Update the character info panel with character data
     * @param {Object} character - Character configuration
     */
    updateCharacterInfoPanel(character) {
        const infoPanel = document.getElementById('character-info-panel');
        const nameDisplay = document.querySelector('.character-name-p1');
        const recordDisplay = document.querySelector('.character-record');
        const difficultyDisplay = document.querySelector('.character-difficulty');

        if (nameDisplay) {
            nameDisplay.textContent = character.name || 'Unknown';
        }

        if (recordDisplay && character.displayInfo) {
            const wins = character.displayInfo.wins || 0;
            const losses = character.displayInfo.losses || 0;
            const total = wins + losses;
            const percentage = total > 0 ? ((wins / total) * 100).toFixed(2) : '0.00';
            recordDisplay.textContent = `${wins}W ${losses}L ${percentage}%`;
        }

        if (difficultyDisplay && character.displayInfo) {
            difficultyDisplay.textContent = character.displayInfo.difficulty || 'Beginner';
        }

        // Show the info panel when character data is available
        if (infoPanel && character) {
            infoPanel.classList.add('loaded');
        }
    }

    /**
     * Update character name display for a specific player
     * @param {Object} character - Character configuration
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    updateCharacterNameDisplay(character, playerSlot) {
        const nameDisplay = document.querySelector(`.character-name-${playerSlot}`);
        if (nameDisplay && character) {
            nameDisplay.textContent = character.name || 'Unknown';
            // Show the name display when character data is available
            nameDisplay.classList.add('loaded');
        }
    }

    /**
     * Show character in background preview (PNG ONLY - no 3D)
     * @param {Object} character - Character configuration
     * @param {string} playerSlot - Player slot ('p1' or 'p2')
     */
    showBackgroundPreview(character, playerSlot = 'p1') {
        if (!character || !character.id) {
            console.warn('Invalid character object passed to showBackgroundPreview');
            return;
        }

        // Only show PNG background - NO 3D models here
        // Check if this character is selected for this player slot
        const isSelected = this.selectedCharacters[playerSlot] && 
                          this.selectedCharacters[playerSlot].id === character.id;
        
        // Pass playerSlot and isSelected to prioritize S.png when selected, otherwise P1.png/P2.png
        const pngCandidates = this.getCharacterPNGCandidates(character, playerSlot, isSelected);
        const backgroundImg = document.getElementById(`${playerSlot}-background-png-image`);
        
        if (!backgroundImg) {
            console.warn(`Background preview image element not found for ${playerSlot}`);
            return;
        }

        if (!pngCandidates || pngCandidates.length === 0) {
            console.warn(`No PNG path found for character: ${character.id}`);
            backgroundImg.style.display = 'none';
            return;
        }

        // Add/remove selected class based on selection state
        if (isSelected) {
            backgroundImg.classList.add('selected');
        } else {
            backgroundImg.classList.remove('selected');
        }

        console.log(`Loading background preview for ${playerSlot}: ${character.name} (${character.id}): ${pngCandidates[0]} (selected: ${isSelected})`);

        // Helper to set src while forcing reload when reusing the same path
        const setBackgroundSrc = (path, characterId = null, variant = null) => {
            if (!path) return;
            
            // Try to use cached image if preloader is available
            let imageSrc = path;
            if (this.imagePreloader && characterId && variant) {
                const cached = this.imagePreloader.getImageSource(path, characterId, variant);
                imageSrc = cached;
            }
            
            if (backgroundImg.src === imageSrc || backgroundImg.src.endsWith(path)) {
                backgroundImg.src = '';
                setTimeout(() => {
                    backgroundImg.src = imageSrc;
                }, 0);
            } else {
                backgroundImg.src = imageSrc;
            }
        };

        // Try multiple PNG variants before giving up
        let candidateIndex = 0;
        const failureKey = `${playerSlot}:${character.id}`;
        const tryNextCandidate = () => {
            const candidate = pngCandidates[candidateIndex];
            // Extract variant from path (e.g., "brandonS.png" -> "S")
            // Get filename from full path
            const filename = candidate.split('/').pop();
            const variantMatch = filename.match(/([A-Z0-9]+)\.png$/i);
            const variant = variantMatch ? variantMatch[1] : null;
            setBackgroundSrc(candidate, character.id, variant);
        };

        // Set up error handler with fallback and no console.error noise
        backgroundImg.onerror = () => {
            candidateIndex += 1;
            if (candidateIndex < pngCandidates.length) {
                tryNextCandidate();
                return;
            }

            if (!this.backgroundLoadFailures.has(failureKey)) {
                console.warn(`Background PNG unavailable for ${playerSlot} ${character.name}, hiding preview.`);
                this.backgroundLoadFailures.add(failureKey);
            }
            backgroundImg.style.display = 'none';
        };

        // Set up load handler
        backgroundImg.onload = () => {
            console.log(`Background PNG loaded successfully for ${playerSlot} ${character.name}`);
            backgroundImg.style.display = 'block';
            backgroundImg.style.opacity = '1';
        };

        // Kick off first load
        tryNextCandidate();

        // Show immediately (will hide on error if needed)
        backgroundImg.style.display = 'block';
    }

    /**
     * Load 3D model into mini-scene for grid cell
     * @param {Object} character - Character configuration
     * @returns {Promise} - Resolves when model is loaded
     */
    async loadMiniSceneModel(character) {
        try {
            const canvas = document.getElementById(`mini-canvas-${character.id}`);
            if (!canvas) {
                console.warn(`Canvas not found for ${character.id}`);
                return Promise.reject('Canvas not found');
            }

            // Show canvas immediately so it can be properly sized
            canvas.style.display = 'block';
            
            // Create mini-scene for this canvas
            const miniScene = this.previewScene.createMiniScene(character.id, canvas);
            if (!miniScene) {
                console.warn(`Failed to create mini-scene for ${character.id}`);
                canvas.style.display = 'none'; // Hide again if creation failed
                return Promise.reject('Mini-scene creation failed');
            }

            // Load character if not already loaded
            if (!this.characterManager.isCharacterLoaded(character.id)) {
                await this.characterManager.loadCharacter(character.id);
            }

            const model = this.characterManager.getLoadedModel(character.id);
            if (model) {
                this.previewScene.loadMiniSceneModel(character.id, model);
                console.log(`3D model loaded for ${character.id}`);
                return Promise.resolve();
            } else {
                console.warn(`No 3D model available for ${character.id}`);
                return Promise.reject('No model available');
            }
        } catch (error) {
            console.warn(`Failed to load mini-scene for ${character.id}:`, error);
            return Promise.reject(error);
        }
    }


    /**
     * Select a random available character
     */
    selectRandomCharacter() {
        // Stop flickering if active
        this.stopRandomFlicker();

        const allCharacters = this.characterManager.getAllCharacters();
        const availableCharacters = allCharacters.filter(char => this.characterManager.isCharacterAvailable(char.id));

        if (availableCharacters.length === 0) {
            console.warn('No available characters to select randomly');
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableCharacters.length);
        const randomCharacter = availableCharacters[randomIndex];

        this.selectCharacter(randomCharacter);
    }

    /**
     * Get the target player slot for random selection
     * @returns {string} - 'p1' or 'p2'
     */
    getTargetPlayerSlot() {
        if (!this.selectedCharacters.p1) {
            return 'p1';
        } else if (!this.selectedCharacters.p2) {
            return 'p2';
        }
        // If both are selected, default to p1 (shouldn't happen normally)
        return 'p1';
    }

    /**
     * Start the random character flicker animation
     * @param {string} playerSlot - Player slot to randomize ('p1' or 'p2')
     */
    startRandomFlicker(playerSlot) {
        // Don't start if already flickering
        if (this.isFlickering) {
            return;
        }

        // Don't start if both players are already selected
        if (this.selectedCharacters.p1 && this.selectedCharacters.p2) {
            return;
        }

        this.isFlickering = true;
        this.flickeringPlayerSlot = playerSlot;

        const allCharacters = this.characterManager.getAllCharacters();
        if (allCharacters.length === 0) {
            this.isFlickering = false;
            return;
        }

        let currentIndex = 0;

        // Start flickering through characters
        this.flickerInterval = setInterval(() => {
            const character = allCharacters[currentIndex];
            if (character) {
                // Update background preview for the flickering slot
                this.showBackgroundPreview(character, playerSlot);
                // Update character name display for the flickering slot
                this.updateCharacterNameDisplay(character, playerSlot);
                // Update character info panel only if flickering for P1
                if (playerSlot === 'p1') {
                    this.updateCharacterInfoPanel(character);
                }
            }

            // Move to next character (cycle back to start)
            currentIndex = (currentIndex + 1) % allCharacters.length;
        }, 120); // 120ms per character for smooth flickering
    }

    /**
     * Stop the random character flicker animation
     */
    stopRandomFlicker() {
        if (this.flickerInterval) {
            clearInterval(this.flickerInterval);
            this.flickerInterval = null;
        }

        if (!this.isFlickering) {
            return;
        }

        this.isFlickering = false;

        // Restore previous preview state based on selected/focused characters
        if (this.flickeringPlayerSlot) {
            const playerSlot = this.flickeringPlayerSlot;
            const selectedCharacter = this.selectedCharacters[playerSlot];
            const focusedCharacter = this.focusedCharacters[playerSlot];
            
            // Show selected character if exists, otherwise show focused character, otherwise default to Trump
            const characterToShow = selectedCharacter || focusedCharacter || this.characterManager.getCharacter('trump');
            
            if (characterToShow) {
                this.showBackgroundPreview(characterToShow, playerSlot);
                this.updateCharacterNameDisplay(characterToShow, playerSlot);
                // Update info panel only if flickering was for P1 - keep P1 and P2 independent
                if (playerSlot === 'p1') {
                    this.updateCharacterInfoPanel(characterToShow);
                }
                // Don't update info panel when flickering was for P2 - keep it independent
            }

            this.flickeringPlayerSlot = null;
        }
    }

    /**
     * Show the add new character dialog/file input
     */
    showAddNewCharacterDialog() {
        // For now, just trigger the existing file input for p1 (could be expanded later)
        const fileInput = document.getElementById('p1-file');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Setup keyboard navigation for character selection
     */
    setupKeyboardNavigation() {
        // Bind handler to preserve 'this' context
        this.keyboardNavigationBound = (e) => this.handleKeyboardNavigation(e);
        window.addEventListener('keydown', this.keyboardNavigationBound);
        
        // Clear keyboard navigation when mouse is used
        document.addEventListener('mousemove', () => {
            this.isKeyboardNavigationActive = false;
        });
    }

    /**
     * Handle keyboard navigation input
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboardNavigation(e) {
        const key = e.key.toLowerCase();
        
        // Check if this is a navigation key
        const isNavigationKey = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key);
        const isEnter = key === 'enter';
        const isEscape = key === 'escape';

        if (!isNavigationKey && !isEnter && !isEscape) {
            return; // Not a key we handle
        }

        // Prevent default behavior for navigation keys
        if (isNavigationKey || isEnter) {
            e.preventDefault();
        }

        if (isNavigationKey) {
            this.isKeyboardNavigationActive = true;
            
            // Map keys to movement deltas
            let deltaRow = 0;
            let deltaCol = 0;
            
            if (key === 'w' || key === 'arrowup') {
                deltaRow = -1;
            } else if (key === 's' || key === 'arrowdown') {
                deltaRow = 1;
            } else if (key === 'a' || key === 'arrowleft') {
                deltaCol = -1;
            } else if (key === 'd' || key === 'arrowright') {
                deltaCol = 1;
            }

            this.moveKeyboardFocus(deltaRow, deltaCol);
        } else if (isEnter) {
            this.handleKeyboardSelect();
        } else if (isEscape) {
            this.handleKeyboardDeselect();
        }
    }

    /**
     * Move keyboard focus by delta
     * @param {number} deltaRow - Change in row (-1, 0, or 1)
     * @param {number} deltaCol - Change in column (-1, 0, or 1)
     */
    moveKeyboardFocus(deltaRow, deltaCol) {
        const newRow = this.keyboardFocusPosition.row + deltaRow;
        const newCol = this.keyboardFocusPosition.col + deltaCol;

        // Wrap around at edges
        const wrappedRow = ((newRow % this.gridLayout.length) + this.gridLayout.length) % this.gridLayout.length;
        const wrappedCol = ((newCol % this.gridLayout[0].length) + this.gridLayout[0].length) % this.gridLayout[0].length;

        this.setKeyboardFocus(wrappedRow, wrappedCol);
    }

    /**
     * Set keyboard focus to a specific grid position
     * @param {number} row - Row index (0-based)
     * @param {number} col - Column index (0-based)
     */
    setKeyboardFocus(row, col) {
        // Validate position
        if (row < 0 || row >= this.gridLayout.length || col < 0 || col >= this.gridLayout[0].length) {
            return;
        }

        // Get current cell type before changing position
        const currentRow = this.keyboardFocusPosition.row;
        const currentCol = this.keyboardFocusPosition.col;
        const currentCellType = this.gridLayout[currentRow] && this.gridLayout[currentRow][currentCol];
        const newCellType = this.gridLayout[row][col];

        // Only clean up if we're actually moving to a different cell
        const isMovingToDifferentCell = currentRow !== row || currentCol !== col;

        // Clean up previous special card state if moving away from it
        if (isMovingToDifferentCell && (currentCellType === 'random' || currentCellType === 'add-new')) {
            // Stop random flicker if it's active
            if (currentCellType === 'random') {
                this.stopRandomFlicker();
            }
            
            // Clear focused special cards for the active slot
            const targetSlot = this.getTargetPlayerSlot();
            if (this.focusedSpecialCards[targetSlot]) {
                this.focusedSpecialCards[targetSlot] = null;
                this.clearCardFocus(targetSlot);
            }
        }

        // Update keyboard focus position
        this.keyboardFocusPosition = { row, col };
        const cellType = newCellType;

        // Get the card at this position
        const card = this.getCardAtPosition(row, col);
        if (!card) {
            return;
        }

        // Handle based on card type
        if (cellType === 'random') {
            // For random card, trigger focus behavior
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = 'random';
            this.updateCardFocus(card, targetSlot);
            this.startRandomFlicker(targetSlot);
        } else if (cellType === 'add-new') {
            // For add-new card, trigger focus behavior
            const targetSlot = this.getTargetPlayerSlot();
            this.focusedSpecialCards[targetSlot] = 'add-new';
            this.updateCardFocus(card, targetSlot);
        } else {
            // Character card
            const character = this.characterManager.getCharacter(cellType);
            if (character) {
                this.onCharacterFocus(character);
            }
        }
    }

    /**
     * Get card element at grid position
     * @param {number} row - Row index (0-based)
     * @param {number} col - Column index (0-based)
     * @returns {HTMLElement|null} - Card element or null if not found
     */
    getCardAtPosition(row, col) {
        const container = document.getElementById('character-grid');
        if (!container) return null;

        const rows = container.querySelectorAll('.character-grid-row');
        if (row >= rows.length) return null;

        const cards = rows[row].querySelectorAll('.character-card');
        if (col >= cards.length) return null;

        return cards[col];
    }

    /**
     * Handle keyboard selection (Enter key)
     */
    handleKeyboardSelect() {
        // Check if both characters are selected - if so, start the game
        if (this.selectedCharacters.p1 && this.selectedCharacters.p2) {
            // Both characters selected, start the game by clicking the start button
            const startBtn = document.getElementById('btn-start');
            if (startBtn) {
                // Check if button is visible and enabled
                const computedStyle = window.getComputedStyle(startBtn);
                if (computedStyle.display !== 'none' && !startBtn.disabled) {
                    // Trigger the start button click to start the game
                    startBtn.click();
                }
            }
            return;
        }

        // Otherwise, select character/card at current position
        const { row, col } = this.keyboardFocusPosition;
        const cellType = this.gridLayout[row][col];

        if (cellType === 'random') {
            this.selectRandomCharacter();
        } else if (cellType === 'add-new') {
            this.showAddNewCharacterDialog();
        } else {
            const character = this.characterManager.getCharacter(cellType);
            if (character) {
                this.selectCharacter(character);
            }
        }
    }

    /**
     * Handle keyboard deselection (Escape key)
     */
    handleKeyboardDeselect() {
        // Determine which player slot to clear
        const targetSlot = !this.selectedCharacters.p1 ? 'p1' : 'p2';
        if (this.selectedCharacters[targetSlot]) {
            this.clearSelection(targetSlot);
        }
    }
}

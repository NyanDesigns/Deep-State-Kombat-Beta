// Character registry - defines all available preset characters
// Paths are relative to the web root so they can be fetched directly by the browser.
export const CHARACTERS = [
    {
        id: 'brandon',
        name: 'Brandon',
        configPath: 'assets/characters/Brandon/character.json',
        modelPath: 'assets/characters/Brandon/model.glb',
        thumbnail: null
    },
    {
        id: 'epstein',
        name: 'Epstein',
        configPath: 'assets/characters/Epstein/character.json',
        modelPath: 'assets/characters/Epstein/model.glb',
        thumbnail: null
    },
    {
        id: 'obama',
        name: 'Obama',
        configPath: 'assets/characters/Obama/character.json',
        modelPath: 'assets/characters/Obama/model.glb',
        thumbnail: null
    },
    {
        id: 'trump',
        name: 'Trump',
        configPath: 'assets/characters/Trump/character.json',
        modelPath: 'assets/characters/Trump/model.glb',
        thumbnail: null
    }
];

// Export individual character data for easy access
export const BRANDON = CHARACTERS.find(c => c.id === 'brandon');
export const EPSTEIN = CHARACTERS.find(c => c.id === 'epstein');
export const OBAMA = CHARACTERS.find(c => c.id === 'obama');
export const TRUMP = CHARACTERS.find(c => c.id === 'trump');

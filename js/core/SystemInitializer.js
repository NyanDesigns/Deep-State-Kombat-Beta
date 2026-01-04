/**
 * SystemInitializer - Dependency-aware system initialization
 * Manages initialization order and dependencies between systems
 */
export class SystemInitializer {
    constructor() {
        this.systems = new Map();
        this.initialized = new Set();
        this.initPromises = new Map();
        
        // System initialization order with dependencies
        // Systems are initialized in order, but can wait for dependencies
        this.initOrder = [];
    }

    /**
     * Register a system to be initialized
     * @param {string} name - System name/identifier
     * @param {Function} initFn - Initialization function (returns Promise)
     * @param {Array<string>} dependencies - Array of system names this depends on
     */
    register(name, initFn, dependencies = []) {
        this.initOrder.push({
            name,
            initFn,
            dependencies
        });
    }

    /**
     * Initialize all registered systems in dependency order
     * @returns {Promise<Map>} Map of initialized systems
     */
    async initializeAll() {
        const initialized = new Map();
        
        // Create promises for all systems
        for (const system of this.initOrder) {
            this.initPromises.set(system.name, this._initializeSystem(system, initialized));
        }

        // Wait for all systems to initialize
        for (const system of this.initOrder) {
            const result = await this.initPromises.get(system.name);
            initialized.set(system.name, result);
        }

        return initialized;
    }

    /**
     * Initialize a single system (with dependency resolution)
     * @param {Object} system - System configuration object
     * @param {Map} initialized - Map of already initialized systems
     * @returns {Promise<any>} Initialized system instance
     */
    async _initializeSystem(system, initialized) {
        // If already initialized, return it
        if (initialized.has(system.name)) {
            return initialized.get(system.name);
        }

        // Wait for dependencies first
        if (system.dependencies && system.dependencies.length > 0) {
            const dependencyPromises = system.dependencies.map(depName => {
                const depSystem = this.initOrder.find(s => s.name === depName);
                if (!depSystem) {
                    throw new Error(`Dependency '${depName}' not found for system '${system.name}'`);
                }
                return this._initializeSystem(depSystem, initialized);
            });
            
            await Promise.all(dependencyPromises);
        }

        // Initialize this system
        console.log(`Initializing system: ${system.name}`);
        const result = await system.initFn();
        
        this.initialized.add(system.name);
        return result;
    }

    /**
     * Initialize a specific system by name
     * @param {string} name - System name
     * @returns {Promise<any>} Initialized system instance
     */
    async initializeSystem(name) {
        const system = this.initOrder.find(s => s.name === name);
        if (!system) {
            throw new Error(`System '${name}' not found`);
        }

        // Find all dependencies recursively
        const allDeps = this._getAllDependencies(name);
        
        // Initialize dependencies first
        for (const depName of allDeps) {
            if (!this.initialized.has(depName)) {
                await this.initializeSystem(depName);
            }
        }

        // Initialize this system
        if (!this.initialized.has(name)) {
            const system = this.initOrder.find(s => s.name === name);
            const result = await system.initFn();
            this.initialized.add(name);
            return result;
        }

        return this.systems.get(name);
    }

    /**
     * Get all dependencies for a system (recursive)
     * @param {string} name - System name
     * @returns {Array<string>} Array of dependency names
     */
    _getAllDependencies(name) {
        const system = this.initOrder.find(s => s.name === name);
        if (!system || !system.dependencies || system.dependencies.length === 0) {
            return [];
        }

        const deps = new Set(system.dependencies);
        
        // Recursively get dependencies of dependencies
        system.dependencies.forEach(depName => {
            const subDeps = this._getAllDependencies(depName);
            subDeps.forEach(subDep => deps.add(subDep));
        });

        return Array.from(deps);
    }

    /**
     * Get an initialized system
     * @param {string} name - System name
     * @returns {any} System instance or null if not initialized
     */
    getSystem(name) {
        if (this.initPromises.has(name)) {
            // System is being initialized or initialized
            return this.systems.get(name) || null;
        }
        return null;
    }

    /**
     * Wait for a system to be initialized
     * @param {string} name - System name
     * @returns {Promise<any>} Promise that resolves with the system instance
     */
    async waitForSystem(name) {
        if (this.initialized.has(name)) {
            return this.systems.get(name);
        }

        if (this.initPromises.has(name)) {
            return await this.initPromises.get(name);
        }

        // System not registered, wait and initialize it
        return await this.initializeSystem(name);
    }

    /**
     * Check if a system is initialized
     * @param {string} name - System name
     * @returns {boolean} True if initialized
     */
    isInitialized(name) {
        return this.initialized.has(name);
    }

    /**
     * Clear all systems (for testing/reset)
     */
    clear() {
        this.systems.clear();
        this.initialized.clear();
        this.initPromises.clear();
        this.initOrder = [];
    }
}






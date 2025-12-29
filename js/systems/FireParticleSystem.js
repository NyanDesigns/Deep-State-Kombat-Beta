/**
 * Fire Particle System for Character Select Screen
 * Creates stylized arcade-style fire particles rising from the bottom
 */
export class FireParticleSystem {
    constructor(backCanvasId = 'fire-particles-canvas-back', frontCanvasId = 'fire-particles-canvas-front') {
        this.backCanvas = document.getElementById(backCanvasId);
        this.frontCanvas = document.getElementById(frontCanvasId);
        
        if (!this.backCanvas || !this.frontCanvas) {
            console.error(`Fire particle canvases not found: back="${backCanvasId}", front="${frontCanvasId}"`);
            console.error('Back canvas found:', !!this.backCanvas, 'Front canvas found:', !!this.frontCanvas);
            return;
        }

        this.backCtx = this.backCanvas.getContext('2d');
        this.frontCtx = this.frontCanvas.getContext('2d');
        this.particles = [];
        this.animationId = null;
        this.isActive = false;

        // Particle configuration with layered intensity and varied movement
        this.config = {
            maxParticles: 120, // Even more reduced for subtle effect
            // Layer-specific spawn rates (bottom = intense, mid = medium, top = light)
            bottomLayerSpawnRate: 0.2, // Even more reduced spawn rate
            midLayerSpawnRate: 0.1,     // Even more reduced spawn rate
            topLayerSpawnRate: 0.05,    // Even more reduced spawn rate
            minSize: 3,
            maxSize: 12, // Larger particles for visibility
            // Layer-specific speeds (bottom slowest for depth, top fastest)
            bottomMinSpeed: 0.3,  // Slowest at bottom
            bottomMaxSpeed: 0.8,
            midMinSpeed: 0.5,     // Medium speed
            midMaxSpeed: 1.2,
            topMinSpeed: 0.8,     // Fastest at top
            topMaxSpeed: 1.8,
            minLifetime: 6.0, // Longer lifetime to reach top
            maxLifetime: 12.0,
            horizontalDrift: 0.8, // More horizontal movement
            // Movement variation
            sineWaveAmplitude: 15, // Amplitude for sine wave motion
            sineWaveFrequency: 0.02, // Frequency for sine wave
            rotationSpeed: 0.05, // Rotation speed for some particles
            turbulenceStrength: 0.1, // Turbulence strength
            colors: {
                yellow: '#ffcc00',
                orange: '#ff6600',
                red: '#ff0000'
            },
            // Layer boundaries (as percentage of screen height)
            bottomLayerHeight: 0.3,  // Bottom 30% - most intense
            midLayerHeight: 0.6,    // Middle 30% - medium intensity
            topLayerHeight: 1.0     // Top 40% - lighter
        };

        // Resize handler
        this.handleResize = () => this.resize();
        window.addEventListener('resize', this.handleResize);
        this.resize();
    }

    /**
     * Resize canvases to match window dimensions
     */
    resize() {
        if (!this.backCanvas || !this.frontCanvas) return;
        this.backCanvas.width = window.innerWidth;
        this.backCanvas.height = window.innerHeight;
        this.frontCanvas.width = window.innerWidth;
        this.frontCanvas.height = window.innerHeight;
    }

    /**
     * Create a new fire particle
     * @param {string} layer - 'bottom', 'mid', or 'top' for layered intensity
     */
    createParticle(layer = 'bottom') {
        const canvasWidth = this.backCanvas ? this.backCanvas.width : window.innerWidth;
        const canvasHeight = this.backCanvas ? this.backCanvas.height : window.innerHeight;
        const x = Math.random() * canvasWidth;
        
        // Determine if particle goes to top (full height) or middle (lower height)
        // 95% go to top (behind PNG), 5% go to middle (in front of PNG) - minimal front layer
        const goesToTop = Math.random() < 0.95;
        
        // Determine spawn position - front layer particles start off-screen below
        let y = canvasHeight;
        if (!goesToTop) {
            // Front layer particles spawn below the visible screen
            y = canvasHeight + 100 + Math.random() * 50; // 100-150px below screen
        }
        
        const size = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
        
        // Layer-specific speed ranges
        let minSpeed, maxSpeed;
        if (layer === 'bottom') {
            minSpeed = this.config.bottomMinSpeed;
            maxSpeed = this.config.bottomMaxSpeed;
        } else if (layer === 'mid') {
            minSpeed = this.config.midMinSpeed;
            maxSpeed = this.config.midMaxSpeed;
        } else {
            minSpeed = this.config.topMinSpeed;
            maxSpeed = this.config.topMaxSpeed;
        }
        
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const lifetime = this.config.minLifetime + Math.random() * (this.config.maxLifetime - this.config.minLifetime);
        
        // Varied initial horizontal velocity
        const vx = (Math.random() - 0.5) * this.config.horizontalDrift;
        const vy = -speed;

        // Layer-specific properties
        let intensity = 1.0;
        if (layer === 'mid') {
            intensity = 0.7;
        } else if (layer === 'top') {
            intensity = 0.4;
        }

        // Front layer particles terminate lower (around 35% of screen height)
        const maxHeight = goesToTop ? canvasHeight : (canvasHeight * 0.35);

        // Shape type for variation
        const shapeTypes = ['circle', 'flame', 'teardrop', 'elongated'];
        const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

        // Movement pattern variation
        const movementPattern = Math.random() < 0.3 ? 'sine' : (Math.random() < 0.5 ? 'turbulent' : 'curved');
        
        // Initial phase for sine wave
        const sinePhase = Math.random() * Math.PI * 2;
        
        // Rotation for some particles
        const rotation = Math.random() * Math.PI * 2;
        const rotationSpeed = (Math.random() - 0.5) * this.config.rotationSpeed;

        // Opacity variation multiplier (for front layer particles)
        const opacityVariation = 0.6 + Math.random() * 0.4; // 0.6 to 1.0

        // Generate flame shape points once (for flame shape type)
        let flamePoints = null;
        if (shapeType === 'flame') {
            flamePoints = [];
            const points = 8;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const radius = 0.7 + Math.random() * 0.6; // Store as multiplier, not absolute
                flamePoints.push({ angle, radius });
            }
        }

        return {
            x,
            y,
            vx,
            vy,
            size,
            lifetime,
            maxLifetime: lifetime,
            age: 0,
            layer,
            intensity, // Controls opacity multiplier
            shapeType, // Shape variation
            movementPattern, // Movement pattern
            sinePhase, // Phase for sine wave
            rotation, // Current rotation
            rotationSpeed, // Rotation speed
            baseX: x, // Base x for sine wave calculation
            flamePoints, // Pre-generated flame shape points
            goesToTop, // Whether particle goes to top (behind PNG) or middle (in front of PNG)
            maxHeight, // Maximum height this particle will reach
            opacityVariation // Per-particle opacity variation multiplier
        };
    }

    /**
     * Update all particles with layered spawning
     */
    update(dt) {
        if (!this.isActive || !this.backCtx || !this.frontCtx) return;

        // Spawn particles primarily at bottom (most intense layer)
        // Particles naturally rise to create mid and top layers
        const canvasHeight = this.backCanvas ? this.backCanvas.height : window.innerHeight;
        if (this.particles.length < this.config.maxParticles) {
            // Bottom layer - most intense, spawn frequently
            if (Math.random() < this.config.bottomLayerSpawnRate) {
                this.particles.push(this.createParticle('bottom'));
            }
            // Occasionally spawn mid-layer particles for variety
            if (Math.random() < this.config.midLayerSpawnRate * 0.3) {
                const midY = canvasHeight * (1 - this.config.midLayerHeight);
                const p = this.createParticle('mid');
                p.y = midY + (Math.random() - 0.5) * 100; // Spawn around mid layer
                this.particles.push(p);
            }
            // Light top layer spawning
            if (Math.random() < this.config.topLayerSpawnRate * 0.2) {
                const topY = canvasHeight * 0.3;
                const p = this.createParticle('top');
                p.y = topY + (Math.random() - 0.5) * 150; // Spawn in upper area
                this.particles.push(p);
            }
        }

        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update age
            p.age += dt;
            
            // Remove dead particles (only if they've gone past their max height or top)
            if (p.y < -p.size * 2 || (p.y < p.maxHeight && p.age > p.maxLifetime * 0.8)) {
                this.particles.splice(i, 1);
                continue;
            }
            
            // Stop particles that reach their max height (for half-height particles)
            if (!p.goesToTop && p.y <= p.maxHeight) {
                // Slow down and fade out
                p.vy *= 0.95;
                p.vx *= 0.95;
            }

            // Varied movement patterns
            if (p.movementPattern === 'sine') {
                // Sine wave motion - creates curved path
                const sineOffset = Math.sin(p.age * this.config.sineWaveFrequency + p.sinePhase) * this.config.sineWaveAmplitude;
                p.x = p.baseX + sineOffset;
                p.y += p.vy;
            } else if (p.movementPattern === 'turbulent') {
                // Turbulent motion - more chaotic
                p.x += p.vx;
                p.y += p.vy;
                // Add strong turbulence
                p.vx += (Math.random() - 0.5) * this.config.turbulenceStrength;
                p.vy += (Math.random() - 0.5) * this.config.turbulenceStrength * 0.3;
            } else {
                // Curved motion - smooth curves
                p.x += p.vx;
                p.y += p.vy;
                // Gentle curve
                p.vx += Math.sin(p.age * 0.1) * 0.02;
            }
            
            // Apply upward acceleration (fire rises) - slower for bottom layer
            const acceleration = p.layer === 'bottom' ? 0.01 : (p.layer === 'mid' ? 0.015 : 0.02);
            p.vy -= acceleration;
            
            // Clamp horizontal velocity
            p.vx = Math.max(-this.config.horizontalDrift * 1.5, Math.min(this.config.horizontalDrift * 1.5, p.vx));
            
            // Update rotation for visual variation
            if (p.rotationSpeed !== 0) {
                p.rotation += p.rotationSpeed;
            }
        }
    }

    /**
     * Render all particles with layered intensity to appropriate canvas
     */
    render() {
        if (!this.isActive || !this.backCtx || !this.frontCtx) return;

        // Clear both canvases
        this.backCtx.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
        this.frontCtx.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);

        // Separate particles by destination
        const backParticles = []; // Particles that go to top (behind PNG)
        const frontParticles = []; // Particles that go to middle (in front of PNG)

        for (const p of this.particles) {
            if (p.goesToTop) {
                backParticles.push(p);
            } else {
                frontParticles.push(p);
            }
        }

        // Sort particles by y position for proper layering
        backParticles.sort((a, b) => b.y - a.y);
        frontParticles.sort((a, b) => b.y - a.y);

        // Render particles to back canvas (behind PNG)
        for (const p of backParticles) {
            this.renderParticle(p, this.backCtx, this.backCanvas, false);
        }

        // Render particles to front canvas (in front of PNG) with opacity variation
        for (const p of frontParticles) {
            this.renderParticle(p, this.frontCtx, this.frontCanvas, true);
        }
    }

    /**
     * Render a single particle
     */
    renderParticle(p, ctx, canvas, isFrontLayer = false) {

        // Calculate progress based on vertical position (not just age)
        const heightProgress = 1.0 - (p.y / canvas.height);
        const ageProgress = p.age / p.maxLifetime;
        const progress = Math.max(heightProgress, ageProgress * 0.5); // Blend both
        
        // Base opacity with layer intensity multiplier
        let baseOpacity = (1.0 - progress * 0.7) * (p.intensity || 1.0);
        
        // Add more opacity variation for front layer particles
        if (isFrontLayer) {
            // Use per-particle opacity variation with animated flicker
            const flicker = 0.9 + Math.sin(p.age * 3 + p.x * 0.01) * 0.1; // Subtle flicker
            baseOpacity *= (p.opacityVariation || 1.0) * flicker;
            
            // Additional fade based on proximity to max height (for smooth fade at top)
            // This works with the CSS mask to create a seamless fade
            if (p.y < p.maxHeight * 1.1) {
                const fadeStart = p.maxHeight * 1.1;
                const fadeEnd = p.maxHeight * 0.9;
                if (p.y < fadeStart && p.y > fadeEnd) {
                    const fadeProgress = (fadeStart - p.y) / (fadeStart - fadeEnd);
                    baseOpacity *= Math.max(0.3, 1.0 - fadeProgress * 0.7);
                } else if (p.y <= fadeEnd) {
                    baseOpacity *= 0.3; // Very faded near top
                }
            }
        }
        
        const opacity = Math.max(0.05, baseOpacity); // Lower minimum for front layer variation
        
        // Color interpolation: yellow -> orange -> red
        let color;
        if (progress < 0.25) {
            // Yellow to orange (bottom layer - intense)
            const t = progress / 0.25;
            color = this.interpolateColor(this.config.colors.yellow, this.config.colors.orange, t);
        } else if (progress < 0.6) {
            // Orange to red (mid layer)
            const t = (progress - 0.25) / 0.35;
            color = this.interpolateColor(this.config.colors.orange, this.config.colors.red, t);
        } else {
            // Red (top layer - fading)
            color = this.config.colors.red;
        }

        // Draw particle with varied shapes
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotationSpeed !== 0) {
            ctx.rotate(p.rotation);
        }

        // Create gradient
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        gradient.addColorStop(0, this.hexToRgba(color, opacity));
        gradient.addColorStop(0.4, this.hexToRgba(color, opacity * 0.7));
        gradient.addColorStop(0.8, this.hexToRgba(color, opacity * 0.3));
        gradient.addColorStop(1, this.hexToRgba(color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();

        // Draw different shapes based on shapeType
        if (p.shapeType === 'circle') {
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        } else if (p.shapeType === 'flame' && p.flamePoints) {
            // Flame-like irregular shape using pre-generated points
            for (let i = 0; i < p.flamePoints.length; i++) {
                const point = p.flamePoints[i];
                const x = Math.cos(point.angle) * point.radius * p.size;
                const y = Math.sin(point.angle) * point.radius * p.size;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
        } else if (p.shapeType === 'teardrop') {
            // Teardrop shape
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.quadraticCurveTo(-p.size * 0.3, 0, 0, p.size * 0.8);
            ctx.quadraticCurveTo(p.size * 0.3, 0, 0, -p.size);
            ctx.closePath();
        } else if (p.shapeType === 'elongated') {
            // Elongated/flame shape
            const width = p.size * 0.4;
            const height = p.size * 1.2;
            ctx.ellipse(0, 0, width, height, p.rotation * 0.5, 0, Math.PI * 2);
        } else {
            // Fallback to circle
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        }

        ctx.fill();
        ctx.restore();
    }

    /**
     * Interpolate between two hex colors
     */
    interpolateColor(color1, color2, t) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Convert hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 204, b: 0 };
    }

    /**
     * Convert hex color to RGBA string
     */
    hexToRgba(hex, alpha) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isActive) return;

        const dt = 0.016; // Approximate 60fps delta time
        this.update(dt);
        this.render();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Start the particle system
     */
    start() {
        if (this.isActive || !this.backCanvas || !this.frontCanvas) return;
        this.isActive = true;
        this.animate();
    }

    /**
     * Stop the particle system
     */
    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.backCtx) {
            this.backCtx.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
        }
        if (this.frontCtx) {
            this.frontCtx.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        window.removeEventListener('resize', this.handleResize);
        this.particles = [];
    }
}


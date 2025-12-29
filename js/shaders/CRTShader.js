import * as THREE from 'three';

// CRT Shader (updated - no pixelation, that comes from render resolution)
export const CRTShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        curvature: { value: 0.1 },
        scanlineIntensity: { value: 0.15 }, // Reduced scanline intensity
        rgbShift: { value: 0.002 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform float curvature;
        uniform float scanlineIntensity;
        uniform float rgbShift;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;

            // CRT Curvature
            vec2 center = vec2(0.5, 0.5);
            vec2 coord = uv - center;
            float dist = length(coord);
            vec2 distorted = coord * (1.0 + curvature * dist * dist);
            uv = distorted + center;

            // Clamp to valid range
            uv = clamp(uv, 0.0, 1.0);

            // RGB Shift (chromatic aberration)
            float r = texture2D(tDiffuse, uv + vec2(rgbShift, 0.0)).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - vec2(rgbShift, 0.0)).b;

            vec3 color = vec3(r, g, b);

            // Scanlines - reduced intensity
            float scanline = sin(uv.y * resolution.y * 3.14159) * 0.5 + 0.5;
            scanline = pow(scanline, 10.0);
            color *= 1.0 - scanline * scanlineIntensity * 0.5; // Reduced darkening

            // Subtle flicker
            float flicker = 1.0 + sin(time * 10.0) * 0.01;
            color *= flicker;

            // Balanced brightness boost
            color *= 1.5;

            // Balanced gamma correction
            color = pow(color, vec3(0.92));

            // Subtle contrast adjustment
            color = color * 1.03 + vec3(0.01);

            gl_FragColor = vec4(color, 1.0);
        }
    `
};


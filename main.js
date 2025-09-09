import * as THREE from 'three';

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    
    uniform vec3 uColorFace;
    uniform vec3 uColorArmour;
    uniform vec3 uColorTrim;
    uniform vec3 uColorHair;
    uniform vec3 uColorOutline;

    uniform float uThresholdFace;
    uniform float uThresholdArmour;
    uniform float uThresholdTrim;
    uniform float uThresholdHair;
    uniform float uThresholdOutline;

    uniform bool uCleanPixels;
    uniform float uCleanupThreshold;

    // Palette based on the new source image
    const vec3 PALETTE_FACE    = vec3(1.0, 1.0, 0.0); // Yellow
    const vec3 PALETTE_ARMOUR  = vec3(0.0, 0.0, 1.0); // Blue
    const vec3 PALETTE_TRIM    = vec3(0.0, 1.0, 0.0); // Green
    const vec3 PALETTE_HAIR    = vec3(1.0, 0.0, 0.0); // Red
    const vec3 PALETTE_OUTLINE = vec3(0.0, 0.0, 0.0); // Black

    void main() {
        vec4 texColor = texture2D(uTexture, vUv);

        if (uCleanPixels) {
            vec2 onePixel = 1.0 / uResolution;

            // Step 1: Remove stray pixels outside the main silhouette using a larger kernel (5x5 box blur on alpha)
            // This is more robust against small clusters of stray pixels.
            float surroundingAlpha = 0.0;
            for (int i = -2; i <= 2; i++) {
                for (int j = -2; j <= 2; j++) {
                    surroundingAlpha += texture2D(uTexture, vUv + vec2(float(i) * onePixel.x, float(j) * onePixel.y)).a;
                }
            }
            surroundingAlpha /= 25.0; // Average alpha in a 5x5 grid

            // If the average alpha around a pixel is below the threshold, it's likely a stray pixel or a very thin line.
            // We make it transparent.
            if (surroundingAlpha < uCleanupThreshold) {
                texColor.a = 0.0;
            }

            // Step 2: Merge stray pixels inside the silhouette
            if (texColor.a > 0.5) {
                vec4 neighbors[8];
                neighbors[0] = texture2D(uTexture, vUv + vec2(-onePixel.x, -onePixel.y));
                neighbors[1] = texture2D(uTexture, vUv + vec2( 0.0,       -onePixel.y));
                neighbors[2] = texture2D(uTexture, vUv + vec2( onePixel.x, -onePixel.y));
                neighbors[3] = texture2D(uTexture, vUv + vec2(-onePixel.x,  0.0));
                neighbors[4] = texture2D(uTexture, vUv + vec2( onePixel.x,  0.0));
                neighbors[5] = texture2D(uTexture, vUv + vec2(-onePixel.x,  onePixel.y));
                neighbors[6] = texture2D(uTexture, vUv + vec2( 0.0,        onePixel.y));
                neighbors[7] = texture2D(uTexture, vUv + vec2( onePixel.x,  onePixel.y));

                // If a pixel is different from most of its neighbors, it's a stray pixel inside.
                // Replace it with the color of the first opaque neighbor we find.
                int differentNeighbors = 0;
                vec3 replacementColor = texColor.rgb;
                bool foundReplacement = false;

                for (int i = 0; i < 8; i++) {
                    if (neighbors[i].a > 0.5) {
                        if (!foundReplacement) {
                            replacementColor = neighbors[i].rgb;
                            foundReplacement = true;
                        }
                        if (distance(texColor.rgb, neighbors[i].rgb) > 0.1) {
                            differentNeighbors++;
                        }
                    }
                }
                
                // If the pixel is different from at least 3 of its opaque neighbors, replace it.
                // This is a simple heuristic for being the "odd one out".
                if (foundReplacement && differentNeighbors >= 3) {
                    texColor.rgb = replacementColor;
                }
            }
        }

        if (texColor.a < 0.1) {
            discard;
        }

        vec3 finalColor = texColor.rgb;

        vec3 colors[5];
        colors[0] = PALETTE_FACE;
        colors[1] = PALETTE_ARMOUR;
        colors[2] = PALETTE_TRIM;
        colors[3] = PALETTE_HAIR;
        colors[4] = PALETTE_OUTLINE;

        float dists[5];
        dists[0] = distance(texColor.rgb, colors[0]);
        dists[1] = distance(texColor.rgb, colors[1]);
        dists[2] = distance(texColor.rgb, colors[2]);
        dists[3] = distance(texColor.rgb, colors[3]);
        dists[4] = distance(texColor.rgb, colors[4]);
        
        float min_dist = 10.0;
        int min_idx = -1;

        for (int i = 0; i < 5; i++) {
            if (dists[i] < min_dist) {
                min_dist = dists[i];
                min_idx = i;
            }
        }

        if (min_idx == 0) {
            if (min_dist < uThresholdFace) finalColor = uColorFace;
        } else if (min_idx == 1) {
            if (min_dist < uThresholdArmour) finalColor = uColorArmour;
        } else if (min_idx == 2) {
            if (min_dist < uThresholdTrim) finalColor = uColorTrim;
        } else if (min_idx == 3) {
            if (min_dist < uThresholdHair) finalColor = uColorHair;
        } else if (min_idx == 4) {
            if (min_dist < uThresholdOutline) finalColor = uColorOutline;
        }

        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;

// Basic setup
const canvas = document.getElementById('main-canvas');
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
const scene = new THREE.Scene();

// Camera
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

// Texture and Material
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('warrior.png', (loadedTexture) => {
    // Pass texture resolution to the shader
    shaderMaterial.uniforms.uResolution.value.x = loadedTexture.image.width;
    shaderMaterial.uniforms.uResolution.value.y = loadedTexture.image.height;
});
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2(1, 1) }, // Default, will be updated on load
        uColorFace: { value: new THREE.Color('#FFFF00') },
        uColorArmour: { value: new THREE.Color('#0000FF') },
        uColorTrim: { value: new THREE.Color('#00FF00') },
        uColorHair: { value: new THREE.Color('#FF0000') },
        uColorOutline: { value: new THREE.Color('#000000') },
        uThresholdFace: { value: 1.0 },
        uThresholdArmour: { value: 1.0 },
        uThresholdTrim: { value: 1.0 },
        uThresholdHair: { value: 1.0 },
        uThresholdOutline: { value: 1.0 },
        uCleanPixels: { value: true },
        uCleanupThreshold: { value: 0.4 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
});

// Geometry
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, shaderMaterial);
scene.add(mesh);

// Handle Resize
function resize() {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.updateProjectionMatrix();

    // Adjust plane to fit texture aspect ratio
    const imageAspect = 3 / 4; // width / height of the image
    const canvasAspect = clientWidth / clientHeight;
    mesh.scale.set(1, 1, 1);
    if (imageAspect > canvasAspect) {
        mesh.scale.set(1, canvasAspect / imageAspect, 1);
    } else {
        mesh.scale.set(imageAspect / canvasAspect, 1, 1);
    }
}

// Connect UI controls
const colorMappings = {
    'color-face': 'uColorFace',
    'color-armour': 'uColorArmour',
    'color-trim': 'uColorTrim',
    'color-hair': 'uColorHair',
    'color-outline': 'uColorOutline',
};

for (const [id, uniformName] of Object.entries(colorMappings)) {
    const input = document.getElementById(id);
    input.addEventListener('input', (event) => {
        shaderMaterial.uniforms[uniformName].value.set(event.target.value);
    });
}

// Connect individual slider controls
const thresholdMappings = {
    'threshold-face': 'uThresholdFace',
    'threshold-armour': 'uThresholdArmour',
    'threshold-trim': 'uThresholdTrim',
    'threshold-hair': 'uThresholdHair',
    'threshold-outline': 'uThresholdOutline',
};

for (const [id, uniformName] of Object.entries(thresholdMappings)) {
    const slider = document.getElementById(id);
    const valueSpan = document.getElementById(`threshold-value-${id.split('-')[1]}`);
    slider.addEventListener('input', (event) => {
        const threshold = parseFloat(event.target.value);
        shaderMaterial.uniforms[uniformName].value = threshold;
        if (valueSpan) {
            valueSpan.textContent = threshold.toFixed(2);
        }
    });
}

// Connect pixel cleanup toggle
const cleanPixelsToggle = document.getElementById('clean-pixels-toggle');
const cleanupSliderContainer = document.getElementById('cleanup-slider-container');
cleanPixelsToggle.addEventListener('change', (event) => {
    shaderMaterial.uniforms.uCleanPixels.value = event.target.checked;
    cleanupSliderContainer.style.display = event.target.checked ? 'flex' : 'none';
});

// Connect pixel cleanup threshold slider
const cleanupThresholdSlider = document.getElementById('cleanup-threshold-slider');
const cleanupThresholdValue = document.getElementById('cleanup-threshold-value');
cleanupThresholdSlider.addEventListener('input', (event) => {
    const threshold = parseFloat(event.target.value);
    shaderMaterial.uniforms.uCleanupThreshold.value = threshold;
    cleanupThresholdValue.textContent = threshold.toFixed(2);
});

// Remove old global slider logic if it's still there
const oldSliderControl = document.querySelector('.slider-control');
if (oldSliderControl && oldSliderControl.style.display !== 'none' && !oldSliderControl.id) {
    oldSliderControl.style.display = 'none';
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Initial setup
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);
resize();
animate();
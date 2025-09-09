import * as THREE from 'three';

// Shader for Pass 1: Morphological opening to create a clean mask
const maskShader = `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform bool uCleanPixels;

    float getAlpha(vec2 uv) {
        return texture2D(uTexture, uv).a;
    }

    void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        if (texColor.a < 0.1 || !uCleanPixels) {
            gl_FragColor = texColor;
            return;
        }

        vec2 onePixel = 1.0 / uResolution;

        // --- 1. Aggressive Erosion ---
        // This removes small islands. A 5x5 kernel is used.
        float erodedAlpha = 1.0;
        for (int i = -2; i <= 2; i++) {
            for (int j = -2; j <= 2; j++) {
                if (getAlpha(vUv + onePixel * vec2(float(i), float(j))) < 0.5) {
                    erodedAlpha = 0.0;
                }
            }
        }

        // --- 2. Aggressive Dilation ---
        // This restores the shape of the main body, filling gaps.
        float dilatedAlpha = 0.0;
        if (erodedAlpha > 0.5) {
            // If the pixel survived erosion, it's part of the main body, so keep it.
            dilatedAlpha = 1.0;
        } else {
            // If the pixel was eroded, check its neighbors. If any neighbor
            // would have survived erosion, this pixel should be restored.
            for (int i = -2; i <= 2; i++) {
                for (int j = -2; j <= 2; j++) {
                    // We need to check if the neighbor would have survived erosion.
                    // This requires checking the neighbor's own neighborhood.
                    vec2 neighborUv = vUv + onePixel * vec2(float(i), float(j));
                    float neighborSurvived = 1.0;
                    for (int ni = -2; ni <= 2; ni++) {
                        for (int nj = -2; nj <= 2; nj++) {
                            if (getAlpha(neighborUv + onePixel * vec2(float(ni), float(nj))) < 0.5) {
                                neighborSurvived = 0.0;
                            }
                        }
                    }
                    if (neighborSurvived > 0.5) {
                        dilatedAlpha = 1.0;
                        break;
                    }
                }
                if (dilatedAlpha > 0.5) break;
            }
        }
        
        gl_FragColor = vec4(texColor.rgb, dilatedAlpha);
    }
`;

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Final shader for Pass 2: Color replacement
const fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D uTexture; // This will be our cleaned mask texture
    
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

    // Palette based on the new source image
    const vec3 PALETTE_FACE    = vec3(1.0, 1.0, 0.0); // Yellow
    const vec3 PALETTE_ARMOUR  = vec3(0.0, 0.0, 1.0); // Blue
    const vec3 PALETTE_TRIM    = vec3(0.0, 1.0, 0.0); // Green
    const vec3 PALETTE_HAIR    = vec3(1.0, 0.0, 0.0); // Red
    const vec3 PALETTE_OUTLINE = vec3(0.0, 0.0, 0.0); // Black

    void main() {
        vec4 texColor = texture2D(uTexture, vUv);

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

// Render Target for the mask generation pass
let maskRenderTarget = new THREE.WebGLRenderTarget(1, 1);

// Texture and Material
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('warrior.png', (loadedTexture) => {
    const { width, height } = loadedTexture.image;
    // Pass texture resolution to the shader
    maskMaterial.uniforms.uResolution.value.set(width, height);
    // Update render target size
    maskRenderTarget.setSize(width, height);
});
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;

// Material for Pass 1 (Mask Generation)
const maskMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCleanPixels: { value: true },
    },
    vertexShader,
    fragmentShader: maskShader,
    transparent: true
});

// Material for Pass 2 (Final Render)
const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: maskRenderTarget.texture }, // Use the render target's texture
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
cleanPixelsToggle.addEventListener('change', (event) => {
    maskMaterial.uniforms.uCleanPixels.value = event.target.checked;
});

// Remove old global slider logic if it's still there
const oldSliderControl = document.querySelector('.slider-control');
if (oldSliderControl && oldSliderControl.style.display !== 'none') {
    oldSliderControl.style.display = 'none';
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Pass 1: Render to our off-screen buffer to generate the clean mask
    mesh.material = maskMaterial; // Use mask shader
    renderer.setRenderTarget(maskRenderTarget);
    renderer.render(scene, camera);

    // Pass 2: Render to the canvas using the main shader
    mesh.material = shaderMaterial; // Switch to final color shader
    renderer.setRenderTarget(null); // Render to screen
    renderer.render(scene, camera);
}

// Initial setup
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);
resize();
animate();
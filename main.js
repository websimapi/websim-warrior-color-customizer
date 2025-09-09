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
    
    uniform vec3 uColorRed;
    uniform vec3 uColorGreen;
    uniform vec3 uColorBlue;
    uniform vec3 uColorYellow;
    uniform vec3 uColorCyan;
    uniform vec3 uColorMagenta;
    uniform vec3 uColorWhite;
    uniform vec3 uColorBlack;

    uniform float uThresholdRed;
    uniform float uThresholdGreen;
    uniform float uThresholdBlue;
    uniform float uThresholdYellow;
    uniform float uThresholdCyan;
    uniform float uThresholdMagenta;
    uniform float uThresholdWhite;
    uniform float uThresholdBlack;

    const vec3 PALETTE_RED     = vec3(1.0, 0.0, 0.0);
    const vec3 PALETTE_GREEN   = vec3(0.0, 1.0, 0.0);
    const vec3 PALETTE_BLUE    = vec3(0.0, 0.0, 1.0);
    const vec3 PALETTE_YELLOW  = vec3(1.0, 1.0, 0.0);
    const vec3 PALETTE_CYAN    = vec3(0.0, 1.0, 1.0);
    const vec3 PALETTE_MAGENTA = vec3(1.0, 0.0, 1.0);
    const vec3 PALETTE_WHITE   = vec3(1.0, 1.0, 1.0);
    const vec3 PALETTE_BLACK   = vec3(0.0, 0.0, 0.0);

    void main() {
        vec4 texColor = texture2D(uTexture, vUv);

        if (texColor.a < 0.1) {
            discard;
        }

        vec3 finalColor = texColor.rgb;

        float dists[8];
        dists[0] = distance(texColor.rgb, PALETTE_RED);
        dists[1] = distance(texColor.rgb, PALETTE_GREEN);
        dists[2] = distance(texColor.rgb, PALETTE_BLUE);
        dists[3] = distance(texColor.rgb, PALETTE_YELLOW);
        dists[4] = distance(texColor.rgb, PALETTE_CYAN);
        dists[5] = distance(texColor.rgb, PALETTE_MAGENTA);
        dists[6] = distance(texColor.rgb, PALETTE_WHITE);
        dists[7] = distance(texColor.rgb, PALETTE_BLACK);
        
        float min_dist = 10.0;
        int min_idx = -1;

        for (int i = 0; i < 8; i++) {
            if (dists[i] < min_dist) {
                min_dist = dists[i];
                min_idx = i;
            }
        }

        if (min_idx == 0) {
            if (min_dist < uThresholdRed) finalColor = uColorRed;
        } else if (min_idx == 1) {
            if (min_dist < uThresholdGreen) finalColor = uColorGreen;
        } else if (min_idx == 2) {
            if (min_dist < uThresholdBlue) finalColor = uColorBlue;
        } else if (min_idx == 3) {
            if (min_dist < uThresholdYellow) finalColor = uColorYellow;
        } else if (min_idx == 4) {
            if (min_dist < uThresholdCyan) finalColor = uColorCyan;
        } else if (min_idx == 5) {
            if (min_dist < uThresholdMagenta) finalColor = uColorMagenta;
        } else if (min_idx == 6) {
            if (min_dist < uThresholdWhite) finalColor = uColorWhite;
        } else if (min_idx == 7) {
            if (min_dist < uThresholdBlack) finalColor = uColorBlack;
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
const texture = textureLoader.load('warrior.png');
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: texture },
        uColorRed: { value: new THREE.Color('#FF0000') },
        uColorGreen: { value: new THREE.Color('#00FF00') },
        uColorBlue: { value: new THREE.Color('#0000FF') },
        uColorYellow: { value: new THREE.Color('#FFFF00') },
        uColorCyan: { value: new THREE.Color('#00FFFF') },
        uColorMagenta: { value: new THREE.Color('#FF00FF') },
        uColorWhite: { value: new THREE.Color('#FFFFFF') },
        uColorBlack: { value: new THREE.Color('#000000') },
        uThresholdRed: { value: 0.4 },
        uThresholdGreen: { value: 0.4 },
        uThresholdBlue: { value: 0.4 },
        uThresholdYellow: { value: 0.4 },
        uThresholdCyan: { value: 0.4 },
        uThresholdMagenta: { value: 0.4 },
        uThresholdWhite: { value: 0.4 },
        uThresholdBlack: { value: 0.4 },
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
    'color-red': 'uColorRed',
    'color-green': 'uColorGreen',
    'color-blue': 'uColorBlue',
    'color-yellow': 'uColorYellow',
    'color-cyan': 'uColorCyan',
    'color-magenta': 'uColorMagenta',
    'color-white': 'uColorWhite',
    'color-black': 'uColorBlack',
};

for (const [id, uniformName] of Object.entries(colorMappings)) {
    const input = document.getElementById(id);
    input.addEventListener('input', (event) => {
        shaderMaterial.uniforms[uniformName].value.set(event.target.value);
    });
}

// Connect individual slider controls
const thresholdMappings = {
    'threshold-red': 'uThresholdRed',
    'threshold-green': 'uThresholdGreen',
    'threshold-blue': 'uThresholdBlue',
    'threshold-yellow': 'uThresholdYellow',
    'threshold-cyan': 'uThresholdCyan',
    'threshold-magenta': 'uThresholdMagenta',
    'threshold-white': 'uThresholdWhite',
    'threshold-black': 'uThresholdBlack',
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

// Remove old global slider logic if it's still there
const oldSliderControl = document.querySelector('.slider-control');
if (oldSliderControl && oldSliderControl.style.display !== 'none') {
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
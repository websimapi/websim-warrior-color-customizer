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
    uniform float uThreshold;

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

        if (distance(texColor.rgb, PALETTE_RED) < uThreshold) {
            finalColor = uColorRed;
        } else if (distance(texColor.rgb, PALETTE_GREEN) < uThreshold) {
            finalColor = uColorGreen;
        } else if (distance(texColor.rgb, PALETTE_BLUE) < uThreshold) {
            finalColor = uColorBlue;
        } else if (distance(texColor.rgb, PALETTE_YELLOW) < uThreshold) {
            finalColor = uColorYellow;
        } else if (distance(texColor.rgb, PALETTE_CYAN) < uThreshold) {
            finalColor = uColorCyan;
        } else if (distance(texColor.rgb, PALETTE_MAGENTA) < uThreshold) {
            finalColor = uColorMagenta;
        } else if (distance(texColor.rgb, PALETTE_WHITE) < uThreshold) {
            finalColor = uColorWhite;
        } else if (distance(texColor.rgb, PALETTE_BLACK) < uThreshold) {
            finalColor = uColorBlack;
        }

        gl_FragColor = vec4(finalColor, 1.0);
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
        uThreshold: { value: 0.1 },
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

// Connect slider control
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdValueSpan = document.getElementById('threshold-value');

thresholdSlider.addEventListener('input', (event) => {
    const threshold = parseFloat(event.target.value);
    shaderMaterial.uniforms.uThreshold.value = threshold;
    thresholdValueSpan.textContent = threshold.toFixed(2);
});

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
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

// Orbit controls for development
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false; // Disable by default, enable for debugging

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Character and animations
let mixer, idleAction, walkAction, activeAction;
let character;
const loader = new GLTFLoader();

// Temporary capybara box for testing
function createTemporaryCapybara() {
  const geometry = new THREE.BoxGeometry(1, 1, 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown color
  character = new THREE.Mesh(geometry, material);
  character.castShadow = true;
  character.position.set(0, 1, 0);
  scene.add(character);
}

// Load character and animations
async function loadModels() {
  try {
    // Load the capybara model
    const characterModel = await loader.loadAsync('./character/capybara.glb');
    character = characterModel.scene;
    character.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
    character.castShadow = true;
    character.position.set(0, 1, 0);
    scene.add(character);
    
    // Load animations
    mixer = new THREE.AnimationMixer(character);
    
    const idleModel = await loader.loadAsync('./animations/idle.glb');
    const walkModel = await loader.loadAsync('./animations/walk.glb');
    
    idleAction = mixer.clipAction(idleModel.animations[0]);
    walkAction = mixer.clipAction(walkModel.animations[0]);
    activeAction = idleAction;
    idleAction.play();
    
    console.log("Models loaded successfully");
  } catch (error) {
    console.error("Error loading models:", error);
    // Fallback to temporary capybara if loading fails
    createTemporaryCapybara();
  }
}

// Ground plane
function createGround() {
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x7CFC00, // Lawn green
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Add a grid helper for reference
  const gridHelper = new THREE.GridHelper(200, 50);
  scene.add(gridHelper);
}

// Input handling
const keys = { w: false, a: false, s: false, d: false, space: false };
document.addEventListener('keydown', (e) => {
  switch(e.key.toLowerCase()) {
    case 'w': keys.w = true; break;
    case 'a': keys.a = true; break;
    case 's': keys.s = true; break;
    case 'd': keys.d = true; break;
    case ' ': keys.space = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch(e.key.toLowerCase()) {
    case 'w': keys.w = false; break;
    case 'a': keys.a = false; break;
    case 's': keys.s = false; break;
    case 'd': keys.d = false; break;
    case ' ': keys.space = false; break;
  }
});

// Character controller
const moveSpeed = 5;
const jumpForce = 10;
let velocity = new THREE.Vector3();
let isGrounded = true;
let lastDirection = new THREE.Vector3(0, 0, -1); // Default forward direction

function updateCharacter(delta) {
  if (!character) return;
  
  let movement = new THREE.Vector3();
  
  // Movement
  if (keys.w) movement.z -= 1;
  if (keys.s) movement.z += 1;
  if (keys.a) movement.x -= 1;
  if (keys.d) movement.x += 1;
  
  if (movement.length() > 0) {
    movement.normalize().multiplyScalar(moveSpeed * delta);
    lastDirection.copy(movement).normalize();
    
    // Switch to walk animation
    if (mixer && activeAction !== walkAction) {
      activeAction.fadeOut(0.2);
      walkAction.reset().fadeIn(0.2).play();
      activeAction = walkAction;
    }
  } else {
    // Switch to idle animation
    if (mixer && activeAction !== idleAction) {
      activeAction.fadeOut(0.2);
      idleAction.reset().fadeIn(0.2).play();
      activeAction = idleAction;
    }
  }

  // Apply movement
  character.position.x += movement.x;
  character.position.z += movement.z;
  
  // Simple gravity and jumping
  if (isGrounded) {
    velocity.y = 0;
    if (keys.space) {
      velocity.y = jumpForce;
      isGrounded = false;
    }
  } else {
    velocity.y -= 9.8 * 2 * delta; // Heavy gravity (2x normal)
  }
  
  character.position.y += velocity.y * delta;
  
  // Simple ground collision
  if (character.position.y < 1) {
    character.position.y = 1;
    isGrounded = true;
  }
  
  // Rotate character to face movement direction
  if (movement.length() > 0) {
    const targetRotation = Math.atan2(movement.x, movement.z);
    character.rotation.y = targetRotation;
  }
  
  // Camera follow
  camera.position.set(
    character.position.x + lastDirection.x * -10, 
    character.position.y + 5, 
    character.position.z + lastDirection.z * -10
  );
  camera.lookAt(character.position.x, character.position.y + 1, character.position.z);
}

// Animation loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  if (mixer) mixer.update(delta);
  updateCharacter(delta);
  
  controls.update();
  renderer.render(scene, camera);
}

// Initialize and start
async function init() {
  try {
    // Set initial camera position
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Create ground
    createGround();
    
    // Load models
    await loadModels();
    
    // Start animation loop
    animate();
    
    console.log("Initialization complete");
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

init();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
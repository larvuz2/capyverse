import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';

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

// Physics setup
let world, characterBody;
let physicsInitialized = false;

async function initPhysics() {
  // Wait for RAPIER to initialize
  const rapier = await RAPIER();
  
  // Create a physics world
  world = new rapier.World({ x: 0.0, y: -19.62, z: 0.0 }); // Heavy gravity (2x normal)
  
  // Ground
  const groundColliderDesc = rapier.ColliderDesc.cuboid(100.0, 0.1, 100.0);
  world.createCollider(groundColliderDesc);
  
  physicsInitialized = true;
  
  // Store RAPIER namespace for later use
  window.RAPIER = rapier;
}

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
  
  // Create physics body for character
  const rigidBodyDesc = window.RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 1, 0);
  characterBody = world.createRigidBody(rigidBodyDesc);
  
  const characterColliderDesc = window.RAPIER.ColliderDesc.capsule(0.5, 0.3);
  world.createCollider(characterColliderDesc, characterBody);
}

// Load character and animations
async function loadModels() {
  try {
    // Load the capybara model
    const characterModel = await loader.loadAsync('/character/capybara.glb');
    character = characterModel.scene;
    character.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
    character.castShadow = true;
    scene.add(character);
    
    // Create physics body for character
    const rigidBodyDesc = window.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1, 0);
    characterBody = world.createRigidBody(rigidBodyDesc);
    
    const characterColliderDesc = window.RAPIER.ColliderDesc.capsule(0.5, 0.3);
    world.createCollider(characterColliderDesc, characterBody);
    
    // Load animations
    mixer = new THREE.AnimationMixer(character);
    
    const idleModel = await loader.loadAsync('/animations/idle.glb');
    const walkModel = await loader.loadAsync('/animations/walk.glb');
    
    idleAction = mixer.clipAction(idleModel.animations[0]);
    walkAction = mixer.clipAction(walkModel.animations[0]);
    activeAction = idleAction;
    idleAction.play();
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
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
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
let isGrounded = false;
let lastDirection = new THREE.Vector3(0, 0, -1); // Default forward direction

function updateCharacter(delta) {
  if (!characterBody) return;
  
  const velocity = characterBody.linvel();
  let movement = new THREE.Vector3();
  
  // Check if grounded
  const position = characterBody.translation();
  const ray = new window.RAPIER.Ray(
    { x: position.x, y: position.y, z: position.z },
    { x: 0, y: -1, z: 0 }
  );
  const hit = world.castRay(ray, 1.1, true);
  isGrounded = hit !== null;

  // Movement
  if (keys.w) movement.z -= 1;
  if (keys.s) movement.z += 1;
  if (keys.a) movement.x -= 1;
  if (keys.d) movement.x += 1;
  
  if (movement.length() > 0) {
    movement.normalize().multiplyScalar(moveSpeed);
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
  characterBody.setLinvel(
    { x: movement.x, y: velocity.y, z: movement.z },
    true
  );

  // Jump
  if (keys.space && isGrounded) {
    characterBody.setLinvel({ x: velocity.x, y: jumpForce, z: velocity.z }, true);
  }

  // Update character position
  const pos = characterBody.translation();
  character.position.set(pos.x, pos.y - 0.5, pos.z); // Adjust Y to account for capsule height
  
  // Rotate character to face movement direction
  if (movement.length() > 0) {
    const targetRotation = Math.atan2(movement.x, movement.z);
    character.rotation.y = targetRotation;
  }
  
  // Camera follow
  camera.position.set(
    pos.x + lastDirection.x * -10, 
    pos.y + 5, 
    pos.z + lastDirection.z * -10
  );
  camera.lookAt(pos.x, pos.y + 1, pos.z);
}

// Animation loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  if (physicsInitialized) {
    world.step();
    if (mixer) mixer.update(delta);
    updateCharacter(delta);
  }
  
  controls.update();
  renderer.render(scene, camera);
}

// Initialize and start
async function init() {
  await initPhysics();
  createGround();
  await loadModels();
  
  // Set initial camera position
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  
  animate();
}

init();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}); 
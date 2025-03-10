import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

// Third-person camera settings
const cameraSettings = {
  distance: 3.1694,    // Distance from the character
  height: 1.1741,      // Height above the character
  rotationOffset: 0,   // Rotation offset around character (in radians)
  lookAtHeight: 0.515, // Height offset for lookAt point
  damping: 0.05,       // Camera movement smoothing factor
  rotationSpeed: 0.01  // How fast the camera rotates around character
};

// Third-person camera controller
class ThirdPersonCamera {
  constructor(camera, target, settings) {
    this.camera = camera;
    this.target = target;
    this.settings = settings;
    
    // Current camera position and target
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    
    // Initialize position
    this.updatePosition(true);
  }
  
  updatePosition(forceUpdate = false) {
    if (!this.target) return;
    
    // Calculate ideal camera position
    const targetPosition = new THREE.Vector3().copy(this.target.position);
    
    // Calculate camera position based on distance, height and rotation
    const idealOffset = new THREE.Vector3(
      Math.sin(this.settings.rotationOffset) * this.settings.distance,
      this.settings.height,
      Math.cos(this.settings.rotationOffset) * this.settings.distance
    );
    
    // Calculate look-at point with height offset
    const idealLookAt = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + this.settings.lookAtHeight,
      targetPosition.z
    );
    
    // Apply ideal offset to target position
    idealOffset.add(targetPosition);
    
    // Apply damping for smooth camera movement
    if (forceUpdate) {
      this.currentPosition.copy(idealOffset);
      this.currentLookAt.copy(idealLookAt);
    } else {
      // Use higher damping factor for following character
      const followDamping = Math.min(1.0, this.settings.damping * 3);
      this.currentPosition.lerp(idealOffset, followDamping);
      this.currentLookAt.lerp(idealLookAt, followDamping);
    }
    
    // Update camera position and lookAt
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
  
  // Rotate camera around character
  rotateAroundTarget(angleChange) {
    this.settings.rotationOffset += angleChange;
  }
}

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
let rapier = RAPIER;

async function initPhysics() {
  try {
    // Create a physics world
    world = new rapier.World({ x: 0.0, y: -19.62, z: 0.0 }); // Heavy gravity (2x normal)
    
    // Ground
    const groundColliderDesc = rapier.ColliderDesc.cuboid(100.0, 0.1, 100.0);
    world.createCollider(groundColliderDesc);
    
    physicsInitialized = true;
    console.log("Physics initialized successfully");
  } catch (error) {
    console.error("Error initializing physics:", error);
  }
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
  const rigidBodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(0, 1, 0);
  characterBody = world.createRigidBody(rigidBodyDesc);
  
  const characterColliderDesc = rapier.ColliderDesc.capsule(0.5, 0.3);
  world.createCollider(characterColliderDesc, characterBody);
}

// Load character and animations
async function loadModels() {
  try {
    // Load the capybara model
    const characterModel = await loader.loadAsync('./character/capybara.glb');
    character = characterModel.scene;
    character.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
    character.castShadow = true;
    scene.add(character);
    
    // Create physics body for character
    const rigidBodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(0, 1, 0);
    characterBody = world.createRigidBody(rigidBodyDesc);
    
    const characterColliderDesc = rapier.ColliderDesc.capsule(0.5, 0.3);
    world.createCollider(characterColliderDesc, characterBody);
    
    // Load animations
    mixer = new THREE.AnimationMixer(character);
    
    const idleModel = await loader.loadAsync('./animations/idle.glb');
    const walkModel = await loader.loadAsync('./animations/walk.glb');
    
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
const keys = { w: false, a: false, s: false, d: false, space: false, q: false, e: false };
document.addEventListener('keydown', (e) => {
  switch(e.key.toLowerCase()) {
    case 'w': keys.w = true; break;
    case 'a': keys.a = true; break;
    case 's': keys.s = true; break;
    case 'd': keys.d = true; break;
    case ' ': keys.space = true; break;
    case 'q': keys.q = true; break;
    case 'e': keys.e = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch(e.key.toLowerCase()) {
    case 'w': keys.w = false; break;
    case 'a': keys.a = false; break;
    case 's': keys.s = false; break;
    case 'd': keys.d = false; break;
    case ' ': keys.space = false; break;
    case 'q': keys.q = false; break;
    case 'e': keys.e = false; break;
  }
});

// Character controller
const moveSpeed = 5;
const jumpForce = 10;
let isGrounded = false;
let lastDirection = new THREE.Vector3(0, 0, -1); // Default forward direction
let thirdPersonCamera; // Reference to our camera controller

function updateCharacter(delta) {
  if (!characterBody) return;
  
  const velocity = characterBody.linvel();
  let movement = new THREE.Vector3();
  
  // Check if grounded
  const position = characterBody.translation();
  const ray = new rapier.Ray(
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
  
  // Camera rotation with Q and E keys
  if (thirdPersonCamera) {
    if (keys.q) {
      thirdPersonCamera.rotateAroundTarget(cameraSettings.rotationSpeed);
    }
    if (keys.e) {
      thirdPersonCamera.rotateAroundTarget(-cameraSettings.rotationSpeed);
    }
    
    // Force update camera position to always follow character
    thirdPersonCamera.updatePosition(true);
  }
}

// Setup GUI
function setupGUI() {
  const gui = new GUI();
  const cameraFolder = gui.addFolder('Third Person Camera');
  
  // Add controls with onChange handlers to immediately update camera
  cameraFolder.add(cameraSettings, 'distance', 0.1, 30).name('Distance').onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition(true);
  });
  
  cameraFolder.add(cameraSettings, 'height', 0.1, 20).name('Height').onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition(true);
  });
  
  cameraFolder.add(cameraSettings, 'lookAtHeight', 0, 5).name('Look At Height').onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition(true);
  });
  
  cameraFolder.add(cameraSettings, 'damping', 0.01, 0.5).name('Smoothing');
  
  cameraFolder.add(cameraSettings, 'rotationSpeed', 0.001, 0.05).name('Rotation Speed');
  
  cameraFolder.open();
  
  // Add instructions for camera rotation
  const infoElement = document.getElementById('info');
  const cameraInstructions = document.createElement('p');
  cameraInstructions.innerHTML = 'Camera Controls:<br>Q - Rotate Left<br>E - Rotate Right';
  infoElement.appendChild(cameraInstructions);
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
  try {
    // Set initial camera position
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Initialize physics first
    await initPhysics();
    
    // Create ground
    createGround();
    
    // Load models
    await loadModels();
    
    // Setup third-person camera
    thirdPersonCamera = new ThirdPersonCamera(camera, character, cameraSettings);
    
    // Setup GUI controls
    setupGUI();
    
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
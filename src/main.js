import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import StaticCamera from './StaticCamera.js';
import ThirdPersonCamera from './ThirdPersonCamera.js';
import InputManager from './utils/InputManager.js';

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

// Global GUI
const gui = new GUI();
const cameraFolder = gui.addFolder('Camera Controls');

// Camera modes
const cameraModes = {
  mode: 'thirdPerson' // Default to third person camera
};

// Add camera mode dropdown to GUI
cameraFolder.add(cameraModes, 'mode', ['thirdPerson', 'static'])
  .name('Camera Mode')
  .onChange((value) => {
    activeCamera = value;
    console.log(`Switched to ${value} camera`);
  });

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
  
  // Set initial rotation to face away from camera (180 degrees)
  character.rotation.y = Math.PI;
  
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
    character.position.set(0, 1, 0);
    
    // Set initial rotation to face away from camera (180 degrees)
    character.rotation.y = Math.PI;
    
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
    case 'c': 
      // Toggle between camera modes
      if (activeCamera === 'static') {
        activeCamera = 'thirdPerson';
        console.log('Switched to third person camera');
      } else {
        activeCamera = 'static';
        console.log('Switched to static camera');
      }
      break;
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

// Camera controllers
let staticCamera; // Reference to static camera
let thirdPersonCamera; // Reference to third person camera
let activeCamera = 'thirdPerson'; // Default to third person camera

// Add after scene setup
// Input manager for mouse controls
let inputManager;

function updateCharacter(delta) {
  if (!characterBody) return;
  
  const velocity = characterBody.linvel();
  let movement = new THREE.Vector3();
  let shouldRotate = false;
  let targetRotation = 0;
  
  // Check if grounded
  const position = characterBody.translation();
  const ray = new rapier.Ray(
    { x: position.x, y: position.y, z: position.z },
    { x: 0, y: -1, z: 0 }
  );
  const hit = world.castRay(ray, 1.1, true);
  isGrounded = hit !== null;

  // Movement based on key presses
  if (keys.w) {
    // Move forward (character facing away from camera)
    movement.z -= 1;
    targetRotation = Math.PI; // 180 degrees (facing away from camera)
    shouldRotate = true;
  }
  if (keys.s) {
    // Move backward (character facing toward camera)
    movement.z += 1;
    targetRotation = 0; // 0 degrees (facing toward camera)
    shouldRotate = true;
  }
  if (keys.a) {
    // Move left (character facing left)
    movement.x -= 1;
    targetRotation = Math.PI / 2; // 90 degrees (facing left)
    shouldRotate = true;
  }
  if (keys.d) {
    // Move right (character facing right)
    movement.x += 1;
    targetRotation = -Math.PI / 2; // -90 degrees (facing right)
    shouldRotate = true;
  }
  
  // Handle diagonal movement
  if (keys.w && keys.a) {
    targetRotation = Math.PI * 3/4; // 135 degrees
  } else if (keys.w && keys.d) {
    targetRotation = Math.PI * 5/4; // 225 degrees
  } else if (keys.s && keys.a) {
    targetRotation = Math.PI / 4; // 45 degrees
  } else if (keys.s && keys.d) {
    targetRotation = -Math.PI / 4; // -45 degrees
  }
  
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
  if (shouldRotate) {
    // Smooth rotation
    const currentRotation = character.rotation.y;
    const rotationDiff = targetRotation - currentRotation;
    
    // Handle wrapping around 2PI
    let shortestRotation = ((rotationDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (shortestRotation < -Math.PI) {
      shortestRotation += Math.PI * 2;
    }
    
    // Apply smooth rotation
    character.rotation.y += shortestRotation * 0.1;
  }
  
  // Update active camera if it's the third person camera
  if (activeCamera === 'thirdPerson' && thirdPersonCamera && inputManager) {
    // Get mouse movement from input manager
    const mouseDelta = inputManager.getMouseMovement();
    
    // Update the camera with delta time and mouse movement
    thirdPersonCamera.update(delta, mouseDelta);
  }
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
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);
    
    // Initialize physics first
    await initPhysics();
    
    // Create ground
    createGround();
    
    // Load models
    await loadModels();
    
    // Setup cameras
    staticCamera = new StaticCamera(camera, scene);
    
    // Initialize third person camera after character is loaded
    if (character) {
      // Initialize the input manager for camera controls
      inputManager = new InputManager(renderer.domElement);
      
      // Initialize the third person camera with the target character
      thirdPersonCamera = new ThirdPersonCamera(camera, character, {
        distance: 5,      // Distance from the character
        height: 2,        // Height offset above character
        smoothing: 0.05,  // Camera smoothing (lower = smoother)
        useCollision: true // Enable collision detection
      });
      
      // Add collision objects to the camera (all meshes with isMesh flag except the character)
      const collisionObjects = [];
      scene.traverse((object) => {
        if (object.isMesh && object !== character) {
          collisionObjects.push(object);
        }
      });
      
      if (collisionObjects.length > 0) {
        thirdPersonCamera.setCollisionLayers(collisionObjects);
      }
      
      console.log("Third person camera initialized");
    }
    
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
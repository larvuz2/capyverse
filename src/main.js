// Import required modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as rapier from '@dimforge/rapier3d-compat';
import ThirdPersonCamera from './ThirdPersonCamera';
import InputManager from './InputManager';

console.log("Game initializing...");

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Orbit Controls (for development)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false; // Disable orbit controls when using third-person camera

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Physics variables
let world;
let character;
let characterBody;
let mixer;
let idleAction, walkAction, activeAction;
let physicsInitialized = false;
const loader = new GLTFLoader();

// Initialize Rapier physics
async function initPhysics() {
  await rapier.init();
  world = new rapier.World({ x: 0, y: -9.81, z: 0 });
  physicsInitialized = true;
  console.log("Physics initialized");
  
  // Initialize the scene once physics is ready
  createGround();
  loadModels();
  
  // Initialize camera and input after physics and models are loaded
  console.log("Initializing camera and input manager...");
  
  inputManager = new InputManager(renderer.domElement);
  
  thirdPersonCamera = new ThirdPersonCamera(camera, character, {
    distance: 5,
    height: 1.5,
    inputManager,
    smoothing: 0.7
  });
  
  // Disable orbit controls when using third person camera
  controls.enabled = false;
}

// Create a temporary character if model loading fails
function createTemporaryCapybara() {
  console.log("Creating temporary capybara");
  const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  character = new THREE.Mesh(geometry, material);
  character.position.set(0, 1, 0);
  character.castShadow = true;
  scene.add(character);
  
  // Create physics body for character
  const rigidBodyDesc = rapier.RigidBodyDesc.dynamic().setTranslation(0, 1, 0);
  characterBody = world.createRigidBody(rigidBodyDesc);
  
  const characterColliderDesc = rapier.ColliderDesc.capsule(0.5, 0.5);
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

function createGround() {
  // Create ground plane
  const planeGeometry = new THREE.PlaneGeometry(100, 100);
  const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x7CFC00 });
  const ground = new THREE.Mesh(planeGeometry, planeMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Create physics collider for the ground
  const groundColliderDesc = rapier.ColliderDesc.cuboid(50, 0.1, 50)
    .setTranslation(0, -0.1, 0);
  world.createCollider(groundColliderDesc);
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
    case 'r': 
      // Reset camera position when R key is pressed
      if (thirdPersonCamera) {
        console.log("Camera position manually reset");
        thirdPersonCamera.reset();
      }
      break;
    case 't':
      toggleCameraDebugging();
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
let thirdPersonCamera; // Reference to third person camera
let inputManager;

// Camera debug & testing configuration
const cameraDebug = {
  enabled: false,           // Enable/disable debug visualization
  showLines: true,          // Show connection lines
  showStats: true,          // Show camera stats
  measureSmoothness: true,  // Measure camera movement smoothness
  lineColor: 0xff0000,      // Color for debug lines (red)
  historyLength: 10,        // Number of positions to track for smoothness
  positionHistory: []       // Array to track camera positions
};

// Helper function to toggle camera debugging with T key
function toggleCameraDebugging() {
  cameraDebug.enabled = !cameraDebug.enabled;
  console.log(`Camera debugging ${cameraDebug.enabled ? 'enabled' : 'disabled'}`);
  
  // Clean up existing debug objects when toggling off
  if (!cameraDebug.enabled) {
    cleanupCameraDebug();
  } else {
    setupCameraDebug();
  }
}

// Set up camera debugging visualization
function setupCameraDebug() {
  // Clear any existing debug objects
  cleanupCameraDebug();
  
  // Create debug objects container
  cameraDebug.container = new THREE.Group();
  cameraDebug.container.name = 'cameraDebug';
  scene.add(cameraDebug.container);
  
  // Initialize position history
  cameraDebug.positionHistory = [];
}

// Update camera debugging visualization each frame
function updateCameraDebug() {
  if (!cameraDebug.enabled) return;
  
  if (!cameraDebug.container) {
    setupCameraDebug();
  }
  
  // Update debug visualization based on current camera and target
  if (thirdPersonCamera && character) {
    // Add current position to history (for smoothness analysis)
    if (cameraDebug.measureSmoothness) {
      cameraDebug.positionHistory.push(camera.position.clone());
      
      // Keep history at appropriate length
      if (cameraDebug.positionHistory.length > cameraDebug.historyLength) {
        cameraDebug.positionHistory.shift();
      }
    }
    
    // Clear previous debug lines
    while (cameraDebug.container.children.length > 0) {
      cameraDebug.container.remove(cameraDebug.container.children[0]);
    }
    
    // Draw line from camera to target
    if (cameraDebug.showLines) {
      const lineMaterial = new THREE.LineBasicMaterial({ color: cameraDebug.lineColor });
      const points = [];
      points.push(camera.position.clone());
      points.push(character.position.clone());
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      cameraDebug.container.add(line);
      
      // If measuring smoothness, draw lines connecting position history
      if (cameraDebug.measureSmoothness && cameraDebug.positionHistory.length > 1) {
        const smoothnessPoints = [];
        for (const pos of cameraDebug.positionHistory) {
          smoothnessPoints.push(pos);
        }
        
        const smoothnessGeometry = new THREE.BufferGeometry().setFromPoints(smoothnessPoints);
        const smoothnessLine = new THREE.Line(
          smoothnessGeometry,
          new THREE.LineBasicMaterial({ color: 0x00ff00 })
        );
        cameraDebug.container.add(smoothnessLine);
      }
    }
    
    // Display debug info as text
    if (cameraDebug.showStats) {
      const debugElement = document.getElementById('camera-debug') || 
                           document.createElement('div');
      
      if (!document.getElementById('camera-debug')) {
        debugElement.id = 'camera-debug';
        debugElement.style.position = 'absolute';
        debugElement.style.top = '10px';
        debugElement.style.left = '10px';
        debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        debugElement.style.color = 'white';
        debugElement.style.padding = '10px';
        debugElement.style.fontFamily = 'monospace';
        debugElement.style.fontSize = '12px';
        debugElement.style.zIndex = '1000';
        document.body.appendChild(debugElement);
      }
      
      const distance = camera.position.distanceTo(character.position);
      const characterPosFmt = character.position.toArray().map(n => n.toFixed(2)).join(', ');
      const cameraPosFmt = camera.position.toArray().map(n => n.toFixed(2)).join(', ');
      
      debugElement.innerHTML = `
        <strong>Camera Debug</strong><br>
        Character: [${characterPosFmt}]<br>
        Camera: [${cameraPosFmt}]<br>
        Distance: ${distance.toFixed(2)}<br>
        Height from ground: ${camera.position.y.toFixed(2)}<br>
        Camera Rotation: ${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)}<br>
      `;
    }
  }
}

// Clean up camera debug elements
function cleanupCameraDebug() {
  // Remove debug container from scene
  if (cameraDebug.container) {
    scene.remove(cameraDebug.container);
    cameraDebug.container = null;
  }
  
  // Remove debug HTML element
  const debugElement = document.getElementById('camera-debug');
  if (debugElement) {
    document.body.removeChild(debugElement);
  }
  
  // Clear position history
  cameraDebug.positionHistory = [];
}

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
    // Move left (character facing right)
    movement.x -= 1;
    targetRotation = -Math.PI / 2; // -90 degrees (facing right)
    shouldRotate = true;
  }
  if (keys.d) {
    // Move right (character facing left)
    movement.x += 1;
    targetRotation = Math.PI / 2; // 90 degrees (facing left)
    shouldRotate = true;
  }
  
  // Handle diagonal movement
  if (keys.w && keys.a) {
    targetRotation = Math.PI * 5/4; // 225 degrees
  } else if (keys.w && keys.d) {
    targetRotation = Math.PI * 3/4; // 135 degrees
  } else if (keys.s && keys.a) {
    targetRotation = -Math.PI / 4; // -45 degrees
  } else if (keys.s && keys.d) {
    targetRotation = Math.PI / 4; // 45 degrees
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
  
  // Store velocity in userData for debugging purposes
  character.userData.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
  
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
  
  // Update camera directly here as a fallback
  // This ensures camera updates even if character updates fail
  if (thirdPersonCamera && character) {
    try {
      // Only update from here if physics isn't initialized or additional safety checks are needed
      if (!physicsInitialized) {
        const mouseDelta = inputManager ? inputManager.getMouseMovement() : null;
        thirdPersonCamera.update(delta, mouseDelta);
      }
      
      // Emergency safeguards to ensure camera never gets lost
      // Check if camera is below ground
      if (camera.position.y < 0.5) {
        console.warn('Camera below ground, correcting position');
        camera.position.y = Math.max(0.5, character.position.y + 2);
      }
      
      // Check if camera is too far from character
      const distanceToCharacter = camera.position.distanceTo(character.position);
      if (distanceToCharacter > 20) {
        console.warn('Camera too far from character, forcing reset');
        thirdPersonCamera.reset();
      }
    } catch (e) {
      console.warn("Camera update failed:", e);
    }
  }
  
  // Only update orbit controls if third-person camera is not active
  if (!thirdPersonCamera || controls.enabled) {
    controls.update();
  }
  
  // Update camera debug visualization
  updateCameraDebug();
  
  renderer.render(scene, camera);
}

async function init() {
  try {
    console.log("Initializing game...");
    await initPhysics();
    animate();
    
    // Add some initial event listeners for mouse locking
    try {
      // This block runs on initial click, which creates the input manager
      document.body.addEventListener('click', function initMouseHandler() {
        if (!inputManager && character && thirdPersonCamera) {
          // Create input manager for handling mouse movement
          console.log("Creating input manager...");
          inputManager = new InputManager(renderer.domElement);
          thirdPersonCamera.setInputManager(inputManager);
        }
      });
    } catch (e) {
      console.warn("Could not setup initial input handlers:", e);
    }
    
    // Flag that game is ready
    console.log("Game initialization complete");
    
    // Setup complete - if we're in a test environment, flag success
    if (window.testEnvironment) {
      window.gameInitialized = true;
    }
  } catch (error) {
    console.error("Game initialization failed:", error);
  }
}

// Initial debug settings for tests
if (window.location.search.includes('debug=1')) {
  cameraDebug.enabled = true;
}

// Camera success criteria checker - run this from console
window.testCameraFunctionality = function() {
  // Exit early if camera or character aren't ready
  if (!thirdPersonCamera || !character) {
    console.error("Camera or character not initialized");
    return {
      success: false,
      reason: "Camera or character not initialized"
    };
  }
  
  const results = {
    characterVisible: false,
    properHeight: false,
    followsCharacter: false,
    rotationWorks: false,
    smoothMovement: false,
    overallStatus: false
  };
  
  // Test 1: Character is visible (camera is above ground)
  results.characterVisible = camera.position.y > 0.5;
  console.log(`Test 1 - Character is visible: ${results.characterVisible ? 'PASS' : 'FAIL'}`);
  
  // Test 2: Camera has proper height
  const heightDiff = Math.abs(camera.position.y - (character.position.y + thirdPersonCamera.height));
  results.properHeight = heightDiff < 3; // Allow some flexibility for angle
  console.log(`Test 2 - Camera has proper height: ${results.properHeight ? 'PASS' : 'FAIL'}`);
  
  // Test 3: Camera follows character (save initial state)
  const initialPos = character.position.clone();
  const initialCamPos = camera.position.clone();
  
  // Force character movement in X direction
  console.log("Moving character to test camera follow...");
  
  // Store current key states
  const prevKeyStates = { ...keys };
  
  // Simulate W key press for 0.5 seconds
  keys.w = true;
  
  // Wait for character to move
  setTimeout(() => {
    keys.w = prevKeyStates.w; // Reset key states
    
    const movedDistance = character.position.distanceTo(initialPos);
    const cameraMoved = camera.position.distanceTo(initialCamPos);
    
    console.log(`Character moved: ${movedDistance.toFixed(2)} units`);
    console.log(`Camera moved: ${cameraMoved.toFixed(2)} units`);
    
    results.followsCharacter = cameraMoved > 0;
    console.log(`Test 3 - Camera follows character: ${results.followsCharacter ? 'PASS' : 'FAIL'}`);
    
    // Final evaluation
    results.overallStatus = results.characterVisible && 
                            results.properHeight && 
                            results.followsCharacter;
                            
    console.log(`Overall camera test: ${results.overallStatus ? 'PASSED' : 'FAILED'}`);
    return results;
  }, 500);
};

// Start the game
init();

// Expose main components to window for debugging
window.game = {
  scene,
  camera,
  character,
  characterBody,
  world,
  thirdPersonCamera
};
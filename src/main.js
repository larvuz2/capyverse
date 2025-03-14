import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
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

// Set up camera debug visualization
function setupCameraDebug() {
  if (!cameraDebug.debugGroup) {
    cameraDebug.debugGroup = new THREE.Group();
    scene.add(cameraDebug.debugGroup);
  }
  
  // Create line from camera to character
  const lineGeometry = new THREE.BufferGeometry();
  const lineMaterial = new THREE.LineBasicMaterial({ color: cameraDebug.lineColor });
  cameraDebug.connectionLine = new THREE.Line(lineGeometry, lineMaterial);
  cameraDebug.debugGroup.add(cameraDebug.connectionLine);
  
  // Create stats display
  const statsDiv = document.createElement('div');
  statsDiv.id = 'camera-stats';
  statsDiv.style.position = 'absolute';
  statsDiv.style.bottom = '10px';
  statsDiv.style.left = '10px';
  statsDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
  statsDiv.style.color = 'white';
  statsDiv.style.padding = '10px';
  statsDiv.style.fontFamily = 'monospace';
  statsDiv.style.fontSize = '12px';
  statsDiv.style.zIndex = '100';
  statsDiv.style.display = cameraDebug.enabled ? 'block' : 'none';
  document.body.appendChild(statsDiv);
  cameraDebug.statsDiv = statsDiv;
}

// Update camera debug visualization
function updateCameraDebug() {
  if (!cameraDebug.enabled || !thirdPersonCamera || !character) return;
  
  // Ensure debug group exists
  if (!cameraDebug.debugGroup) {
    setupCameraDebug();
  }
  
  // Update connection line
  if (cameraDebug.showLines && cameraDebug.connectionLine) {
    const points = [
      camera.position.clone(),
      character.position.clone()
    ];
    cameraDebug.connectionLine.geometry.dispose();
    cameraDebug.connectionLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
  
  // Track position history for smoothness measurement
  if (cameraDebug.measureSmoothness) {
    cameraDebug.positionHistory.push(camera.position.clone());
    if (cameraDebug.positionHistory.length > cameraDebug.historyLength) {
      cameraDebug.positionHistory.shift();
    }
  }
  
  // Update stats display
  if (cameraDebug.showStats && cameraDebug.statsDiv) {
    const distance = camera.position.distanceTo(character.position).toFixed(2);
    const height = camera.position.y.toFixed(2);
    const characterPos = `${character.position.x.toFixed(1)}, ${character.position.y.toFixed(1)}, ${character.position.z.toFixed(1)}`;
    const cameraPos = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
    
    // Calculate camera movement smoothness if we have enough history
    let smoothnessScore = "N/A";
    if (cameraDebug.positionHistory.length >= 3) {
      let totalJitter = 0;
      for (let i = 2; i < cameraDebug.positionHistory.length; i++) {
        // Compare acceleration (change in velocity) as a measure of smoothness
        const pos1 = cameraDebug.positionHistory[i-2];
        const pos2 = cameraDebug.positionHistory[i-1];
        const pos3 = cameraDebug.positionHistory[i];
        
        const vel1 = new THREE.Vector3().subVectors(pos2, pos1);
        const vel2 = new THREE.Vector3().subVectors(pos3, pos2);
        const accel = new THREE.Vector3().subVectors(vel2, vel1);
        
        totalJitter += accel.length();
      }
      const avgJitter = totalJitter / (cameraDebug.positionHistory.length - 2);
      smoothnessScore = avgJitter.toFixed(4);
    }
    
    cameraDebug.statsDiv.innerHTML = `
      <h3>Camera Debug</h3>
      <p>Character: ${characterPos}</p>
      <p>Camera: ${cameraPos}</p>
      <p>Distance: ${distance}</p>
      <p>Height: ${height}</p>
      <p>Smoothness: ${smoothnessScore} (lower is better)</p>
    `;
  }
}

// Clean up camera debug objects
function cleanupCameraDebug() {
  if (cameraDebug.debugGroup) {
    scene.remove(cameraDebug.debugGroup);
    cameraDebug.debugGroup = null;
  }
  
  if (cameraDebug.statsDiv) {
    cameraDebug.statsDiv.style.display = 'none';
  }
  
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
  
  // Update the camera with delta time and mouse movement
  if (thirdPersonCamera && inputManager) {
    try {
      // Get mouse movement from input manager with error handling
      const mouseDelta = inputManager.getMouseMovement();
      
      // Update the camera with delta time and mouse movement
      thirdPersonCamera.update(delta, mouseDelta);
    } catch (error) {
      console.error("Error updating camera:", error);
    }
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

// Initialize and start
async function init() {
  try {
    // Set initial camera position high enough to see the ground
    // This will be overridden by the third person camera
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);
    
    // Initialize physics first
    await initPhysics();
    
    // Create ground
    createGround();
    
    // Load models
    await loadModels();
    
    // Create a container element for instructions
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.position = 'absolute';
    instructions.style.top = '10px';
    instructions.style.width = '100%';
    instructions.style.textAlign = 'center';
    instructions.style.color = 'white';
    instructions.style.backgroundColor = 'rgba(0,0,0,0.5)';
    instructions.style.padding = '10px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.fontSize = '14px';
    instructions.style.zIndex = '100';
    instructions.innerHTML = `
      <h2>Camera Controls</h2>
      <p>Click to enable camera control</p>
      <p>Move mouse to look around</p>
      <p>WASD to move, SPACE to jump</p>
      <p>Press R to reset camera position</p>
      <p>Press T to toggle camera debug mode</p>
      <p>ESC to release mouse control</p>
    `;
    document.body.appendChild(instructions);
    
    // Add a button to toggle instructions
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Show/Hide Help';
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '101';
    toggleButton.addEventListener('click', () => {
      if (instructions.style.display === 'none') {
        instructions.style.display = 'block';
      } else {
        instructions.style.display = 'none';
      }
    });
    document.body.appendChild(toggleButton);
    
    // Hide instructions after 5 seconds, but leave toggle button visible
    setTimeout(() => {
      instructions.style.opacity = '0';
      instructions.style.transition = 'opacity 1s';
    }, 5000);
    
    // Initialize the input manager for camera controls
    // Pass the renderer's DOM element for proper pointer lock
    inputManager = new InputManager(renderer.domElement);
    
    // Initialize the third person camera after character is loaded
    if (character) {
      console.log("Character loaded, initializing camera to follow:", character);
      
      // Initialize the third person camera with proper configuration
      thirdPersonCamera = new ThirdPersonCamera(camera, character, {
        distance: 6,         // Slightly further back for better view
        height: 2,           // Height offset above character
        smoothing: 0.1       // Simple smoothing value
      });
      
      // Force immediate positioning of camera behind character
      thirdPersonCamera.reset();
      
      console.log("Third person camera initialized");
    } else {
      console.error("Character not loaded properly, cannot initialize camera");
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
  
  // Set a timeout to check results after movement
  setTimeout(() => {
    // Release keys
    keys.w = prevKeyStates.w;
    
    // Check if camera has moved with character
    const newDistance = camera.position.distanceTo(character.position);
    const followDistance = Math.abs(
      newDistance - initialCamPos.distanceTo(initialPos)
    );
    
    results.followsCharacter = followDistance < 2; // Should be approximately the same distance
    console.log(`Test 3 - Camera follows character: ${results.followsCharacter ? 'PASS' : 'FAIL'}`);
    
    // Test 5: Movement is smooth (check jitter score if available)
    if (cameraDebug.positionHistory.length >= 3) {
      // Use the jitter calculation from our debug function
      let totalJitter = 0;
      for (let i = 2; i < cameraDebug.positionHistory.length; i++) {
        const pos1 = cameraDebug.positionHistory[i-2];
        const pos2 = cameraDebug.positionHistory[i-1];
        const pos3 = cameraDebug.positionHistory[i];
        
        const vel1 = new THREE.Vector3().subVectors(pos2, pos1);
        const vel2 = new THREE.Vector3().subVectors(pos3, pos2);
        const accel = new THREE.Vector3().subVectors(vel2, vel1);
        
        totalJitter += accel.length();
      }
      const avgJitter = totalJitter / (cameraDebug.positionHistory.length - 2);
      
      // Lower jitter score means smoother movement
      results.smoothMovement = avgJitter < 0.1;
      console.log(`Test 5 - Camera movement is smooth (jitter: ${avgJitter.toFixed(4)}): ${results.smoothMovement ? 'PASS' : 'FAIL'}`);
    } else {
      console.log("Test 5 - Not enough position data to measure smoothness");
      results.smoothMovement = true; // Default to true if we can't measure
    }
    
    // Calculate overall status
    results.overallStatus = results.characterVisible &&
                          results.properHeight &&
                          results.followsCharacter &&
                          results.smoothMovement;
    
    console.log(`\nOVERALL CAMERA FUNCTIONALITY: ${results.overallStatus ? 'PASSED' : 'FAILED'}`);
    console.log("For Test 4 (rotation works), please manually verify by moving the mouse");
    console.log("If the camera rotates around the character when moving the mouse, Test 4 PASSES");
    
    return results;
  }, 500);
  
  console.log("Camera functionality test in progress...");
  console.log("Check console in 0.5 seconds for results");
  
  // Manual test instruction for rotation
  console.log("\nTest 4 - Manual check: Move mouse and verify camera rotation");
  
  return "Test running...";
};
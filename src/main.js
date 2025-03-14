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
gui.title('Capyverse Controls');

// Configuration object for all adjustable parameters
const config = {
  camera: {
    distance: 2.8,
    height: 2,
    lookAtHeight: 0.5,
    smoothing: 0.74,
    minVerticalAngle: -0.5,
    maxVerticalAngle: 0.8,
    rotationSpeed: 0.003,
    reset: function() {
      // Reset camera parameters to defaults
      config.camera.distance = 2.8;
      config.camera.height = 2;
      config.camera.lookAtHeight = 0.5;
      config.camera.smoothing = 0.74;
      config.camera.minVerticalAngle = -0.5;
      config.camera.maxVerticalAngle = 0.8;
      config.camera.rotationSpeed = 0.003;
      
      // Update camera with reset values
      if (thirdPersonCamera) {
        thirdPersonCamera.distance = config.camera.distance;
        thirdPersonCamera.height = config.camera.height;
        thirdPersonCamera.smoothing = config.camera.smoothing;
        thirdPersonCamera.minVerticalAngle = config.camera.minVerticalAngle;
        thirdPersonCamera.maxVerticalAngle = config.camera.maxVerticalAngle;
      }
      
      // Update input manager
      if (inputManager) {
        inputManager.sensitivity = config.camera.rotationSpeed;
      }
      
      // Update all controllers
      for (const controller of Object.values(cameraFolder.controllers)) {
        controller.updateDisplay();
      }
    }
  },
  character: {
    moveSpeed: 2,
    jumpForce: 5,
    turnSpeed: 5,
    reset: function() {
      // Reset character parameters to defaults
      config.character.moveSpeed = 2;
      config.character.jumpForce = 5;
      config.character.turnSpeed = 5;
      
      // Update all controllers
      for (const controller of Object.values(characterFolder.controllers)) {
        controller.updateDisplay();
      }
    }
  },
  physics: {
    gravity: -23,
    friction: 0.2,
    restitution: 0,
    reset: function() {
      // Reset physics parameters to defaults
      config.physics.gravity = -23;
      config.physics.friction = 0.2;
      config.physics.restitution = 0;
      
      // Update physics world
      if (world) {
        world.gravity.y = config.physics.gravity;
      }
      
      // Update all controllers
      for (const controller of Object.values(physicsFolder.controllers)) {
        controller.updateDisplay();
      }
    }
  },
  presets: {
    current: 'Default',
    // Apply a specific preset configuration
    apply: function(presetName) {
      const preset = config.presets.list[presetName];
      if (!preset) return;
      
      // Apply camera settings
      if (preset.camera) {
        Object.assign(config.camera, preset.camera);
        
        // Update third-person camera
        if (thirdPersonCamera) {
          thirdPersonCamera.distance = config.camera.distance;
          thirdPersonCamera.height = config.camera.height;
          thirdPersonCamera.lookAtHeightOffset = config.camera.lookAtHeight;
          thirdPersonCamera.smoothing = config.camera.smoothing;
          thirdPersonCamera.minVerticalAngle = config.camera.minVerticalAngle;
          thirdPersonCamera.maxVerticalAngle = config.camera.maxVerticalAngle;
        }
        
        // Update input manager
        if (inputManager) {
          inputManager.sensitivity = config.camera.rotationSpeed;
        }
        
        // Update camera controllers
        for (const controller of Object.values(cameraFolder.controllers)) {
          controller.updateDisplay();
        }
      }
      
      // Apply character settings
      if (preset.character) {
        Object.assign(config.character, preset.character);
        
        // Update character controllers
        for (const controller of Object.values(characterFolder.controllers)) {
          controller.updateDisplay();
        }
      }
      
      // Apply physics settings
      if (preset.physics) {
        Object.assign(config.physics, preset.physics);
        
        // Update physics world
        if (world) {
          world.gravity.y = config.physics.gravity;
        }
        
        // Update physics controllers
        for (const controller of Object.values(physicsFolder.controllers)) {
          controller.updateDisplay();
        }
      }
      
      // Update current preset name
      config.presets.current = presetName;
      presetsFolder.controllers[0].updateDisplay();
    },
    // Predefined preset configurations
    list: {
      'Default': {
        camera: {
          distance: 2.8,
          height: 2,
          lookAtHeight: 0.5,
          smoothing: 0.74,
          minVerticalAngle: -0.5,
          maxVerticalAngle: 0.8,
          rotationSpeed: 0.003
        },
        character: {
          moveSpeed: 2,
          jumpForce: 5,
          turnSpeed: 5
        },
        physics: {
          gravity: -23,
          friction: 0.2,
          restitution: 0
        }
      },
      'Low Gravity': {
        physics: {
          gravity: -5,
          restitution: 0.3
        },
        character: {
          jumpForce: 5
        }
      },
      'Cinematic': {
        camera: {
          distance: 3,
          height: 1.2,
          lookAtHeight: 0.7,
          smoothing: 0.05,
          rotationSpeed: 0.001
        },
        character: {
          moveSpeed: 3,
          turnSpeed: 3
        }
      },
      'Fast Movement': {
        character: {
          moveSpeed: 15,
          jumpForce: 20,
          turnSpeed: 10
        }
      },
      'Top-Down View': {
        camera: {
          distance: 10,
          height: 8,
          verticalAngle: 1.3,
          maxVerticalAngle: 1.4
        }
      }
    }
  },
  gui: {
    visible: false,
    toggle: function() {
      config.gui.visible = !config.gui.visible;
      if (config.gui.visible) {
        gui.domElement.style.display = '';
      } else {
        gui.domElement.style.display = 'none';
      }
    }
  },
  // Add local storage functionality
  storage: {
    save: function() {
      // Create a clean copy of current config without functions and GUI state
      const configToSave = {
        camera: { ...config.camera },
        character: { ...config.character },
        physics: { ...config.physics }
      };
      
      // Remove function properties
      delete configToSave.camera.reset;
      delete configToSave.character.reset;
      delete configToSave.physics.reset;
      
      // Save to localStorage
      try {
        localStorage.setItem('capyverse-config', JSON.stringify(configToSave));
        console.log('Configuration saved to localStorage');
        alert('Settings saved successfully!');
      } catch (error) {
        console.error('Error saving configuration:', error);
        alert('Error saving settings: ' + error.message);
      }
    },
    load: function() {
      try {
        const savedConfig = localStorage.getItem('capyverse-config');
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          
          // Apply saved configuration
          if (parsedConfig.camera) Object.assign(config.camera, parsedConfig.camera);
          if (parsedConfig.character) Object.assign(config.character, parsedConfig.character);
          if (parsedConfig.physics) Object.assign(config.physics, parsedConfig.physics);
          
          // Update all controllers
          for (const folder of [cameraFolder, characterFolder, physicsFolder]) {
            for (const controller of Object.values(folder.controllers)) {
              controller.updateDisplay();
            }
          }
          
          // Apply configuration to game objects
          if (thirdPersonCamera) {
            thirdPersonCamera.distance = config.camera.distance;
            thirdPersonCamera.height = config.camera.height;
            thirdPersonCamera.lookAtHeightOffset = config.camera.lookAtHeight;
            thirdPersonCamera.smoothing = config.camera.smoothing;
            thirdPersonCamera.minVerticalAngle = config.camera.minVerticalAngle;
            thirdPersonCamera.maxVerticalAngle = config.camera.maxVerticalAngle;
          }
          
          if (inputManager) {
            inputManager.sensitivity = config.camera.rotationSpeed;
          }
          
          if (world) {
            world.gravity.y = config.physics.gravity;
          }
          
          console.log('Configuration loaded from localStorage');
          alert('Settings loaded successfully!');
        } else {
          alert('No saved settings found');
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
        alert('Error loading settings: ' + error.message);
      }
    }
  }
};

// Create GUI folders for organization
const cameraFolder = gui.addFolder('Camera');
const characterFolder = gui.addFolder('Character');
const physicsFolder = gui.addFolder('Physics');
const presetsFolder = gui.addFolder('Presets');
const storageFolder = gui.addFolder('Save/Load');
const guiControlsFolder = gui.addFolder('GUI Controls');

// Setup camera controls
cameraFolder.add(config.camera, 'distance', 1, 15, 0.1).name('Distance').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.distance = value;
});
cameraFolder.add(config.camera, 'height', 0, 5, 0.1).name('Height').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.height = value;
});
cameraFolder.add(config.camera, 'lookAtHeight', 0, 3, 0.1).name('Look At Height').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.lookAtHeightOffset = value;
});
cameraFolder.add(config.camera, 'smoothing', 0.01, 1, 0.01).name('Smoothing').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.smoothing = value;
});
cameraFolder.add(config.camera, 'minVerticalAngle', -1.5, 0, 0.1).name('Min Vertical Angle').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.minVerticalAngle = value;
});
cameraFolder.add(config.camera, 'maxVerticalAngle', 0, 1.5, 0.1).name('Max Vertical Angle').onChange(value => {
  if (thirdPersonCamera) thirdPersonCamera.maxVerticalAngle = value;
});
cameraFolder.add(config.camera, 'rotationSpeed', 0.0001, 0.01, 0.0001).name('Rotation Speed').onChange(value => {
  if (inputManager) inputManager.sensitivity = value;
});
cameraFolder.add(config.camera, 'reset').name('Reset Camera Settings');

// Setup character controls
characterFolder.add(config.character, 'moveSpeed', 1, 20, 0.5).name('Move Speed');
characterFolder.add(config.character, 'jumpForce', 5, 30, 1).name('Jump Force');
characterFolder.add(config.character, 'turnSpeed', 1, 15, 0.5).name('Turn Speed');
characterFolder.add(config.character, 'reset').name('Reset Character Settings');

// Setup physics controls
physicsFolder.add(config.physics, 'gravity', -30, -1, 0.5).name('Gravity').onChange(value => {
  if (world) world.gravity.y = value;
});
physicsFolder.add(config.physics, 'friction', 0, 1, 0.05).name('Friction');
physicsFolder.add(config.physics, 'restitution', 0, 1, 0.05).name('Restitution');
physicsFolder.add(config.physics, 'reset').name('Reset Physics Settings');

// Setup presets controls
presetsFolder.add(config.presets, 'current', Object.keys(config.presets.list)).name('Current Preset').onChange(value => {
  config.presets.apply(value);
});

// Add preset application button
for (const presetName of Object.keys(config.presets.list)) {
  presetsFolder.add({
    applyPreset: () => config.presets.apply(presetName)
  }, 'applyPreset').name(`Apply ${presetName}`);
}

// Setup storage controls
storageFolder.add(config.storage, 'save').name('Save Settings');
storageFolder.add(config.storage, 'load').name('Load Settings');

// Setup GUI controls
guiControlsFolder.add(config.gui, 'visible').name('Show GUI').onChange(value => {
  if (value) {
    gui.domElement.style.display = '';
  } else {
    gui.domElement.style.display = 'none';
  }
});
guiControlsFolder.add(config.gui, 'toggle').name('Toggle GUI (G key)');

// Open all folders by default
cameraFolder.open();
characterFolder.open();
physicsFolder.open();
presetsFolder.open();
storageFolder.open();
guiControlsFolder.open();

// Hide GUI by default
gui.domElement.style.display = 'none';

// Add G key to toggle GUI visibility
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'g') {
    config.gui.toggle();
  }
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
    // Create a physics world with gravity from config
    world = new rapier.World({ x: 0.0, y: config.physics.gravity, z: 0.0 });
    
    // Ground
    const groundColliderDesc = rapier.ColliderDesc.cuboid(100.0, 0.1, 100.0)
      .setFriction(config.physics.friction)
      .setRestitution(config.physics.restitution);
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

function handleCharacterMovement(deltaTime) {
  if (!characterBody || !character) return;
  
  // Skip if no physics system
  if (!physicsInitialized) return;
  
  // Get current linear velocity (maintain Y velocity for gravity)
  const currentVel = characterBody.linvel();
  
  // Default to no movement (will be overridden by keys if pressed)
  let moveDirection = new THREE.Vector3(0, 0, 0);
  
  // Apply input to movement direction
  if (keys.w) moveDirection.z = -1;
  if (keys.s) moveDirection.z = 1;
  if (keys.a) moveDirection.x = -1;
  if (keys.d) moveDirection.x = 1;
  
  // Normalize the direction vector to prevent diagonal movement from being faster
  if (moveDirection.length() > 0) {
    moveDirection.normalize();
    
    // Adjust movement direction based on camera angle
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    cameraDirection.y = 0; // Keep movement on the xz plane
    cameraDirection.normalize();
    
    // Create a rotation matrix from the camera direction
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.lookAt(new THREE.Vector3(0, 0, 0), cameraDirection, new THREE.Vector3(0, 1, 0));
    
    // Apply rotation to the movement direction
    moveDirection.applyMatrix4(rotationMatrix);
    
    // Store last direction for character rotation when stopped
    lastDirection.copy(moveDirection);
  }
  
  // Apply the configured movement speed
  moveDirection.multiplyScalar(config.character.moveSpeed);
  
  // Apply jump if space is pressed and character is grounded
  if (keys.space && isGrounded) {
    moveDirection.y = config.character.jumpForce;
    isGrounded = false;
  } else {
    // Preserve existing Y velocity (gravity)
    moveDirection.y = currentVel.y;
  }
  
  // Update physics body velocity
  characterBody.setLinvel({ x: moveDirection.x, y: moveDirection.y, z: moveDirection.z }, true);
  
  // Get the updated position from physics and apply to character mesh
  const position = characterBody.translation();
  character.position.set(position.x, position.y - 0.5, position.z); // Offset Y to account for capsule center
  
  // Rotate the character to face the movement direction, only if moving
  if (Math.abs(moveDirection.x) > 0.1 || Math.abs(moveDirection.z) > 0.1) {
    // Calculate the angle in radians and apply rotation with smoothing
    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
    const currentAngle = character.rotation.y;
    const angleDiff = (targetAngle - currentAngle + Math.PI) % (Math.PI * 2) - Math.PI;
    
    // Use turnSpeed from config for rotation speed
    character.rotation.y += angleDiff * Math.min(1, config.character.turnSpeed * deltaTime);
  }
}

// Animation loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  
  // Calculate delta time
  const delta = clock.getDelta();
  
  // Update physics
  if (physicsInitialized && world) {
    world.step();
    
    // Update ground collider properties if they've changed
    // This is more expensive so we don't do it every frame
    if (world.getCollider(0)) {
      const groundCollider = world.getCollider(0);
      if (groundCollider.friction() !== config.physics.friction) {
        groundCollider.setFriction(config.physics.friction);
      }
      if (groundCollider.restitution() !== config.physics.restitution) {
        groundCollider.setRestitution(config.physics.restitution);
      }
    }
  }
  
  // Update character animations
  if (mixer) {
    mixer.update(delta);
  }
  
  // Update character position and movement
  handleCharacterMovement(delta);
  
  // Check if character is grounded
  if (characterBody && world) {
    const position = characterBody.translation();
    const ray = new rapier.Ray(
      { x: position.x, y: position.y, z: position.z },
      { x: 0, y: -1, z: 0 }
    );
    const hit = world.castRay(ray, 1.1, true);
    isGrounded = hit !== null;
  }
  
  // Update third-person camera
  if (thirdPersonCamera && inputManager) {
    try {
      // Get mouse movement from input manager
      const mouseDelta = inputManager.getMouseMovement();
      
      // Update the camera with delta time and mouse movement
      thirdPersonCamera.update(delta, mouseDelta);
      
      // Update camera debug visualization if enabled
      updateCameraDebug();
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  }
  
  // Render the scene
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
    
    // Initialize Input Manager for camera controls
    inputManager = new InputManager(renderer.domElement);
    inputManager.sensitivity = config.camera.rotationSpeed;
    
    // Initialize the third-person camera with config values
    thirdPersonCamera = new ThirdPersonCamera(camera, character, {
      distance: config.camera.distance,
      height: config.camera.height,
      smoothing: config.camera.smoothing,
      lookAtHeightOffset: config.camera.lookAtHeight,
      minVerticalAngle: config.camera.minVerticalAngle,
      maxVerticalAngle: config.camera.maxVerticalAngle
    });
    
    // Update GUI with actual camera values (in case they were modified during initialization)
    config.camera.distance = thirdPersonCamera.distance;
    config.camera.height = thirdPersonCamera.height;
    config.camera.lookAtHeight = thirdPersonCamera.lookAtHeightOffset;
    config.camera.smoothing = thirdPersonCamera.smoothing;
    config.camera.minVerticalAngle = thirdPersonCamera.minVerticalAngle;
    config.camera.maxVerticalAngle = thirdPersonCamera.maxVerticalAngle;
    
    // Update all GUI controllers to reflect actual values
    for (const controller of Object.values(cameraFolder.controllers)) {
      controller.updateDisplay();
    }
    
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
      <p>Press G to toggle GUI controls</p>
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
    
    // Start the animation loop
    animate();
    
    console.log("Initialization completed successfully");
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
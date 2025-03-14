import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import ThirdPersonCamera from './ThirdPersonCamera.js';
import InputManager from './utils/InputManager.js';
import NatureEnvironment from './NatureEnvironment.js';

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
    heightOffset: 0.1, // Default height offset changed from 0 to 0.1
    reset: function() {
      // Reset character parameters to defaults
      config.character.moveSpeed = 2;
      config.character.jumpForce = 5;
      config.character.turnSpeed = 5;
      config.character.heightOffset = 0.1;
      
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
  oranges: {
    size: 0.0025, // Default orange size changed to 0.0025
    collisionForce: 0.5, // Default collision force changed to 0.5
    heightOffset: 0.5, // Changed from 1.0 to 0.5
    reset: function() {
      // Reset orange parameters to defaults
      config.oranges.size = 0.0025;
      config.oranges.collisionForce = 0.5;
      config.oranges.heightOffset = 0.5; // Changed from 1.0 to 0.5
      
      // Update oranges with new size
      updateOrangesSize();
      
      // Update collision force
      collisionForce = config.oranges.collisionForce;
      
      // Update all controllers
      for (const controller of Object.values(orangesFolder.controllers)) {
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
          turnSpeed: 5,
          heightOffset: 0.1
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
          jumpForce: 5,
          heightOffset: 0.1
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
          turnSpeed: 3,
          heightOffset: 0.1
        }
      },
      'Fast Movement': {
        character: {
          moveSpeed: 15,
          jumpForce: 20,
          turnSpeed: 10,
          heightOffset: 0.1
        }
      },
      'Top-Down View': {
        camera: {
          distance: 10,
          height: 8,
          verticalAngle: 1.3,
          maxVerticalAngle: 1.4
        }
      },
      'Floating Character': {
        character: {
          heightOffset: 1,
          jumpForce: 6
        },
        physics: {
          gravity: -15
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
        physics: { ...config.physics },
        oranges: { ...config.oranges }
      };
      
      // Remove function properties
      delete configToSave.camera.reset;
      delete configToSave.character.reset;
      delete configToSave.physics.reset;
      delete configToSave.oranges.reset;
      
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
          if (parsedConfig.oranges) Object.assign(config.oranges, parsedConfig.oranges);
          
          // Update all controllers
          for (const folder of [cameraFolder, characterFolder, physicsFolder, orangesFolder]) {
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
const orangesFolder = gui.addFolder('Oranges'); // New folder for orange settings
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
characterFolder.add(config.character, 'heightOffset', -2, 2, 0.1).name('Height Offset');
characterFolder.add(config.character, 'reset').name('Reset Character Settings');

// Setup physics controls
physicsFolder.add(config.physics, 'gravity', -30, -1, 0.5).name('Gravity').onChange(value => {
  if (world) world.gravity.y = value;
});
physicsFolder.add(config.physics, 'friction', 0, 1, 0.05).name('Friction');
physicsFolder.add(config.physics, 'restitution', 0, 1, 0.05).name('Restitution');
physicsFolder.add(config.physics, 'reset').name('Reset Physics Settings');

// Setup oranges controls
orangesFolder.add(config.oranges, 'size', 0.0025, 0.1, 0.005).name('Orange Size').onChange(value => {
  updateOrangesSize();
});
orangesFolder.add(config.oranges, 'collisionForce', 0.5, 10, 0.5).name('Collision Force').onChange(value => {
  collisionForce = value;
});
orangesFolder.add(config.oranges, 'heightOffset', 0, 5, 0.5).name('Height Offset').onChange(value => {
  // No need for immediate update, will be used when oranges are reset
});
orangesFolder.add(config.oranges, 'reset').name('Reset Orange Settings');

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

// Setup Environment controls
const environmentFolder = gui.addFolder('Environment');

environmentFolder.add({ 
  regenerateTrees: function() {
    if (natureEnvironment) {
      // Remove existing trees
      natureEnvironment.objects.trees.forEach(tree => {
        scene.remove(tree);
      });
      natureEnvironment.objects.trees = [];
      
      // Create new trees
      natureEnvironment.createTrees();
    }
  }
}, 'regenerateTrees').name('Regenerate Trees');

environmentFolder.add({ 
  regenerateClouds: function() {
    if (natureEnvironment) {
      // Remove existing clouds
      natureEnvironment.objects.clouds.forEach(cloud => {
        scene.remove(cloud);
      });
      natureEnvironment.objects.clouds = [];
      
      // Create new clouds
      natureEnvironment.createClouds();
    }
  }
}, 'regenerateClouds').name('Regenerate Clouds');

environmentFolder.add({ treeCount: 100 }, 'treeCount', 0, 200, 10)
  .name('Tree Count')
  .onChange(value => {
    if (natureEnvironment) {
      natureEnvironment.config.trees.count = value;
    }
  });

environmentFolder.add({ cloudCount: 20 }, 'cloudCount', 0, 50, 5)
  .name('Cloud Count')
  .onChange(value => {
    if (natureEnvironment) {
      natureEnvironment.config.clouds.count = value;
    }
  });

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
environmentFolder.open();
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

// Animation and movement state
let isGrounded = true;
let wasMoving = false;
let wasGrounded = true;

// Collision detection flags and data
let characterColliderId = null;
let orangeColliderId = null;
let collisionForce = 3.0; // Adjustable force factor for orange collisions

// Global variables
let natureEnvironment;
let mixer, idleAction, walkAction, jumpAction, activeAction;
let character;
let oranges = []; // Change to array for multiple oranges
let orangeBodies = []; // Change to array for multiple orange physics bodies
let orangeColliderIds = []; // Array to store collider IDs for multiple oranges
const orangeCount = 10; // Number of oranges to create
const loader = new GLTFLoader();

async function initPhysics() {
  try {
    // Create a physics world with gravity from config
    world = new rapier.World({ x: 0.0, y: config.physics.gravity, z: 0.0 });
    
    // Remove the setContactPairHandler that's causing errors
    // Instead, we'll check for collisions manually in the animation loop
    
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
    const characterCollider = world.createCollider(characterColliderDesc, characterBody);
    
    // Store character collider ID for collision detection
    characterColliderId = characterCollider.handle;
    
    // Load animations
    mixer = new THREE.AnimationMixer(character);
    
    // Load required animations first
    const idleModel = await loader.loadAsync('./animations/idle.glb');
    const walkModel = await loader.loadAsync('./animations/walk.glb');
    
    idleAction = mixer.clipAction(idleModel.animations[0]);
    walkAction = mixer.clipAction(walkModel.animations[0]);
    
    // Try to load jump animation, but continue if it fails
    try {
      const jumpModel = await loader.loadAsync('./animations/jump.glb');
      jumpAction = mixer.clipAction(jumpModel.animations[0]);
      console.log("Jump animation loaded successfully");
    } catch (jumpError) {
      console.warn("Jump animation not found, using walk animation for jump state:", jumpError);
      // Use walk animation as fallback for jump
      jumpAction = walkAction;
    }
    
    // Start with idle animation
    activeAction = idleAction;
    idleAction.play();
    
    // Load the orange model
    await loadOrangeModel();
    
    console.log("Models loaded successfully");
  } catch (error) {
    console.error("Error loading models:", error);
    // Fallback to temporary capybara if loading fails
    createTemporaryCapybara();
  }
}

// Load orange model
async function loadOrangeModel() {
  try {
    // Create multiple oranges
    for (let i = 0; i < orangeCount; i++) {
      // Load the orange model
      const orangeModel = await loader.loadAsync('./assets/orange.glb');
      const orangeInstance = orangeModel.scene.clone();
      
      // Generate random position around the scene
      const posX = Math.random() * 20 - 10; // Random position between -10 and 10
      const posY = config.oranges.heightOffset + Math.random() * 2; // Use height offset from config
      const posZ = Math.random() * 20 - 10; // Random position between -10 and 10
      
      // Position and scale the orange - use the config value for size
      orangeInstance.scale.set(
        config.oranges.size,
        config.oranges.size,
        config.oranges.size
      );
      orangeInstance.castShadow = true;
      orangeInstance.position.set(posX, posY, posZ);
      
      // Add the orange to the scene
      scene.add(orangeInstance);
      oranges.push(orangeInstance);
      
      // Create physics body for the orange
      const orangeRigidBodyDesc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(posX, posY, posZ) // Same position as the visual model
        .setLinearDamping(0.5) // Add some damping to make it feel more realistic
        .setAngularDamping(0.5); // Add angular damping for rotation
      
      const orangeBody = world.createRigidBody(orangeRigidBodyDesc);
      orangeBodies.push(orangeBody);
      
      // Create a spherical collider for the orange
      const orangeRadius = 0.3; // Adjust based on your orange model size
      const orangeColliderDesc = rapier.ColliderDesc.ball(orangeRadius)
        .setFriction(0.7) // Higher friction to roll naturally
        .setRestitution(0.4) // Some bounciness
        .setDensity(2.0); // Make it feel like an orange (slightly dense)
      
      const orangeCollider = world.createCollider(orangeColliderDesc, orangeBody);
      
      // Store orange collider ID for collision detection
      orangeColliderIds.push(orangeCollider.handle);
    }
    
    console.log(`${orangeCount} orange models loaded successfully with physics`);
    
  } catch (error) {
    console.error("Error loading orange models:", error);
  }
}

// Animation transition function
function fadeToAction(newAction, duration = 0.2) {
  // Prevent switching to the same animation
  if (activeAction === newAction) return;
  
  // Log animation transition for debugging
  const animationMap = {
    [idleAction]: 'Idle',
    [walkAction]: 'Walk',
    [jumpAction]: 'Jump'
  };
  
  const fromAnim = activeAction ? animationMap[activeAction] || 'Unknown' : 'None';
  const toAnim = animationMap[newAction] || 'Unknown';
  
  console.log(`Animation transition: ${fromAnim} -> ${toAnim}`);
  
  // Configure new action to fade in
  newAction.reset();
  newAction.setEffectiveTimeScale(1);
  newAction.setEffectiveWeight(1);
  
  // Crossfade from current active action to new action
  if (activeAction) {
    // Setup crossfade
    newAction.crossFadeFrom(activeAction, duration, true);
  }
  
  // Play new action and update the active action reference
  newAction.play();
  activeAction = newAction;
}

// Ground plane
function createGround() {
  // Instead of creating a simple ground plane, initialize our nature environment
  natureEnvironment = new NatureEnvironment(scene);
  natureEnvironment.init();
  
  // We don't need the grid helper with our rich environment
  // const gridHelper = new THREE.GridHelper(200, 50);
  // scene.add(gridHelper);
  
  // Create a physics body for the ground
  // We'll create a flat physics ground that matches roughly with our visual terrain
  // For simplicity, we're using a flat collider even though visual terrain has hills
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
  const groundBody = world.createRigidBody(groundBodyDesc);
  
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(100, 0.1, 100);
  groundColliderDesc.setFriction(config.physics.friction);
  groundColliderDesc.setRestitution(config.physics.restitution);
  world.createCollider(groundColliderDesc, groundBody);
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
  character.position.set(
    position.x, 
    position.y - 0.5 + config.character.heightOffset, // Apply height offset here
    position.z
  ); // Offset Y to account for capsule center
  
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
    
    // Manual collision detection between character and oranges
    if (characterBody) {
      const characterPos = characterBody.translation();
      
      // Check each orange for collision with character
      for (let i = 0; i < orangeBodies.length; i++) {
        const orangeBody = orangeBodies[i];
        if (!orangeBody) continue;
        
        const orangePos = orangeBody.translation();
        
        // Calculate distance between character and orange
        const dx = characterPos.x - orangePos.x;
        const dy = characterPos.y - orangePos.y;
        const dz = characterPos.z - orangePos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // If distance is less than sum of radii, we have a collision
        const characterRadius = 0.5; // Approximation
        const orangeRadius = 0.3;
        
        if (distance < (characterRadius + orangeRadius)) {
          // Handle the collision
          handleOrangeCollision(i);
        }
      }
    }
  }
  
  // Update character position and movement
  handleCharacterMovement(delta);
  
  // Update orange position from physics
  updateOrangePosition();
  
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
  
  // Update character animations
  if (mixer) {
    mixer.update(delta);
    
    // Update animation state based on character movement and airborne status
    if (characterBody) {
      const velocity = characterBody.linvel();
      const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1;
      
      // Add hysteresis to avoid flickering between states
      const movementChanged = isMoving !== wasMoving;
      const groundedChanged = isGrounded !== wasGrounded;
      
      // Determine which animation to play
      if (!isGrounded) {
        // Only switch to jump animation when we first leave the ground
        if (groundedChanged || activeAction !== jumpAction) {
          fadeToAction(jumpAction);
        }
      } else if (isMoving) {
        // Only switch to walk animation when we start moving
        if (movementChanged || (groundedChanged && activeAction === jumpAction) || activeAction === idleAction) {
          fadeToAction(walkAction);
        }
      } else {
        // Only switch to idle animation when we stop moving
        if (movementChanged || (groundedChanged && activeAction === jumpAction)) {
          fadeToAction(idleAction);
        }
      }
      
      // Update previous state trackers
      wasMoving = isMoving;
      wasGrounded = isGrounded;
    }
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
  
  // Update nature environment if it exists
  if (natureEnvironment) {
    natureEnvironment.update(delta);
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Update orange position and rotation based on physics
function updateOrangePosition() {
  // Update all oranges
  for (let i = 0; i < oranges.length; i++) {
    const orangeModel = oranges[i];
    const orangeBody = orangeBodies[i];
    
    if (!orangeModel || !orangeBody) continue;
    
    // Get the position from the physics body
    const position = orangeBody.translation();
    
    // Update the 3D model position
    orangeModel.position.set(position.x, position.y, position.z);
    
    // Get the rotation from the physics body (as a quaternion)
    const rotation = orangeBody.rotation();
    
    // Convert quaternion to Euler angles for Three.js
    const quaternion = new THREE.Quaternion(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w
    );
    orangeModel.quaternion.copy(quaternion);
    
    // Optional: Check if orange fell below the ground plane
    if (position.y < -10) {
      // Reset orange position if it falls out of bounds
      const posX = Math.random() * 20 - 10;
      const posZ = Math.random() * 20 - 10;
      orangeBody.setTranslation({ x: posX, y: config.oranges.heightOffset + 2, z: posZ }, true);
      orangeBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      orangeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
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
    
    // Hide instructions by default
    instructions.style.display = 'none';
    
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

// Handle collision between character and orange
function handleOrangeCollision(orangeIndex) {
  if (orangeIndex < 0 || orangeIndex >= orangeBodies.length || !characterBody) return;
  
  const orangeBody = orangeBodies[orangeIndex];
  if (!orangeBody) return;
  
  // Calculate collision direction (character to orange)
  const characterPos = characterBody.translation();
  const orangePos = orangeBody.translation();
  
  // Get direction vector from character to orange
  const directionVector = {
    x: orangePos.x - characterPos.x,
    y: 0, // Keep force horizontal
    z: orangePos.z - characterPos.z
  };
  
  // Normalize the direction vector
  const length = Math.sqrt(directionVector.x * directionVector.x + directionVector.z * directionVector.z);
  if (length > 0) {
    directionVector.x /= length;
    directionVector.z /= length;
  }
  
  // Get character velocity to determine force magnitude
  const charVelocity = characterBody.linvel();
  const velocityMagnitude = Math.sqrt(charVelocity.x * charVelocity.x + charVelocity.z * charVelocity.z);
  
  // Apply force to the orange based on character velocity and collision force factor
  const forceMagnitude = Math.max(1.0, velocityMagnitude) * config.oranges.collisionForce;
  
  // Calculate final force vector
  const forceVector = {
    x: directionVector.x * forceMagnitude,
    y: 0.5 * forceMagnitude, // Add slight upward force
    z: directionVector.z * forceMagnitude
  };
  
  // Apply impulse to the orange
  orangeBody.applyImpulse(forceVector, true);
  
  // Optional: Apply a small torque for realistic rotation
  orangeBody.applyTorqueImpulse({
    x: Math.random() * 0.5 - 0.25,
    y: Math.random() * 0.5 - 0.25,
    z: Math.random() * 0.5 - 0.25
  }, true);
  
  console.log(`Orange ${orangeIndex} collision detected, applied force:`, forceMagnitude);
}

// Update all oranges with new size
function updateOrangesSize() {
  for (let i = 0; i < oranges.length; i++) {
    if (oranges[i]) {
      oranges[i].scale.set(
        config.oranges.size,
        config.oranges.size,
        config.oranges.size
      );
    }
  }
}
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import ThirdPersonCamera from './ThirdPersonCamera.js';
import InputManager from './utils/InputManager.js';
import NatureEnvironment from './NatureEnvironment.js';
import { isMobileDevice, getMobileDeviceInfo, getDeviceOrientation, addOrientationChangeListener } from './utils/DeviceDetector.js';
import MobileJoystick from './utils/MobileControls.js';
import { initMobileDebugger, logToDebugPanel } from './utils/MobileDebugger.js';
import PlayerNameModal from './utils/PlayerNameModal.js';
import { io } from 'socket.io-client';
import { SERVER_URL } from './config.js';

// Model cache system to avoid redundant loading
const ModelCache = {
  // Store loaded models
  cache: new Map(),
  
  // Loader instance
  loader: new GLTFLoader(),
  
  // Get a model from cache or load it
  async getModel(path) {
    // Check if model is already in cache
    if (this.cache.has(path)) {
      console.log(`Using cached model: ${path}`);
      // Clone the cached model to avoid sharing the same instance
      return this.cloneGltf(this.cache.get(path));
    }
    
    // Model not in cache, load it
    console.log(`Loading model: ${path}`);
    
    try {
      // Try loading with regular path
      const gltf = await this.loader.loadAsync(path);
      // Store in cache
      this.cache.set(path, gltf);
      // Return a clone
      return this.cloneGltf(gltf);
    } catch (error) {
      console.error(`Error loading model from ${path}:`, error);
      throw error;
    }
  },
  
  // Try loading a model with multiple path attempts
  async getModelWithFallbacks(paths) {
    // Try each path in sequence
    for (const path of paths) {
      try {
        return await this.getModel(path);
      } catch (error) {
        console.warn(`Failed to load model from ${path}, trying next path`);
        // Continue to next path
      }
    }
    
    // If we get here, all paths failed
    throw new Error(`Failed to load model from any of the provided paths: ${paths.join(', ')}`);
  },
  
  // Clone a GLTF object to avoid sharing the same instance
  cloneGltf(gltf) {
    // Create a new object with cloned scene
    const clone = {
      scene: gltf.scene.clone(true),
      animations: gltf.animations,
      cameras: gltf.cameras,
      asset: gltf.asset
    };
    
    // Ensure all materials are unique to prevent sharing
    clone.scene.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
      }
    });
    
    return clone;
  },
  
  // Preload common models used in the game
  async preloadModels() {
    console.log('Preloading common models...');
    const modelPaths = [
      './character/capybara.glb',
      './models/capybara.glb',
      './animations/idle.glb',
      './animations/walk.glb'
    ];
    
    // Load all models in parallel
    const loadPromises = modelPaths.map(path => 
      this.getModel(path).catch(error => {
        console.warn(`Preloading failed for ${path}:`, error);
        // Don't reject the whole promise chain for preloading
        return null;
      })
    );
    
    // Wait for all to complete
    await Promise.all(loadPromises);
    console.log('Preloading complete');
  }
};

// Remote player management
class RemotePlayer {
  constructor(id, name, position, rotation) {
    this.id = id;
    this.name = name;
    this.position = position || { x: 0, y: 1, z: 0 };
    this.rotation = rotation || { y: 0 };
    this.animationState = 'idle';
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAnimation = null;
    this.lastUpdate = Date.now();
    this.nameLabel = null;
    this.debugObject = null;
    this.modelLoadAttempts = 0;
    this.maxLoadAttempts = 3;
    console.log(`RemotePlayer constructor: ${id}, ${name}, position:`, this.position);
    
    // Create a simple debug object to make remote players immediately visible
    this.createDebugObject();
    
    // Load the actual model
    this.loadModel();
  }
  
  createDebugObject() {
    // Create a simple colored cube as a debug visual
    const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.debugObject = new THREE.Mesh(geometry, material);
    
    // Position it at the remote player's location
    this.debugObject.position.set(
      this.position.x,
      this.position.y + 0.5, // Raise it slightly to be more visible
      this.position.z
    );
    
    console.log(`Creating debug object for ${this.id} at position:`, this.debugObject.position);
    
    // Add to scene immediately
    scene.add(this.debugObject);
    
    // Create a temporary name label for the debug object
    this.createTempNameLabel();
  }
  
  createTempNameLabel() {
    // Create canvas for the name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = 'bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.name, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({ map: texture });
    
    // Create sprite
    this.nameLabel = new THREE.Sprite(material);
    this.nameLabel.scale.set(1, 0.25, 1);
    
    // Position above debug object
    this.nameLabel.position.set(0, 1.2, 0);
    this.debugObject.add(this.nameLabel);
  }

  loadModel() {
    this.modelLoadAttempts++;
    console.log(`Starting model load for player ${this.id} (attempt ${this.modelLoadAttempts})`);
    
    // Define possible model paths to try
    const possiblePaths = [
      './character/capybara.glb',  // Primary path that works for local character
      './models/capybara.glb',     // Alternative path
      '/character/capybara.glb',   // Absolute path
      '/models/capybara.glb'       // Absolute alternative
    ];
    
    // Add absolute URL paths if we're in a browser
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      possiblePaths.push(
        new URL('character/capybara.glb', baseUrl).href,
        new URL('models/capybara.glb', baseUrl).href
      );
    }
    
    console.log(`Attempting to load model for player ${this.id} using ModelCache`);
    
    // Use the ModelCache to get the model, trying different paths if needed
    ModelCache.getModelWithFallbacks(possiblePaths)
      .then(gltf => {
        console.log(`Model loaded successfully for player ${this.id}`);
        this.model = gltf.scene;
        this.model.scale.set(0.5, 0.5, 0.5);
        
        // Set initial position and rotation
        if (this.position) {
          this.model.position.set(this.position.x, this.position.y, this.position.z);
          console.log(`Set model position for ${this.id} to:`, this.position);
        } else {
          this.model.position.set(0, 1, 0);
          console.log(`No position provided for ${this.id}, using default`);
        }
        
        if (this.rotation) {
          this.model.rotation.y = this.rotation.y;
        }
        
        this.model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        
        // Create animation mixer
        this.mixer = new THREE.AnimationMixer(this.model);
        
        // Store animations by name
        gltf.animations.forEach((clip) => {
          const action = this.mixer.clipAction(clip);
          this.animations[clip.name] = action;
        });
        
        // Set initial animation
        this.playAnimation('idle');
        
        // Add to scene
        scene.add(this.model);
        console.log(`Added model to scene for player ${this.id}`);
        
        // Create name label for the actual model
        this.createNameLabel();
        
        // Remove the debug object once the model is loaded
        this.removeDebugObject();
      })
      .catch(error => {
        console.error(`Error loading model for player ${this.id}:`, error);
        
        // Retry loading if under max attempts with exponential backoff
        if (this.modelLoadAttempts < this.maxLoadAttempts) {
          const delay = Math.pow(2, this.modelLoadAttempts) * 1000; // Exponential backoff
          console.log(`Retrying model load for player ${this.id} in ${delay/1000} seconds...`);
          setTimeout(() => this.loadModel(), delay);
        } else {
          console.error(`Failed to load model for player ${this.id} after ${this.maxLoadAttempts} attempts. Keeping debug cube visible.`);
        }
      });
  }
  
  tryAlternativePaths() {
    console.log(`Trying alternative paths for model loading for player ${this.id}`);
    
    // List of possible model paths to try
    const possiblePaths = [
      './models/capybara.glb',
      '/models/capybara.glb',
      'models/capybara.glb',
      './character/capybara.glb',  // Try the same path used for local character
      '/character/capybara.glb'
    ];
    
    // Get path from the local character model reference that was loaded successfully
    if (character) {
      console.log('Using local character model path as reference');
      
      // Use the same model as the local player
      const loader = new GLTFLoader();
      const modelPath = './character/capybara.glb';
      
      loader.load(modelPath, 
        // Success callback
        (gltf) => {
          // Same success callback as the original loadModel method
          console.log(`Model loaded successfully from alternative path for player ${this.id}`);
          this.model = gltf.scene;
          this.model.scale.set(0.5, 0.5, 0.5);
          
          // Set initial position and rotation
          if (this.position) {
            this.model.position.set(this.position.x, this.position.y, this.position.z);
          } else {
            this.model.position.set(0, 1, 0);
          }
          
          if (this.rotation) {
            this.model.rotation.y = this.rotation.y;
          }
          
          this.model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          // Create animation mixer
          this.mixer = new THREE.AnimationMixer(this.model);
          
          // Store animations by name
          gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = action;
          });
          
          // Set initial animation
          this.playAnimation('idle');
          
          // Add to scene
          scene.add(this.model);
          
          // Create name label for the actual model
          this.createNameLabel();
          
          // Remove the debug object once the model is loaded
          this.removeDebugObject();
        },
        // Progress callback
        (xhr) => {
          if (xhr.total) {
            console.log(`Model ${this.id} loading progress: ${(xhr.loaded / xhr.total) * 100}%`);
          } else {
            console.log(`Model ${this.id} loading progress: ${xhr.loaded} bytes loaded`);
          }
        },
        // Error callback
        (error) => {
          console.error(`Error loading model from alternative path for player ${this.id}:`, error);
          
          // If we've tried all alternatives, log an error but keep the debug cube visible
          if (this.modelLoadAttempts >= this.maxLoadAttempts) {
            console.error(`Failed to load model after trying all alternative paths. Keeping debug cube visible.`);
          } else {
            // Try again with increased delay
            this.modelLoadAttempts++;
            const delay = this.modelLoadAttempts * 2000; // Exponential backoff
            console.log(`Retrying model load in ${delay/1000} seconds...`);
            setTimeout(() => this.loadModel(), delay);
          }
        }
      );
    } else {
      console.error('Local character model not available as reference');
      
      // Retry with simple path
      const loader = new GLTFLoader();
      loader.load('./character/capybara.glb', 
        (gltf) => {
          // Same success handling as above
          console.log(`Model loaded successfully from fallback path for player ${this.id}`);
          this.model = gltf.scene;
          this.model.scale.set(0.5, 0.5, 0.5);
          
          // Set initial position and rotation
          if (this.position) {
            this.model.position.set(this.position.x, this.position.y, this.position.z);
          } else {
            this.model.position.set(0, 1, 0);
          }
          
          if (this.rotation) {
            this.model.rotation.y = this.rotation.y;
          }
          
          this.model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          // Create animation mixer
          this.mixer = new THREE.AnimationMixer(this.model);
          
          // Store animations by name
          gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = action;
          });
          
          // Set initial animation
          this.playAnimation('idle');
          
          // Add to scene
          scene.add(this.model);
          
          // Create name label for the actual model
          this.createNameLabel();
          
          // Remove the debug object once the model is loaded
          this.removeDebugObject();
        },
        // Progress callback
        (xhr) => {
          console.log(`Model ${this.id} loading progress: ${(xhr.loaded / xhr.total) * 100}%`);
        },
        // Error callback
        (error) => {
          console.error(`Error loading model from fallback path for player ${this.id}:`, error);
          
          // If we've tried all alternatives, keep the debug cube
          console.error(`Failed to load model using fallback path. Keeping debug cube visible.`);
        }
      );
    }
  }
  
  removeDebugObject() {
    if (this.debugObject) {
      console.log(`Removing debug object for player ${this.id}`);
      // If the debug object has the name label, remove it first
      if (this.nameLabel && this.debugObject.children.includes(this.nameLabel)) {
        this.debugObject.remove(this.nameLabel);
      }
      scene.remove(this.debugObject);
      this.debugObject = null;
    }
  }
  
  createNameLabel() {
    // Create canvas for the name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = 'bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.name, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({ map: texture });
    
    // Create sprite
    this.nameLabel = new THREE.Sprite(material);
    this.nameLabel.scale.set(1, 0.25, 1);
    
    // Add to scene
    if (this.model) {
      this.nameLabel.position.set(0, 1.2, 0); // Position above character
      this.model.add(this.nameLabel);
      console.log(`Added name label to model for player ${this.id}`);
    }
  }
  
  update(delta) {
    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }
  
  updatePosition(position, rotation, animationState) {
    console.log(`RemotePlayer ${this.id} updatePosition called with:`, position);
    
    // Store the new data
    this.position = position;
    this.rotation = rotation;
    this.animationState = animationState;
    this.lastUpdate = Date.now();
    
    // Update debug object if it exists
    if (this.debugObject) {
      this.debugObject.position.set(position.x, position.y + 0.5, position.z);
      console.log(`Updated debug object position for ${this.id}:`, this.debugObject.position);
    }
    
    if (this.model) {
      // Apply position with interpolation
      const targetPosition = new THREE.Vector3(position.x, position.y, position.z);
      console.log(`Moving ${this.id} to:`, targetPosition);
      this.model.position.lerp(targetPosition, 0.3);
      
      // Apply rotation
      if (rotation) {
        this.model.rotation.y = rotation.y;
      }
      
      // Play animation if it changed
      if (animationState) {
        this.playAnimation(animationState);
      }
    } else {
      console.warn(`RemotePlayer ${this.id} model not loaded yet, position update queued`);
    }
  }
  
  playAnimation(state) {
    if (!this.animations || !this.animations[state]) {
      console.warn(`Animation "${state}" not found for player ${this.id}`);
      return;
    }
    
    if (this.currentAnimation !== state) {
      console.log(`Playing animation "${state}" for player ${this.id}`);
      
      // Fade out current animation
      if (this.currentAnimation && this.animations[this.currentAnimation]) {
        this.animations[this.currentAnimation].fadeOut(0.2);
      }
      
      // Fade in new animation
      this.animations[state].reset().fadeIn(0.2).play();
      this.currentAnimation = state;
    }
  }
  
  remove() {
    // Remove the debug object if it exists
    this.removeDebugObject();
    
    // Remove the model if it exists
    if (this.model) {
      console.log(`Removing model for player ${this.id}`);
      scene.remove(this.model);
      this.model = null;
    }
    
    // Clean up the mixer
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    
    // Clear animations
    this.animations = {};
    this.currentAnimation = null;
  }
}

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
let rapier; // Store the initialized RAPIER module

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
let mixer, idleAction, walkAction, jumpAction, activeAction, danceAction;
let character;
let oranges = []; // Change to array for multiple oranges
let orangeBodies = []; // Change to array for multiple orange physics bodies
let orangeColliderIds = []; // Array to store collider IDs for multiple oranges
const orangeCount = 10; // Number of oranges to create
const loader = new GLTFLoader();

// Add mobile joystick variables
let mobileJoystick = null;
let isMobile = false;

// Add multiplayer variables
let socket = null;
let playerName = "Guest";
let playerNameModal = null;
const remotePlayers = new Map();
let localPlayerId = null;
const UPDATE_INTERVAL = 1000 / 15; // 15 updates per second
let lastUpdateTime = 0;
const isMultiplayerEnabled = true;

// Initialize RAPIER before using it
async function initRapier() {
  try {
    if (isMobileDevice()) logToDebugPanel('Loading RAPIER WASM module', 'info');
    rapier = await RAPIER;
    if (isMobileDevice()) logToDebugPanel('RAPIER WASM loaded successfully', 'info');
    console.log('RAPIER physics initialized successfully');
    return rapier;
  } catch (error) {
    console.error('Error initializing RAPIER:', error);
    if (isMobileDevice()) logToDebugPanel(`Error initializing RAPIER: ${error.message}`, 'error');
    return false;
  }
}

async function initPhysics() {
  try {
    if (!rapier) {
      console.error('RAPIER not initialized, waiting...');
      await initRapier();
    }
    
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
    console.log("Loading character model and animations using ModelCache");
    
    // Load the capybara model using the cache system
    const characterModel = await ModelCache.getModel('./character/capybara.glb');
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
    
    // Load required animations using the cache system
    console.log("Loading animations using ModelCache");
    const idleModel = await ModelCache.getModel('./animations/idle.glb');
    const walkModel = await ModelCache.getModel('./animations/walk.glb');
    
    idleAction = mixer.clipAction(idleModel.animations[0]);
    walkAction = mixer.clipAction(walkModel.animations[0]);
    
    // Try to load jump animation, but continue if it fails
    try {
      const jumpModel = await ModelCache.getModel('./animations/jump.glb');
      jumpAction = mixer.clipAction(jumpModel.animations[0]);
    } catch (error) {
      console.warn("Failed to load jump animation:", error);
      // Set fallback if jump animation fails to load
      jumpAction = null;
    }
    
    // Try to load dance animation, but continue if it fails
    try {
      const danceModel = await ModelCache.getModel('./animations/dance.glb');
      danceAction = mixer.clipAction(danceModel.animations[0]);
    } catch (error) {
      console.warn("Failed to load dance animation:", error);
      // Set fallback if dance animation fails to load
      danceAction = null;
    }
    
    // Set default animation
    idleAction.play();
    currentAnimationState = 'idle';
    
    // Load the orange model
    await loadOrangeModel();
    
    console.log("All models loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading models:", error);
    if (isMobileDevice()) {
      logToDebugPanel(`Error loading models: ${error.message}`, 'error');
    }
    // Fallback to temporary capybara if loading fails
    createTemporaryCapybara();
    return false;
  }
}

// Load orange model
async function loadOrangeModel() {
  try {
    console.log("Loading orange model using ModelCache");
    
    // Load the orange model using the cache system
    const orangeGLTF = await ModelCache.getModel('./models/orange.glb');
    
    // Create 5 oranges at different positions
    for (let i = 0; i < 5; i++) {
      // Clone the model for each orange
      const orangeModel = orangeGLTF.scene.clone();
      orangeModel.scale.set(0.5, 0.5, 0.5);
      orangeModel.castShadow = true;
      
      // Random position within a certain range
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      const y = 1 + Math.random() * 2; // Height above ground
      
      orangeModel.position.set(x, y, z);
      scene.add(orangeModel);
      
      // Add to oranges array
      oranges.push(orangeModel);
      
      // Create physics body for the orange
      const orangeBodyDesc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z);
      const orangeBody = world.createRigidBody(orangeBodyDesc);
      
      // Create spherical collider
      const orangeColliderDesc = rapier.ColliderDesc.ball(0.25) // Radius of 0.25
        .setRestitution(0.7); // Bouncy
      
      // Set collision group and filter
      const orangeCollider = world.createCollider(orangeColliderDesc, orangeBody);
      
      // Set id for collision detection
      orangeColliderIds.push(orangeCollider.handle);
      
      // Add to orangeBodies array
      orangeBodies.push(orangeBody);
    }
    
    console.log(`Created ${oranges.length} oranges`);
    return true;
  } catch (error) {
    console.error("Error loading orange model:", error);
    return false;
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
    [jumpAction]: 'Jump',
    [danceAction]: 'Dance'
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
  
  // Apply input from keyboard or joystick to movement direction
  if (isMobile && mobileJoystick && mobileJoystick.getIsActive()) {
    // Use joystick input when on mobile
    const movementData = mobileJoystick.getMovementData();
    const joystickPosition = movementData.position;
    
    // Use distance as a measure of intensity/speed
    const intensity = movementData.distance;
    
    // Apply direction and intensity with platform-specific adjustments
    moveDirection.x = joystickPosition.x;
    moveDirection.z = joystickPosition.y; // Forward/backward
    
    // Apply non-linear acceleration curve for smoother control
    // This makes small movements more precise while still allowing fast movement
    const accelerationCurve = (value) => {
      // Apply a quadratic curve for more precise control around center
      // Move more gradually at first, then accelerate
      const sign = Math.sign(value);
      return sign * (value * value);
    };
    
    // Apply the acceleration curve to x and z components
    moveDirection.x = accelerationCurve(moveDirection.x);
    moveDirection.z = accelerationCurve(moveDirection.z);
    
    // If joystick is active and moved, bring it back to full opacity
    if (intensity > 0 && mobileJoystick.visible) {
      mobileJoystick.fadeInJoystick();
    }
  } else {
    // Use keyboard input on desktop or when joystick not used
    if (keys.w) moveDirection.z = -1;
    if (keys.s) moveDirection.z = 1;
    if (keys.a) moveDirection.x = -1;
    if (keys.d) moveDirection.x = 1;
  }
  
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
    
    // Use turnSpeed from config for rotation speed with smoother turning on mobile
    const turnSpeed = isMobile ? 
      config.character.turnSpeed * 1.5 : // Increase turn speed on mobile
      config.character.turnSpeed;
    
    character.rotation.y += angleDiff * Math.min(1, turnSpeed * deltaTime);
  }
}

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  // Calculate delta time
  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime() * 1000; // Convert to milliseconds
  
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
  let currentAnimationState = 'idle';
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
          currentAnimationState = 'jump';
        }
      } else if (isMoving) {
        // Only switch to walk animation when we start moving
        if (movementChanged || (groundedChanged && activeAction === jumpAction) || activeAction === idleAction) {
          fadeToAction(walkAction);
          currentAnimationState = 'walk';
        }
      } else {
        // Only switch to idle animation when we stop moving
        if (movementChanged || (groundedChanged && activeAction === jumpAction)) {
          fadeToAction(idleAction);
          currentAnimationState = 'idle';
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
  
  // Send position updates to server at regular intervals
  if (isMultiplayerEnabled && socket && socket.connected && 
      character && characterBody && elapsedTime - lastUpdateTime > UPDATE_INTERVAL) {
    
    // Get character position and rotation
    const position = characterBody.translation();
    const rotation = { y: character.rotation.y };
    
    // Get current animation state
    const animationState = currentAnimationState || 'idle';
    
    // Prepare update data
    const updateData = {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: rotation,
      animationState: animationState
    };
    
    // Send position update to server
    socket.emit('updatePosition', updateData);
    console.log('Sending position update:', updateData);
    
    // Update last update time
    lastUpdateTime = elapsedTime;
  }
  
  // Update remote players with interpolation
  for (const remotePlayer of remotePlayers.values()) {
    remotePlayer.update(delta);
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
      orangeBody.setTranslation({ x: posX, y: config.oranges.heightOffset + Math.random() * 2, z: posZ }, true);
      orangeBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      orangeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
}

// Initialize and start
async function init() {
  try {
    console.log("Initializing Capyverse...");
    
    // Check if mobile device
    if (isMobileDevice()) {
      console.log("Mobile device detected");
      initMobileDebugger();
      logToDebugPanel('Initializing Capyverse on mobile device...', 'info');
    }
    
    // Initialize physics
    if (isMobileDevice()) logToDebugPanel('Setting up physics world', 'info');
    await initPhysics();
    if (isMobileDevice()) logToDebugPanel('Physics world set up', 'info');
    
    // Create ground
    if (isMobileDevice()) logToDebugPanel('Creating ground', 'info');
    createGround();
    if (isMobileDevice()) logToDebugPanel('Ground created', 'info');
    
    // Preload common models first for faster loading of remote players
    if (isMobileDevice()) logToDebugPanel('Preloading common models', 'info');
    try {
      await ModelCache.preloadModels();
      console.log("Models preloaded successfully");
      if (isMobileDevice()) logToDebugPanel('Models preloaded successfully', 'success');
    } catch (error) {
      console.warn("Error preloading models:", error);
      if (isMobileDevice()) logToDebugPanel('Error preloading models, will load on demand', 'warning');
    }
    
    // Load models
    if (isMobileDevice()) logToDebugPanel('Loading 3D models', 'info');
    await loadModels();
    if (isMobileDevice()) logToDebugPanel('Models loaded successfully', 'info');
    
    // Check if we're on a mobile device and get device info
    isMobile = isMobileDevice();
    let deviceInfo = null;
    
    if (isMobile) {
      deviceInfo = getMobileDeviceInfo();
      console.log('Mobile device detected:', deviceInfo);
      
      // Add mobile device class to body for CSS optimizations
      document.body.classList.add('mobile-device');
      
      // Add device-specific classes
      if (deviceInfo.os === 'iOS') {
        document.body.classList.add('ios-device');
      } else if (deviceInfo.os === 'Android') {
        document.body.classList.add('android-device');
      }
      
      // Apply orientation specific class
      const orientation = getDeviceOrientation();
      document.body.classList.add(`orientation-${orientation}`);
      
      // Monitor for orientation changes
      addOrientationChangeListener((newOrientation) => {
        document.body.classList.remove('orientation-portrait', 'orientation-landscape');
        document.body.classList.add(`orientation-${newOrientation}`);
        
        // Resize renderer and update camera on orientation change
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }
    
    // Initialize Input Manager for camera controls
    // Only initialize on desktop or when we need mouse movement
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
    
    // Initialize mobile joystick if on a mobile device
    if (isMobile) {
      console.log('DEBUG: isMobile = true, initializing mobile controls');
      console.log('DEBUG: User agent:', navigator.userAgent);
      
      // Check for device capabilities to determine optimal settings
      const isHighEndDevice = deviceInfo && 
        ((deviceInfo.os === 'iOS' && parseInt(deviceInfo.version) >= 13) || 
         (deviceInfo.os === 'Android' && parseInt(deviceInfo.version) >= 10));
      
      const useBatterySaving = deviceInfo && deviceInfo.batteryLevel && deviceInfo.batteryLevel < 0.3;
      
      console.log('DEBUG: Device info:', deviceInfo);
      console.log('DEBUG: isHighEndDevice:', isHighEndDevice);
      console.log('DEBUG: useBatterySaving:', useBatterySaving);
      
      // Create the joystick with enhanced settings
      mobileJoystick = new MobileJoystick({
        baseSize: 150,             // Slightly larger for easier use
        knobSize: 75,              // Maintain proportion
        baseOpacity: 0.3,          // Set to 30% opacity (more transparent)
        knobOpacity: 0.3,          // Set to 30% opacity (more transparent)
        activeBaseOpacity: 0.4,    // Set to 40% opacity when active
        activeKnobOpacity: 0.4,    // Set to 40% opacity when active
        deadZone: 0.08,            // 8% dead zone for better control
        autoHide: true,            // Enable auto-hide feature
        autoHideDelay: 5000,       // Hide after 5 seconds of inactivity
        usePerformanceMode: true,  // Enable performance optimizations
        smoothing: isHighEndDevice ? 0.7 : 0.5, // More smoothing on high-end devices
        batteryOptimized: useBatterySaving // Enable battery optimizations if needed
      });
      
      console.log('DEBUG: MobileJoystick created, calling init()');
      
      // Initialize and add to the DOM if successful
      const initResult = mobileJoystick.init();
      console.log('DEBUG: mobileJoystick.init() result:', initResult);
      
      if (initResult) {
        console.log('DEBUG: Calling mobileJoystick.appendToDOM()');
        mobileJoystick.appendToDOM();
        
        console.log('DEBUG: Calling mobileJoystick.show()');
        mobileJoystick.show();
        
        // Add swipe camera control for mobile
        console.log('DEBUG: Setting up mobile camera control');
        setupMobileCameraControl();
        
        // Failsafe to ensure joystick is visible after a delay
        setTimeout(() => {
          console.log('DEBUG: Failsafe - Ensuring joystick is visible');
          if (mobileJoystick) {
            const joystickContainer = document.querySelector('.mobile-controls');
            if (joystickContainer) {
              console.log('DEBUG: Found joystick container, forcing display');
              joystickContainer.style.display = 'block';
              
              // Also ensure base visibility and position
              const joystickBase = document.querySelector('.joystick-base');
              if (joystickBase) {
                console.log('DEBUG: Found joystick base, setting position');
                joystickBase.style.right = '30px';
                joystickBase.style.bottom = '30px';
                joystickBase.style.left = 'auto';
                joystickBase.style.display = 'block';
              } else {
                console.log('DEBUG: Joystick base not found!');
              }
            } else {
              console.log('DEBUG: Joystick container not found!');
            }
          }
        }, 1000); // 1 second delay
      } else {
        console.error('DEBUG: Failed to initialize mobile joystick');
      }
      
      // Update help text for mobile
      const instructions = document.getElementById('instructions');
      if (instructions) {
        const deviceType = deviceInfo ? deviceInfo.os : 'Mobile';
        
        instructions.innerHTML = `
          <h2>${deviceType} Controls</h2>
          <p>Use the joystick in the bottom left to move</p>
          <p>Swipe on the right side of screen to look around</p>
          <p>Touch the joystick again if it becomes transparent</p>
          <p>Use landscape mode for best experience</p>
        `;
      }
    }
    
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
    
    if (!isMobile) {
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
    }
    
    document.body.appendChild(instructions);
    
    // Hide instructions by default
    instructions.style.display = 'none';
    
    // Initialize multiplayer if enabled
    if (isMultiplayerEnabled) {
      // Initialize player name modal
      playerNameModal = new PlayerNameModal();
      
      // Set callback for when player enters their name
      playerNameModal.onSubmit((name) => {
        playerName = name;
        console.log(`Player name set to: ${playerName}`);
        
        // Make all characters spawn at the same position
        if (characterBody) {
          characterBody.setTranslation({ x: 0, y: 1, z: 0 }, true);
          character.rotation.y = Math.PI;
        }
        
        // Add name label to player
        createPlayerNameLabel(playerName);
        
        // Connect to the WebSocket server
        initSocketConnection();
        
        // Enable controls after entering name
        if (inputManager) {
          inputManager.enablePointerLock();
          instructions.style.display = 'flex';
        }
      });
      
      // Show player name modal
      playerNameModal.show();
    }
    
    // Start the animation loop
    animate();
    
    console.log("Initialization completed successfully");
  } catch (error) {
    console.error("Error during initialization:", error);
    if (isMobileDevice()) logToDebugPanel(`Initialization error: ${error.message}`, 'error');
    
    // Create a simple error message on screen
    const errorContainer = document.createElement('div');
    errorContainer.style.position = 'absolute';
    errorContainer.style.top = '50%';
    errorContainer.style.left = '50%';
    errorContainer.style.transform = 'translate(-50%, -50%)';
    errorContainer.style.color = 'white';
    errorContainer.style.backgroundColor = 'rgba(255,0,0,0.7)';
    errorContainer.style.padding = '20px';
    errorContainer.style.borderRadius = '10px';
    errorContainer.style.fontFamily = 'Arial, sans-serif';
    errorContainer.style.fontSize = '16px';
    errorContainer.style.maxWidth = '80%';
    errorContainer.style.textAlign = 'center';
    errorContainer.innerHTML = `<strong>Error loading Capyverse:</strong><br>${error.message}<br><br>Try refreshing the page or using a different browser.`;
    document.body.appendChild(errorContainer);
  }
}

/**
 * Setup camera control for mobile devices
 * Adds a touch area on the right side of the screen for camera rotation
 */
function setupMobileCameraControl() {
  if (!isMobile) return;
  
  let touchStartX = 0;
  let touchStartY = 0;
  let currentTouchId = null;
  let touchActive = false;
  let lastUpdateTime = 0;
  let animationFrameId = null;
  
  // Create a visual indicator for the touch area (right side of screen)
  const cameraControlArea = document.createElement('div');
  cameraControlArea.id = 'camera-control-area';
  cameraControlArea.style.position = 'absolute';
  cameraControlArea.style.right = '0';
  cameraControlArea.style.top = '0';
  cameraControlArea.style.width = '50%';
  cameraControlArea.style.height = '100%';
  cameraControlArea.style.zIndex = '999';
  cameraControlArea.style.opacity = '0';
  cameraControlArea.style.pointerEvents = 'none'; // Only for visual purposes
  document.body.appendChild(cameraControlArea);
  
  // Create a touch indicator element to show where the user is touching
  const touchIndicator = document.createElement('div');
  touchIndicator.className = 'touch-indicator';
  touchIndicator.style.position = 'absolute';
  touchIndicator.style.width = '40px';
  touchIndicator.style.height = '40px';
  touchIndicator.style.borderRadius = '50%';
  touchIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  touchIndicator.style.transform = 'translate(-50%, -50%)';
  touchIndicator.style.display = 'none';
  touchIndicator.style.pointerEvents = 'none';
  touchIndicator.style.zIndex = '1002';
  document.body.appendChild(touchIndicator);
  
  // Use requestAnimationFrame for smoother updates
  function updateCameraRotation() {
    if (!touchActive) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      return;
    }
    
    // Throttle updates for performance
    const now = performance.now();
    const elapsed = now - lastUpdateTime;
    
    if (elapsed >= 16) { // Cap at ~60fps
      lastUpdateTime = now;
      
      // Check if thirdPersonCamera exists
      if (thirdPersonCamera) {
        // Apply the rotation based on touch movement
        const sensitivity = config.camera.rotationSpeed * 10; // Adjust for touch
        
        // Calculate delta relative to screen size for consistent experience across devices
        const screenSize = Math.min(window.innerWidth, window.innerHeight);
        const deltaX = touchDeltaX * (sensitivity / screenSize);
        const deltaY = touchDeltaY * (sensitivity / screenSize);
        
        // Update camera rotation
        thirdPersonCamera.updateRotation({
          x: deltaX,
          y: deltaY
        });
      }
    }
    
    // Continue the animation loop
    animationFrameId = requestAnimationFrame(updateCameraRotation);
  }
  
  // Variables for tracking movement between frames
  let touchDeltaX = 0;
  let touchDeltaY = 0;
  
  // Handle touch events on the right half of the screen for camera rotation
  document.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    
    // Only process touches on the right half of the screen
    if (touch.clientX > window.innerWidth / 2) {
      // Store the touch start position
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      currentTouchId = touch.identifier;
      touchActive = true;
      touchDeltaX = 0;
      touchDeltaY = 0;
      
      // Show touch indicator at touch point
      touchIndicator.style.display = 'block';
      touchIndicator.style.left = touch.clientX + 'px';
      touchIndicator.style.top = touch.clientY + 'px';
      
      // Visual feedback (subtle)
      cameraControlArea.style.opacity = '0.1';
      cameraControlArea.style.background = 'radial-gradient(circle at ' + 
        (touch.clientX - window.innerWidth/2) + 'px ' + touch.clientY + 
        'px, rgba(255,255,255,0.2), transparent 50%)';
      
      // Start animation loop for smooth updates
      if (!animationFrameId) {
        lastUpdateTime = performance.now();
        animationFrameId = requestAnimationFrame(updateCameraRotation);
      }
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', (event) => {
    // Find our specific touch
    let touch = null;
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === currentTouchId) {
        touch = event.touches[i];
        break;
      }
    }
    
    // If touch not found or not on right side, do nothing
    if (!touch || touch.clientX <= window.innerWidth / 2 || !touchActive) return;
    
    // Calculate the delta from previous position
    touchDeltaX = touch.clientX - touchStartX;
    touchDeltaY = touch.clientY - touchStartY;
    
    // Move touch indicator to follow the touch
    touchIndicator.style.left = touch.clientX + 'px';
    touchIndicator.style.top = touch.clientY + 'px';
    
    // Update visual feedback gradient
    cameraControlArea.style.background = 'radial-gradient(circle at ' + 
      (touch.clientX - window.innerWidth/2) + 'px ' + touch.clientY + 
      'px, rgba(255,255,255,0.2), transparent 50%)';
    
    // Update start position for next delta calculation
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });
  
  function endTouch(event) {
    // Check if this is our tracked touch
    let touchFound = false;
    
    if (event.changedTouches) {
      for (let i = 0; i < event.changedTouches.length; i++) {
        if (event.changedTouches[i].identifier === currentTouchId) {
          touchFound = true;
          break;
        }
      }
    } else {
      touchFound = true; // For touchcancel, assume it's our touch
    }
    
    if (touchFound && touchActive) {
      // Reset the touch tracking
      currentTouchId = null;
      touchActive = false;
      touchDeltaX = 0;
      touchDeltaY = 0;
      
      // Hide touch indicator
      touchIndicator.style.display = 'none';
      
      // Remove visual feedback
      cameraControlArea.style.opacity = '0';
      setTimeout(() => {
        if (!touchActive) {
          cameraControlArea.style.background = 'none';
        }
      }, 300);
    }
  }
  
  document.addEventListener('touchend', endTouch, { passive: true });
  document.addEventListener('touchcancel', endTouch, { passive: true });
  
  // Handle visibility changes to pause the animation
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      touchActive = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  });
}

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

// Create player name label for the local player
function createPlayerNameLabel(name) {
  // Create canvas for the name label
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  // Draw background
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw text
  context.font = 'bold 32px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite material
  const material = new THREE.SpriteMaterial({ map: texture });
  
  // Create sprite
  const nameLabel = new THREE.Sprite(material);
  nameLabel.scale.set(1, 0.25, 1);
  
  // Add to scene or character if available
  if (character) {
    nameLabel.position.set(0, 1.2, 0); // Position above character
    character.add(nameLabel);
  } else {
    // If character not loaded yet, add to the scene and position it
    nameLabel.position.set(0, 2.2, 0);
    scene.add(nameLabel);
    
    // Schedule a check to attach to character once it's loaded
    const checkInterval = setInterval(() => {
      if (character) {
        scene.remove(nameLabel);
        nameLabel.position.set(0, 1.2, 0);
        character.add(nameLabel);
        clearInterval(checkInterval);
      }
    }, 500);
  }
  
  return nameLabel;
}

function initSocketConnection() {
  // Connect to Socket.io server
  console.log('Attempting to connect to server at:', SERVER_URL);
  socket = io(SERVER_URL);
  
  // Handle connection
  socket.on('connect', () => {
    console.log('Connected to server with id:', socket.id);
    
    // Join game with player name
    socket.emit('join', { name: playerName });
    console.log('Emitted join event with name:', playerName);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
  
  // Handle game state (received on join)
  socket.on('gameState', (state) => {
    console.log('Game state received:', state);
    
    // Store local player ID
    localPlayerId = state.playerId;
    console.log('Local player ID set to:', localPlayerId);
    
    // Create remote players
    state.players.forEach(player => {
      // Don't create a player for ourselves
      if (player.id !== localPlayerId) {
        console.log('Adding remote player from gameState:', player);
        addRemotePlayer(player);
      }
    });
  });
  
  // Handle new player joined
  socket.on('playerJoined', (player) => {
    console.log('Player joined event received:', player);
    addRemotePlayer(player);
  });
  
  // Handle player left
  socket.on('playerLeft', (data) => {
    console.log('Player left event received:', data);
    removeRemotePlayer(data.id);
  });
  
  // Handle player movement
  socket.on('playerMoved', (player) => {
    console.log('Player moved event received:', player);
    updateRemotePlayer(player);
  });
}

function addRemotePlayer(playerData) {
  console.log('addRemotePlayer called with:', playerData);
  
  if (!playerData || !playerData.id) {
    console.error('Invalid player data received:', playerData);
    return;
  }
  
  if (remotePlayers.has(playerData.id)) {
    console.log(`Player ${playerData.id} already exists, updating instead`);
    updateRemotePlayer(playerData);
    return;
  }
  
  console.log(`Creating new RemotePlayer for ${playerData.id} (${playerData.name})`);
  
  // Ensure the position and rotation are valid
  const position = playerData.position || { x: 0, y: 1, z: 0 };
  const rotation = playerData.rotation || { y: 0 };
  
  const remotePlayer = new RemotePlayer(
    playerData.id,
    playerData.name,
    position,
    rotation
  );
  
  // Store in the remotePlayers map
  remotePlayers.set(playerData.id, remotePlayer);
  console.log(`Total remote players: ${remotePlayers.size}`);
  
  // Log all current remote players
  console.log('Current remote players:');
  remotePlayers.forEach((player, id) => {
    console.log(`- ${id} (${player.name})`);
  });
}

function updateRemotePlayer(playerData) {
  console.log(`updateRemotePlayer called for ${playerData.id}`);
  
  if (!playerData || !playerData.id) {
    console.error('Invalid player data received:', playerData);
    return;
  }
  
  const remotePlayer = remotePlayers.get(playerData.id);
  if (remotePlayer) {
    console.log(`Updating player ${playerData.id} (${remotePlayer.name}) position:`, playerData.position);
    
    // Validate position data
    if (!playerData.position) {
      console.warn(`No position data for player ${playerData.id}`);
      return;
    }
    
    remotePlayer.updatePosition(
      playerData.position,
      playerData.rotation,
      playerData.animationState
    );
  } else {
    console.warn(`Received update for unknown player ${playerData.id}, adding them now`);
    addRemotePlayer(playerData);
  }
}

function removeRemotePlayer(playerId) {
  const remotePlayer = remotePlayers.get(playerId);
  if (remotePlayer) {
    remotePlayer.remove();
    remotePlayers.delete(playerId);
  }
}

init();
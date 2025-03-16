import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';

// Initialize Rapier physics engine
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

// Initialize physics world and components
async function initPhysics() {
  try {
    if (!rapier) {
      console.error('RAPIER not initialized, waiting...');
      await initRapier();
    }
    
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
  
  // Standard paths for capybara model - helps normalize path resolution
  CAPYBARA_MODEL_PATHS: [
    './character/capybara.glb',
    './models/capybara.glb',
    '/character/capybara.glb',
    '/models/capybara.glb',
    'character/capybara.glb',
    'models/capybara.glb'
  ],
  
  // Main capybara model reference - will be set during preload
  capybaraModel: null,
  
  // Tracking load failures for improved diagnostics
  failedPaths: new Set(),
  
  // Track remote players with loading issues for manual reload
  playersWithLoadingIssues: new Map(),
  
  // Reset failed paths tracking
  clearFailedPaths() {
    this.failedPaths.clear();
    console.log('Cleared failed paths tracking');
  },
  
  // Register a player with loading issues
  registerPlayerWithLoadingIssue(playerId, playerName) {
    this.playersWithLoadingIssues.set(playerId, {
      name: playerName,
      timestamp: Date.now()
    });
    console.log(`Registered player ${playerName} (${playerId}) with loading issues`);
  },
  
  // Get a model from the cache or load it
  async getModel(path) {
    // First check if this exact path is in the cache
    if (this.cache.has(path)) {
      console.log(`Model found in cache: ${path}`);
      return this.cache.get(path);
    }
    
    // Check if we've already tried and failed with this path
    if (this.failedPaths.has(path)) {
      throw new Error(`Previously failed to load model at path: ${path}`);
    }
    
    // Load the model
    console.log(`Loading model from path: ${path}`);
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(
          path,
          resolve,
          undefined, // No progress callback
          (error) => {
            console.error(`Error loading model from ${path}:`, error);
            reject(error);
          }
        );
      });
      
      // Success - store in cache and return
      console.log(`Successfully loaded model from ${path}`);
      this.cache.set(path, gltf);
      return gltf;
    } catch (error) {
      // Track this failed path
      this.failedPaths.add(path);
      throw error;
    }
  },
  
  // Preload the capybara model
  async preloadCapybaraModel() {
    console.log('Preloading capybara model...');
    
    // Try all possible paths until one works
    try {
      this.capybaraModel = await this.getModelWithFallbacks(this.CAPYBARA_MODEL_PATHS);
      console.log('Successfully preloaded capybara model');
      return true;
    } catch (error) {
      console.error('Failed to preload capybara model:', error);
      return false;
    }
  },
  
  // Preload common models used in the game
  async preloadModels() {
    console.log('Preloading common models...');
    
    // First try to load the capybara model - this is the most important for multiplayer
    await this.preloadCapybaraModel();
    
    // Preload other models and animations
    const additionalModelPaths = [
      './animations/idle.glb',
      './animations/walk.glb'
    ];
    
    // Load all models in parallel
    const loadPromises = additionalModelPaths.map(path => 
      this.getModel(path).catch(error => {
        console.warn(`Preloading failed for ${path}:`, error);
        // Don't reject the whole promise chain for preloading
        return null;
      })
    );
    
    // Wait for all to complete
    await Promise.all(loadPromises);
    console.log('Preloading complete');
  },
  
  // Try loading a model with multiple path attempts
  async getModelWithFallbacks(paths) {
    console.log(`Attempting to load model with ${paths.length} fallback paths`);
    
    // Track all errors for diagnostic purposes
    const errors = [];
    
    // Try each path in sequence
    for (const path of paths) {
      try {
        console.log(`Trying path: ${path}`);
        return await this.getModel(path);
      } catch (error) {
        console.warn(`Failed to load from ${path}:`, error);
        errors.push({ path, error });
        // Continue to next path
      }
    }
    
    // If we get here, all paths failed
    throw new Error(`All paths failed to load model. Errors: ${JSON.stringify(errors.map(e => e.path))}`);
  }
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

// Create ground plane with physics body
function createGround() {
  // Instead of creating a simple ground plane, initialize our nature environment
  natureEnvironment = new NatureEnvironment(scene);
  natureEnvironment.init();
  
  // Create a physics body for the ground
  // We'll create a flat physics ground that matches roughly with our visual terrain
  // For simplicity, we're using a flat collider even though visual terrain has hills
  const groundBodyDesc = rapier.RigidBodyDesc.fixed();
  const groundBody = world.createRigidBody(groundBodyDesc);
  
  const groundColliderDesc = rapier.ColliderDesc.cuboid(100, 0.1, 100);
  groundColliderDesc.setFriction(config.physics.friction);
  groundColliderDesc.setRestitution(config.physics.restitution);
  world.createCollider(groundColliderDesc, groundBody);
  
  console.log("Ground created with physics collider");
}

// Initialize and start
async function init() {
  console.log('Initializing application...');
  
  try {
    console.log('== Starting initialization sequence ==');
    
    // Initialize mobile debugger for mobile devices
    initMobileDebugger();
    if (isMobileDevice()) logToDebugPanel('Starting initialization', 'info');
    
    // Set initial camera position high enough to see the ground
    // This will be overridden by the third person camera
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);
    console.log('Initial camera setup complete');
    
    // Preload models first to ensure they're available for multiplayer
    console.log('Preloading models...');
    await ModelCache.preloadModels();
    console.log('Models preloaded successfully');
    
    // Initialize RAPIER first
    console.log('Initializing RAPIER physics engine...');
    if (isMobileDevice()) logToDebugPanel('Initializing RAPIER physics', 'info');
    const rapierModule = await initRapier();
    if (!rapierModule) {
      throw new Error('Failed to initialize RAPIER physics engine');
    }
    console.log('RAPIER initialized successfully:', rapierModule);
    if (isMobileDevice()) logToDebugPanel('RAPIER initialized successfully', 'info');
    
    // Initialize physics
    console.log('Setting up physics world...');
    if (isMobileDevice()) logToDebugPanel('Setting up physics world', 'info');
    await initPhysics();
    if (!physicsInitialized) {
      throw new Error('Physics initialization failed');
    }
    console.log('Physics world set up successfully:', world);
    if (isMobileDevice()) logToDebugPanel('Physics world set up', 'info');
    
    // Create ground
    console.log('Creating ground...');
    if (isMobileDevice()) logToDebugPanel('Creating ground', 'info');
    createGround();
    console.log('Ground created successfully:', natureEnvironment);
    if (isMobileDevice()) logToDebugPanel('Ground created', 'info');
    
    // Load models
    console.log('Loading 3D models...');
    if (isMobileDevice()) logToDebugPanel('Loading 3D models', 'info');
    await loadModels();
    console.log('Models loaded successfully:', character);
    if (isMobileDevice()) logToDebugPanel('Models loaded successfully', 'info');
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

// Initialize the application
init();
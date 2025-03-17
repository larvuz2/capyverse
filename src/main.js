import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import { WASM_CONFIG } from './config.js';

// Global variables
let scene, camera, renderer, controls;
let character, thirdPersonCamera;
let inputManager;
let world;
let rapier;
let physicsInitialized = false;
let rapierLoadAttempts = 0;
let sceneInitialized = false;
let config = {
  physics: {
    gravity: -9.8,
    friction: 0.5,
    restitution: 0.2
  }
};

// Initialize Rapier physics engine with enhanced error handling and retry logic
async function initRapier() {
  rapierLoadAttempts++;
  
  try {
    // Log loading attempt for debugging
    console.log(`Attempting to load RAPIER WASM (Attempt ${rapierLoadAttempts}/${WASM_CONFIG.maxRetries})`);
    if (isMobileDevice()) logToDebugPanel(`Loading RAPIER WASM (Attempt ${rapierLoadAttempts})`, 'info');
    
    // Initialize with explicit WASM file path
    rapier = await RAPIER.init({
      // Explicitly tell Rapier where to find the WASM file
      locateFile: (path) => {
        console.log(`Looking for WASM file: ${path} in ${WASM_CONFIG.wasmPath}`);
        if (isMobileDevice()) logToDebugPanel(`WASM path: ${WASM_CONFIG.wasmPath}${path}`, 'info');
        return `${WASM_CONFIG.wasmPath}${path}`;
      }
    });
    
    // Log success
    console.log('RAPIER physics initialized successfully');
    if (isMobileDevice()) logToDebugPanel('RAPIER WASM loaded successfully', 'success');
    return rapier;
  } catch (error) {
    console.error('Error initializing RAPIER:', error);
    if (isMobileDevice()) logToDebugPanel(`Error initializing RAPIER: ${error.message}`, 'error');
    
    // Implement retry logic with exponential backoff
    if (rapierLoadAttempts < WASM_CONFIG.maxRetries) {
      const retryDelay = WASM_CONFIG.retryDelay * Math.pow(2, rapierLoadAttempts - 1);
      console.log(`Retrying RAPIER initialization in ${retryDelay}ms...`);
      if (isMobileDevice()) logToDebugPanel(`Retrying RAPIER in ${retryDelay}ms...`, 'warn');
      
      // Try alternative path on subsequent attempts
      if (rapierLoadAttempts === 2) {
        WASM_CONFIG.wasmPath = '/assets/'; // First fallback path
      } else if (rapierLoadAttempts === 3) {
        WASM_CONFIG.wasmPath = './assets/'; // Second fallback path
      }
      
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(initRapier());
        }, retryDelay);
      });
    }
    
    // All attempts failed
    if (isMobileDevice()) logToDebugPanel('All RAPIER loading attempts failed. Using fallback mode.', 'error');
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
    
    // Only proceed if rapier actually loaded
    if (rapier) {
      // Create a physics world with gravity from config
      world = new rapier.World({ x: 0.0, y: config.physics.gravity, z: 0.0 });
      
      // Ground
      const groundColliderDesc = rapier.ColliderDesc.cuboid(100.0, 0.1, 100.0)
        .setFriction(config.physics.friction)
        .setRestitution(config.physics.restitution);
      world.createCollider(groundColliderDesc);
      
      physicsInitialized = true;
      console.log("Physics initialized successfully");
      return true;
    } else {
      throw new Error("RAPIER failed to initialize after multiple attempts");
    }
  } catch (error) {
    console.error("Error initializing physics:", error);
    // When physics initialization fails, set flag for fallback rendering
    window.PHYSICS_FALLBACK_MODE = true;
    console.warn("Entering physics fallback mode - scene will render without physics");
    if (isMobileDevice()) logToDebugPanel("Entering fallback mode - no physics", 'warn');
    return false;
  }
}

// Ensure app continues to render even if WASM loading fails
function ensureRendering() {
  // This function checks if the scene is rendering and takes measures if not
  console.log("Verifying scene rendering...");
  
  // Check if a renderer exists (indicating ThreeJS initialized)
  const rendererExists = document.querySelector('canvas') !== null;
  
  if (!rendererExists) {
    console.warn("No ThreeJS canvas detected! Attempting to diagnose the issue...");
    if (isMobileDevice()) logToDebugPanel("No rendering detected, diagnosing...", 'warn');
    
    // Check if the problem is WASM related
    if (!physicsInitialized) {
      console.warn("Physics not initialized - this might be preventing rendering");
      if (isMobileDevice()) logToDebugPanel("Physics loading may be blocking rendering", 'warn');
      
      // Set fallback flag to bypass physics dependencies
      window.PHYSICS_FALLBACK_MODE = true;
      console.log("Fallback mode enabled - proceeding without physics");
      if (isMobileDevice()) logToDebugPanel("Fallback mode enabled - proceeding without physics", 'info');
      
      // Call our initialization function directly with fallback mode
      console.log("Attempting to restart application in fallback mode...");
      if (isMobileDevice()) logToDebugPanel("Restarting in fallback mode...", 'info');
      
      // Add a slight delay before trying again
      setTimeout(() => {
        initApplication(true); // true = fallback mode
      }, 1000);
    }
  } else {
    console.log("Rendering verification: Canvas detected, scene appears to be rendering");
  }
}

// Add a safety timeout to check rendering after a delay
setTimeout(ensureRendering, 5000); // Check after 5 seconds

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

// Initialize the scene, camera, and renderer
function initThreeJS() {
  console.log("Initializing ThreeJS components...");
  
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  
  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  
  // Add renderer to DOM
  const container = document.getElementById('container');
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    document.body.appendChild(renderer.domElement);
  }
  
  // Add resize handler
  window.addEventListener('resize', onWindowResize, false);
  
  return true;
}

// Create a simple box as a character placeholder
function createSimpleCharacter() {
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown color
  character = new THREE.Mesh(geometry, material);
  character.position.set(0, 1, 0);
  character.castShadow = true;
  character.receiveShadow = true;
  scene.add(character);
  return character;
}

// Create a ground plane
function createGround() {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.MeshStandardMaterial({ color: 0x7CFC00 }); // Lawn green
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

// Setup basic lighting
function setupLighting() {
  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  
  // Directional light (sun)
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 20, 10);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;
  scene.add(directional);
}

// Handle window resize
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update physics if initialized
  if (physicsInitialized && world) {
    world.step();
    // Would normally update character position based on physics here
  }
  
  // Update third-person camera if available
  if (thirdPersonCamera) {
    thirdPersonCamera.update();
  }
  
  // Render scene
  if (scene && camera && renderer) {
    renderer.render(scene, camera);
  }
}

// Main application initialization
async function initApplication(fallbackMode = false) {
  console.log(`Initializing application (fallback mode: ${fallbackMode})`);
  
  // Avoid double initialization
  if (sceneInitialized) {
    console.log("Application already initialized, skipping...");
    return;
  }
  
  // Initialize mobile debugger for debugging on mobile devices
  initMobileDebugger();
  
  // Initialize ThreeJS components
  if (!initThreeJS()) {
    console.error("Failed to initialize ThreeJS components");
    return false;
  }
  
  // Try to initialize physics if not in fallback mode
  if (!fallbackMode && !physicsInitialized) {
    await initPhysics();
  } else if (fallbackMode) {
    console.log("Running in fallback mode - skipping physics initialization");
    window.PHYSICS_FALLBACK_MODE = true;
  }
  
  // Create ground and lighting regardless of physics
  createGround();
  setupLighting();
  
  // Create a simple character
  const characterObj = createSimpleCharacter();
  
  // Initialize input manager
  inputManager = new InputManager(renderer.domElement);
  
  // Initialize third-person camera
  thirdPersonCamera = new ThirdPersonCamera(camera, characterObj);
  
  // Start animation loop
  sceneInitialized = true;
  animate();
  
  console.log("Application initialization complete!");
  return true;
}

// Start the application when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, starting application...");
  initApplication();
}); 
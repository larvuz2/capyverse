import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import { WASM_CONFIG } from './config.js';

// Global physics variables
let world;
let rapier;
let physicsInitialized = false;
let rapierLoadAttempts = 0;

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
    // When physics initialization fails, set flag for fallback rendering
    window.PHYSICS_FALLBACK_MODE = true;
    console.warn("Entering physics fallback mode - scene will render without physics");
    if (isMobileDevice()) logToDebugPanel("Entering fallback mode - no physics", 'warn');
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
      
      // Check if we need to attempt reinitialization
      if (typeof window.initializeApplication === 'function') {
        console.log("Attempting to restart application in fallback mode...");
        if (isMobileDevice()) logToDebugPanel("Restarting in fallback mode...", 'info');
        
        // Add a slight delay before trying again
        setTimeout(() => {
          window.initializeApplication(true); // true = fallback mode
        }, 1000);
      }
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
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
// Initialize Rapier physics engine
const initRapier = async () => {
  // This function initializes the Rapier physics engine
  return await RAPIER.init();
};

// Initialize physics world and components
const initPhysics = async () => {
  // Create a new physics world with gravity
  world = new RAPIER.World({ x: 0.0, y: config.physics.gravity, z: 0.0 });
  
  // Mark physics as initialized
  physicsInitialized = true;
  
  console.log("Physics world initialized successfully");
  return world;
};

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
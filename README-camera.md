# Third-Person Camera System

This is a modular, reusable third-person camera system for Three.js that follows a target object (like a character) with smooth movement and rotation.

## Features

- Smooth camera movement that follows a target
- Mouse-controlled rotation around the target
- Collision detection to prevent camera clipping through objects
- Configurable distance, height, and smoothing
- Optional debugging visualization
- GUI controls for easy adjustment

## Implementation

The system consists of two main components:

1. **ThirdPersonCamera.js** - The camera controller that handles camera positioning, angles, and collision detection
2. **InputManager.js** - Handles mouse input with pointer lock for camera rotation

## Usage

### Basic Setup

```javascript
// Import the camera system
import ThirdPersonCamera from './ThirdPersonCamera.js';
import InputManager from './utils/InputManager.js';

// Initialize Three.js camera and a character/target to follow
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const character = yourCharacterObject; // Any THREE.Object3D

// Initialize input manager for mouse control
const inputManager = new InputManager(renderer.domElement);

// Create third-person camera with default settings
const thirdPersonCamera = new ThirdPersonCamera(camera, character, {
  distance: 5,      // Distance from target
  height: 2,        // Height offset
  smoothing: 0.05,  // Movement smoothing (lower = smoother)
});

// In your animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  // Get mouse movement from input manager
  const mouseDelta = inputManager.getMouseMovement();
  
  // Update camera with delta time and mouse movement
  thirdPersonCamera.update(delta, mouseDelta);
  
  renderer.render(scene, camera);
}
```

### Collision Detection

You can enable collision detection to prevent the camera from clipping through objects:

```javascript
// Add collision objects to the camera
thirdPersonCamera.setCollisionLayers([wall1, wall2, floor]);

// Or add objects individually
thirdPersonCamera.addCollisionObject(newWall);
```

### Configuration Options

The camera supports the following configuration options:

```javascript
const options = {
  distance: 5,                // Distance from target
  height: 2,                  // Height offset from target
  smoothing: 0.05,            // Camera movement smoothing (lower = smoother)
  rotationSmoothing: 0.1,     // Rotation smoothing factor
  minDistance: 1,             // Minimum distance from target
  maxDistance: 10,            // Maximum distance from target
  minPolarAngle: 0.1,         // Minimum vertical angle (radians)
  maxPolarAngle: 1.5,         // Maximum vertical angle (radians)
  lookAhead: 0,               // How much to look ahead of moving character
  collisionLayers: [],        // Collision meshes
  useCollision: true,         // Enable collision detection
  showDebug: false            // Show debug helpers
};
```

## Dependencies

- Three.js

## Notes

- The camera uses a spherical coordinate system to position itself around the target
- Collision detection uses Three.js Raycaster to detect objects between the camera and target
<<<<<<< HEAD
- Mouse input uses the Pointer Lock API for continuous mouse movement 
=======
- Mouse input uses the Pointer Lock API for continuous mouse movement
>>>>>>> 26b034f2acdf725df64d9fdce68981b5abc0f94e

import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

class ThirdPersonCamera {
  constructor(camera, scene, target) {
    this.camera = camera;
    this.scene = scene;
    this.target = target; // The character to follow
    
    // Default camera parameters
    this.params = {
      distance: 5,        // Distance behind the character
      height: 2,          // Height above the character
      lookDownAngle: 15,  // Angle to look down at character (degrees)
      smoothFollow: 0.1,  // Smoothing factor (0-1)
      rotationSpeed: 0.5, // How quickly camera adjusts to character rotation
      offsetX: 0,         // Additional X offset
      offsetY: 0,         // Additional Y offset
      offsetZ: 0          // Additional Z offset
    };
    
    // Initialize helper variables
    this.currentPosition = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.lookPosition = new THREE.Vector3();
    
    // Setup GUI
    this.initGUI();
    
    // Initial camera setup
    this.update();
  }

  initGUI() {
    const gui = new GUI({ title: 'Third Person Camera' });
    
    // Camera position controls
    const cameraFolder = gui.addFolder('Camera Settings');
    
    cameraFolder.add(this.params, 'distance', 2, 10, 0.1)
      .name('Distance')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'height', 0.5, 5, 0.1)
      .name('Height')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'lookDownAngle', 0, 45, 1)
      .name('Look Down Angle')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'smoothFollow', 0.01, 1, 0.01)
      .name('Smoothness')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'rotationSpeed', 0.1, 2, 0.1)
      .name('Rotation Speed')
      .onChange(() => this.update());
    
    // Offset controls
    const offsetFolder = gui.addFolder('Position Offset');
    
    offsetFolder.add(this.params, 'offsetX', -5, 5, 0.1)
      .name('X Offset')
      .onChange(() => this.update());
    
    offsetFolder.add(this.params, 'offsetY', -5, 5, 0.1)
      .name('Y Offset')
      .onChange(() => this.update());
    
    offsetFolder.add(this.params, 'offsetZ', -5, 5, 0.1)
      .name('Z Offset')
      .onChange(() => this.update());
  }

  calculateDesiredPosition() {
    if (!this.target) return;
    
    // Get character position and direction
    const targetPosition = this.target.position.clone();
    
    // Get the character's forward direction (based on rotation)
    const characterDirection = new THREE.Vector3(0, 0, -1);
    characterDirection.applyQuaternion(this.target.quaternion);
    
    // Calculate position behind character based on character's forward direction
    this.desiredPosition.copy(targetPosition).sub(
      characterDirection.clone().multiplyScalar(this.params.distance)
    );
    
    // Add height offset
    this.desiredPosition.y = targetPosition.y + this.params.height;
    
    // Add additional offsets
    this.desiredPosition.x += this.params.offsetX;
    this.desiredPosition.y += this.params.offsetY;
    this.desiredPosition.z += this.params.offsetZ;
  }

  smoothlyMoveToPosition(delta) {
    // Smoothly interpolate current position to desired position
    this.currentPosition.lerp(
      this.desiredPosition, 
      this.params.smoothFollow * (delta * 60) // Normalize by framerate
    );
    
    // Update camera position
    this.camera.position.copy(this.currentPosition);
  }

  lookAtTarget() {
    if (!this.target) return;
    
    // Calculate look position (slightly above character's base)
    this.lookPosition.copy(this.target.position);
    
    // Apply look down angle
    const lookDownRadians = THREE.MathUtils.degToRad(this.params.lookDownAngle);
    const distance = this.params.distance;
    const heightOffset = Math.tan(lookDownRadians) * distance;
    
    this.lookPosition.y -= heightOffset;
    
    // Set camera to look at this position
    this.camera.lookAt(this.lookPosition);
  }

  update(delta = 1/60) {
    if (!this.target) return;
    
    this.calculateDesiredPosition();
    this.smoothlyMoveToPosition(delta);
    this.lookAtTarget();
  }
}

export default ThirdPersonCamera;
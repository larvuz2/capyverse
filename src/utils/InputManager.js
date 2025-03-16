/**
 * Simplified InputManager.js
 * Handles mouse input for the third-person camera with focus on reliability
 */

import { isMobileDevice } from './DeviceDetector.js';

class InputManager {
  constructor(domElement) {
    // Store reference to the DOM element
    this.domElement = domElement || document.body;
    
    // Mouse movement tracking
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    
    // Pointer lock state
    this.isPointerLocked = false;
    
    // Camera control settings
    this._sensitivity = 0.003; // Default sensitivity (matched to ThirdPersonCamera expectations)
    this.invertY = false;     // Option to invert Y axis
    
    // Check if we're on a mobile device
    this.isMobile = isMobileDevice();
    
    // Status for user feedback - only on desktop
    if (!this.isMobile) {
      this.lockStatus = document.createElement('div');
      this.lockStatus.style.position = 'absolute';
      this.lockStatus.style.bottom = '10px';
      this.lockStatus.style.width = '100%';
      this.lockStatus.style.textAlign = 'center';
      this.lockStatus.style.color = 'white';
      this.lockStatus.style.fontFamily = 'Arial, sans-serif';
      this.lockStatus.style.padding = '5px';
      this.lockStatus.style.pointerEvents = 'none'; // Don't interfere with clicks
      this.lockStatus.textContent = 'Click to control camera';
      document.body.appendChild(this.lockStatus);
    }
    
    // Bind methods to this instance
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onPointerLockError = this.onPointerLockError.bind(this);
    this.onClick = this.onClick.bind(this);
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('Simplified InputManager initialized');
  }
  
  // Getter and setter for sensitivity
  get sensitivity() {
    return this._sensitivity;
  }
  
  set sensitivity(value) {
    this._sensitivity = value;
  }
  
  /**
   * Set up all required event listeners
   */
  setupEventListeners() {
    // Mouse movement
    document.addEventListener('mousemove', this.onMouseMove, false);
    
    // Pointer lock events
    document.addEventListener('pointerlockchange', this.onPointerLockChange, false);
    document.addEventListener('pointerlockerror', this.onPointerLockError, false);
    
    // Click to enable controls
    this.domElement.addEventListener('click', this.onClick, false);
  }
  
  /**
   * Handle mouse movement events
   */
  onMouseMove(event) {
    if (!this.isPointerLocked) return;
    
    // Get raw movement values with cross-browser support
    let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    
    // Apply sensitivity
    movementX *= this._sensitivity;
    movementY *= this._sensitivity;
    
    // Apply inversion if needed
    if (this.invertY) {
      movementY = -movementY;
    }
    
    // Store the movement
    this.mouseDeltaX = movementX;
    this.mouseDeltaY = movementY;
  }
  
  /**
   * Handle clicks on the element to request pointer lock
   */
  onClick() {
    if (!this.isPointerLocked) {
      this.requestPointerLock();
    }
  }
  
  /**
   * Request pointer lock on the element
   */
  requestPointerLock() {
    try {
      this.domElement.requestPointerLock();
    } catch (error) {
      console.error('Failed to request pointer lock:', error);
    }
  }
  
  /**
   * Enable pointer lock for external calls
   */
  enablePointerLock() {
    // Request pointer lock
    this.requestPointerLock();
    console.log('Pointer lock requested from external call');
  }
  
  /**
   * Handle pointer lock change events
   */
  onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    
    // Update status message - only if lockStatus exists (non-mobile)
    if (this.lockStatus) {
      this.lockStatus.textContent = this.isPointerLocked ? 
        'Camera controls active (ESC to exit)' : 
        'Click to control camera';
      
      // Hide status after a short delay when locked
      if (this.isPointerLocked) {
        setTimeout(() => {
          this.lockStatus.style.opacity = '0';
        }, 2000);
      } else {
        this.lockStatus.style.opacity = '1';
      }
    }
    
    console.log(`Pointer lock ${this.isPointerLocked ? 'acquired' : 'released'}`);
  }
  
  /**
   * Handle pointer lock errors
   */
  onPointerLockError() {
    console.error('Pointer lock error');
    if (this.lockStatus) {
      this.lockStatus.textContent = 'Camera control error - try again';
    }
  }
  
  /**
   * Get the current mouse movement
   * Called by the camera system each frame
   */
  getMouseMovement() {
    // Create a copy of the current values
    const movement = {
      x: this.mouseDeltaX,
      y: this.mouseDeltaY
    };
    
    // Reset the movement values to avoid repeated movement
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    
    return movement;
  }
  
  /**
   * Clean up all event listeners
   */
  dispose() {
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', this.onPointerLockError, false);
    this.domElement.removeEventListener('click', this.onClick, false);
    
    // Remove status element if it exists
    if (this.lockStatus && this.lockStatus.parentNode) {
      this.lockStatus.parentNode.removeChild(this.lockStatus);
    }
    
    console.log('InputManager disposed');
  }
}

export default InputManager; 
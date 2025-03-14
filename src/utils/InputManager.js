/**
 * InputManager.js
 * Handles user input for the third-person camera controls.
 */

class InputManager {
  constructor(domElement) {
    this.domElement = domElement || document;
    
    // Mouse state tracking
    this.isPointerLocked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.previousMouseX = 0;
    this.previousMouseY = 0;
    
    // Settings
    this.sensitivity = 0.15; // Slightly reduced for smoother control
    this.invertY = false;    // Whether to invert Y-axis movement
    this.damping = 0.85;     // Damping factor for mouse movement
    
    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onPointerLockError = this.onPointerLockError.bind(this);
    
    // Initialize
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Mouse movement event
    this.domElement.addEventListener('mousemove', this.onMouseMove, false);
    
    // Pointer lock events
    document.addEventListener('pointerlockchange', this.onPointerLockChange, false);
    document.addEventListener('pointerlockerror', this.onPointerLockError, false);
    
    // Click to lock pointer
    this.domElement.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.lockPointer();
      }
    }, false);
    
    // Escape key to exit pointer lock
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isPointerLocked) {
        document.exitPointerLock();
      }
    }, false);
  }
  
  lockPointer() {
    this.domElement.requestPointerLock();
  }
  
  onMouseMove(event) {
    if (!this.isPointerLocked) return;
    
    // Get mouse movement
    this.mouseDeltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    this.mouseDeltaY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    
    // Apply sensitivity
    this.mouseDeltaX *= this.sensitivity;
    this.mouseDeltaY *= this.sensitivity;
    
    // Apply Y inversion if enabled
    if (this.invertY) {
      this.mouseDeltaY = -this.mouseDeltaY;
    }
    
    // Track current position
    this.mouseX += this.mouseDeltaX;
    this.mouseY += this.mouseDeltaY;
  }
  
  onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    console.log(`Pointer lock status: ${this.isPointerLocked ? 'Locked' : 'Unlocked'}`);
  }
  
  onPointerLockError() {
    console.error('Pointer lock error');
  }
  
  getMouseMovement() {
    // Apply damping to make movements smoother
    this.mouseDeltaX *= this.damping;
    this.mouseDeltaY *= this.damping;
    
    // Return mouse movement delta and reset
    const deltaX = this.mouseDeltaX;
    const deltaY = this.mouseDeltaY;
    
    // Reset deltas after reading
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    
    return { x: deltaX, y: deltaY };
  }
  
  // Clean up event listeners when no longer needed
  dispose() {
    this.domElement.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', this.onPointerLockError, false);
  }
}

export default InputManager; 
/**
 * ArrowButtons.js
 * Implements transparent directional arrow buttons for mobile devices
 * Designed to replace the joystick with WASD-equivalent controls
 */

import { isMobileDevice, getDeviceOrientation, addOrientationChangeListener } from './DeviceDetector.js';

/**
 * ArrowButtons class for handling mobile directional controls
 */
class ArrowButtons {
  /**
   * Create a new ArrowButtons control
   * @param {Object} options - Configuration options
   * @param {number} options.buttonSize - Size of the arrow buttons in pixels (default: 70)
   * @param {number} options.buttonOpacity - Opacity of the buttons (default: 0.5)
   * @param {number} options.activeButtonOpacity - Opacity of buttons when active (default: 0.5)
   * @param {number} options.autoHide - Whether to hide the buttons after inactivity (default: false)
   * @param {number} options.autoHideDelay - Delay in ms before auto-hiding (default: 3000)
   */
  constructor(options = {}) {
    // Store options with defaults
    this.options = {
      buttonSize: options.buttonSize || 70,
      buttonOpacity: options.buttonOpacity || 0.5,
      activeButtonOpacity: options.activeButtonOpacity || 0.5,
      autoHide: options.autoHide || false,
      autoHideDelay: options.autoHideDelay || 3000,
      usePerformanceMode: options.usePerformanceMode !== undefined ? options.usePerformanceMode : true,
    };
    
    // State tracking
    this.isActive = false;
    this.position = { x: 0, y: 0 }; // Normalized position (-1 to 1)
    this.distance = 0; // Distance from center (0-1)
    this.angle = 0; // Angle in radians
    this.visible = false;
    this.isMobile = isMobileDevice();
    this.orientation = getDeviceOrientation();
    this.autoHideTimer = null;
    
    // Button pressed state
    this.buttonState = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    
    // DOM element references
    this.container = null;
    this.buttons = {
      up: null,
      down: null,
      left: null,
      right: null
    };
    
    // Orientation change handler
    this.removeOrientationListener = null;
    
    // Bind event handlers to this instance
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);
  }
  
  /**
   * Initialize the arrow buttons and create DOM elements
   * @param {boolean} forceEnable - Force enable even on desktop (for testing)
   * @returns {boolean} True if initialized successfully
   */
  init(forceEnable = false) {
    // Only initialize on mobile devices unless forced
    if (!this.isMobile && !forceEnable) {
      console.log('ArrowButtons: Not initializing on non-mobile device');
      return false;
    }
    
    // Create container element
    this.container = document.createElement('div');
    this.container.className = 'mobile-controls arrow-controls';
    
    // Create all buttons in a single row (removing top/middle row structure)
    const directions = ['left', 'up', 'down', 'right'];
    const arrows = ['←', '↓', '↑', '→']; // Order matches directions
    
    // Create all buttons sequentially in the container
    directions.forEach((dir, index) => {
      const button = document.createElement('div');
      button.className = `arrow-button arrow-${dir}`;
      button.setAttribute('data-direction', dir);
      button.innerHTML = arrows[index];
      this.buttons[dir] = button;
      this.container.appendChild(button);
    });
    
    // Add orientation change listener
    this.removeOrientationListener = addOrientationChangeListener((orientation) => {
      this.orientation = orientation;
      this.adjustPositionForOrientation();
    });
    
    // Initial position adjustment
    this.adjustPositionForOrientation();
    
    // Apply hardware acceleration hints
    if (this.options.usePerformanceMode) {
      this.applyPerformanceOptimizations();
    }
    
    console.log('ArrowButtons: Initialized successfully');
    return true;
  }
  
  /**
   * Adjust the buttons position based on device orientation
   */
  adjustPositionForOrientation() {
    if (!this.container) return;
    
    if (this.orientation === 'portrait') {
      this.container.style.bottom = '80px';
      this.container.style.left = '80px';
    } else {
      // Landscape orientation - position further from the edge
      this.container.style.bottom = '30px';
      this.container.style.left = '80px';
    }
  }
  
  /**
   * Append the buttons to the DOM
   * @param {HTMLElement} parent - Parent element to append to (default: document.body)
   */
  appendToDOM(parent = document.body) {
    if (!this.container) {
      console.error('ArrowButtons: Cannot append to DOM before initialization');
      return;
    }
    
    parent.appendChild(this.container);
    this.setupEventListeners();
    console.log('ArrowButtons: Appended to DOM');
  }
  
  /**
   * Remove the buttons from the DOM
   */
  removeFromDOM() {
    if (!this.container || !this.container.parentNode) return;
    
    this.removeEventListeners();
    this.container.parentNode.removeChild(this.container);
    console.log('ArrowButtons: Removed from DOM');
  }
  
  /**
   * Show the buttons (make visible)
   */
  show() {
    if (!this.container) return;
    
    this.container.style.display = 'block';
    this.visible = true;
    
    // Clear auto-hide timer if exists
    this.clearAutoHideTimer();
    
    console.log('ArrowButtons: Now visible');
  }
  
  /**
   * Hide the buttons (make invisible)
   */
  hide() {
    if (!this.container) return;
    
    this.container.style.display = 'none';
    this.visible = false;
    
    // Clear auto-hide timer
    this.clearAutoHideTimer();
    
    console.log('ArrowButtons: Now hidden');
  }
  
  /**
   * Setup touch event listeners
   */
  setupEventListeners() {
    if (!this.container) return;
    
    Object.values(this.buttons).forEach(button => {
      button.addEventListener('touchstart', this.onTouchStart, { passive: false });
      button.addEventListener('touchmove', this.onTouchMove, { passive: false });
      button.addEventListener('touchend', this.onTouchEnd, { passive: false });
      button.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
    });
  }
  
  /**
   * Remove event listeners
   */
  removeEventListeners() {
    if (!this.container) return;
    
    Object.values(this.buttons).forEach(button => {
      button.removeEventListener('touchstart', this.onTouchStart);
      button.removeEventListener('touchmove', this.onTouchMove);
      button.removeEventListener('touchend', this.onTouchEnd);
      button.removeEventListener('touchcancel', this.onTouchCancel);
    });
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    const direction = event.currentTarget.getAttribute('data-direction');
    this.buttonState[direction] = true;
    
    // Add active class for visual feedback
    event.currentTarget.classList.add('active');
    
    // Update movement data
    this.updatePosition();
    
    // Set active state
    this.isActive = true;
    
    // Clear auto-hide timer and restart it
    if (this.options.autoHide) {
      this.startAutoHideTimer();
    }
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - Touch event
   */
  onTouchMove(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - Touch event
   */
  onTouchEnd(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    const direction = event.currentTarget.getAttribute('data-direction');
    this.buttonState[direction] = false;
    
    // Remove active class
    event.currentTarget.classList.remove('active');
    
    // Update movement data
    this.updatePosition();
    
    // Check if any buttons are still pressed
    const anyButtonPressed = Object.values(this.buttonState).some(state => state);
    this.isActive = anyButtonPressed;
    
    // Start auto-hide timer if needed
    if (this.options.autoHide && !anyButtonPressed) {
      this.startAutoHideTimer();
    }
  }
  
  /**
   * Handle touch cancel event
   * @param {TouchEvent} event - Touch event
   */
  onTouchCancel(event) {
    this.onTouchEnd(event);
  }
  
  /**
   * Update position based on button states
   */
  updatePosition() {
    // Reset position
    let x = 0;
    let y = 0;
    
    // Update position based on pressed buttons
    if (this.buttonState.up) y -= 1;
    if (this.buttonState.down) y += 1;
    if (this.buttonState.left) x -= 1;
    if (this.buttonState.right) x += 1;
    
    // Normalize for diagonal movement
    if (x !== 0 && y !== 0) {
      // Normalize to a length of 1 (pythagoras)
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }
    
    // Store position
    this.position.x = x;
    this.position.y = y;
    
    // Calculate distance and angle
    this.distance = Math.sqrt(x * x + y * y);
    this.angle = Math.atan2(y, x);
  }
  
  /**
   * Start timer for auto-hiding buttons
   */
  startAutoHideTimer() {
    this.clearAutoHideTimer();
    
    if (this.options.autoHide) {
      this.autoHideTimer = setTimeout(() => {
        this.fadeOutJoystick();
      }, this.options.autoHideDelay);
    }
  }
  
  /**
   * Clear auto-hide timer
   */
  clearAutoHideTimer() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }
  
  /**
   * Fade out the buttons
   */
  fadeOutJoystick() {
    if (!this.container) return;
    
    this.container.classList.add('fade-out');
  }
  
  /**
   * Fade in the buttons
   */
  fadeInJoystick() {
    if (!this.container) return;
    
    this.container.classList.remove('fade-out');
  }
  
  /**
   * Get the current position
   * @returns {Object} Position with x and y components
   */
  getPosition() {
    return { x: this.position.x, y: this.position.y };
  }
  
  /**
   * Get the distance from center (0-1)
   * @returns {number} Distance
   */
  getDistance() {
    return this.distance;
  }
  
  /**
   * Get the angle in radians
   * @returns {number} Angle
   */
  getAngle() {
    return this.angle;
  }
  
  /**
   * Get the angle in degrees
   * @returns {number} Angle in degrees
   */
  getAngleDegrees() {
    return this.angle * (180 / Math.PI);
  }
  
  /**
   * Check if any button is currently active
   * @returns {boolean} True if active
   */
  getIsActive() {
    return this.isActive;
  }
  
  /**
   * Apply performance optimizations
   */
  applyPerformanceOptimizations() {
    if (!this.container) return;
    
    // Add battery-saving class if option enabled
    if (this.options.batteryOptimized) {
      this.container.classList.add('battery-saving');
    }
    
    // Apply hardware acceleration hints
    this.container.style.willChange = 'opacity';
    
    Object.values(this.buttons).forEach(button => {
      button.style.willChange = 'transform, background-color';
    });
  }
  
  /**
   * Get movement data in a format compatible with the joystick
   * @returns {Object} Movement data
   */
  getMovementData() {
    return {
      position: this.getPosition(),
      distance: this.getDistance(),
      angle: this.getAngle(),
      angleDegrees: this.getAngleDegrees()
    };
  }
  
  /**
   * Dispose all resources
   */
  dispose() {
    this.removeEventListeners();
    this.removeFromDOM();
    
    if (this.removeOrientationListener) {
      this.removeOrientationListener();
    }
    
    this.clearAutoHideTimer();
    
    console.log('ArrowButtons: Disposed');
  }
  
  /**
   * Enable test mode on desktop
   */
  static enableTestMode() {
    const arrowButtons = new ArrowButtons({
      autoHide: false
    });
    
    arrowButtons.init(true);
    arrowButtons.appendToDOM();
    arrowButtons.show();
    
    return arrowButtons;
  }
}

<<<<<<< HEAD
export default ArrowButtons; 
=======
export default ArrowButtons;
>>>>>>> 0701ce40650e797fecb4fcee4317649f1e8a3dcf

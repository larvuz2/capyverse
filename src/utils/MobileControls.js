/**
 * MobileControls.js
 * Implements a transparent virtual joystick for mobile devices
 */

import { isMobileDevice, getDeviceOrientation, addOrientationChangeListener } from './DeviceDetector.js';

/**
 * MobileJoystick class for handling mobile touch controls
 */
class MobileJoystick {
  /**
   * Create a new MobileJoystick
   * @param {Object} options - Configuration options
   * @param {number} options.baseSize - Size of the joystick base in pixels (default: 140)
   * @param {number} options.knobSize - Size of the joystick knob in pixels (default: 70)
   * @param {number} options.baseOpacity - Opacity of the base (default: 0.5)
   * @param {number} options.knobOpacity - Opacity of the knob (default: 0.5)
   * @param {number} options.activeBaseOpacity - Opacity of the base when active (default: 0.5)
   * @param {number} options.activeKnobOpacity - Opacity of the knob when active (default: 0.5)
   * @param {number} options.deadZone - Dead zone radius as a fraction of the joystick radius (default: 0.1)
   * @param {boolean} options.autoHide - Whether to hide the joystick after a period of inactivity (default: false)
   * @param {number} options.autoHideDelay - Delay in ms before auto-hiding the joystick (default: 3000)
   * @param {boolean} options.usePerformanceMode - Whether to use performance optimizations (default: true)
   * @param {number} options.smoothing - Smoothing factor for position updates (default: 0.5)
   * @param {boolean} options.batteryOptimized - Whether the joystick is battery optimized (default: false)
   */
  constructor(options = {}) {
    // Store options with defaults
    this.options = {
      baseSize: options.baseSize || 140,
      knobSize: options.knobSize || 70,
      baseOpacity: options.baseOpacity || 0.5,
      knobOpacity: options.knobOpacity || 0.5,
      activeBaseOpacity: options.activeBaseOpacity || 0.5,
      activeKnobOpacity: options.activeKnobOpacity || 0.5,
      deadZone: options.deadZone || 0.1,
      autoHide: options.autoHide || false,
      autoHideDelay: options.autoHideDelay || 3000,
      usePerformanceMode: options.usePerformanceMode !== undefined ? options.usePerformanceMode : true,
      smoothing: options.smoothing || 0.5,
      batteryOptimized: options.batteryOptimized || false
    };
    
    // State tracking
    this.isActive = false;
    this.position = { x: 0, y: 0 }; // Normalized position (-1 to 1)
    this.rawPosition = { x: 0, y: 0 }; // Raw position before applying deadzone
    this.distance = 0; // Distance from center (0-1)
    this.angle = 0; // Angle in radians
    this.visible = false;
    this.isMobile = isMobileDevice();
    this.orientation = getDeviceOrientation();
    this.autoHideTimer = null;
    this.touchId = null; // For tracking specific touch in multi-touch
    
    // DOM element references
    this.container = null;
    this.base = null;
    this.knob = null;
    
    // Orientation change handler
    this.removeOrientationListener = null;
    
    // Bind event handlers to this instance
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);
    
    // Animation frame handling
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 60; // Target 60fps
    this.targetPosition = { x: 0, y: 0 }; // Target for smoothing
    
    // Performance monitoring
    this.frameTimes = [];
    this.performanceMode = 'high';
  }
  
  /**
   * Initialize the joystick and create DOM elements
   * @param {boolean} forceEnable - Force enable even on desktop (for testing)
   * @returns {boolean} True if initialized successfully
   */
  init(forceEnable = false) {
    // Only initialize on mobile devices unless forced
    if (!this.isMobile && !forceEnable) {
      console.log('MobileJoystick: Not initializing on non-mobile device');
      return false;
    }
    
    // Create container element
    this.container = document.createElement('div');
    this.container.className = 'mobile-controls';
    
    // Create joystick base (outer circle)
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    
    // Create joystick knob (inner circle)
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    
    // Create direction indicator (optional visual feedback)
    this.directionIndicator = document.createElement('div');
    this.directionIndicator.className = 'joystick-direction';
    this.directionIndicator.style.opacity = '0';
    this.base.appendChild(this.directionIndicator);
    
    // Combine elements
    this.base.appendChild(this.knob);
    this.container.appendChild(this.base);
    
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
    
    // Start performance monitoring if in debug mode
    if (forceEnable) {
      this.startPerformanceMonitoring();
    }
    
    // If we're forcing enable (test mode), add debug panel
    if (forceEnable) {
      this.addDebugPanel();
    }
    
    // Success
    console.log('MobileJoystick: Initialized successfully');
    return true;
  }
  
  /**
   * Adjust the joystick position based on device orientation
   */
  adjustPositionForOrientation() {
    if (!this.base) return;
    
    if (this.orientation === 'portrait') {
      this.base.style.bottom = '80px';
      this.base.style.left = '80px';
    } else {
      // Landscape orientation - position further from the edge
      this.base.style.bottom = '30px';
      this.base.style.left = '80px';
    }
  }
  
  /**
   * Append the joystick to the DOM
   * @param {HTMLElement} parent - Parent element to append to (default: document.body)
   */
  appendToDOM(parent = document.body) {
    if (!this.container) {
      console.error('MobileJoystick: Cannot append to DOM before initialization');
      return;
    }
    
    parent.appendChild(this.container);
    this.setupEventListeners();
    console.log('MobileJoystick: Appended to DOM');
  }
  
  /**
   * Remove the joystick from the DOM
   */
  removeFromDOM() {
    if (!this.container || !this.container.parentNode) return;
    
    this.removeEventListeners();
    this.container.parentNode.removeChild(this.container);
    console.log('MobileJoystick: Removed from DOM');
  }
  
  /**
   * Show the joystick (make visible)
   */
  show() {
    if (!this.container) return;
    
    this.container.style.display = 'block';
    this.visible = true;
    
    // Clear auto-hide timer if exists
    this.clearAutoHideTimer();
    
    console.log('MobileJoystick: Now visible');
  }
  
  /**
   * Hide the joystick (make invisible)
   */
  hide() {
    if (!this.container) return;
    
    this.container.style.display = 'none';
    this.visible = false;
    
    // Clear auto-hide timer
    this.clearAutoHideTimer();
    
    console.log('MobileJoystick: Now hidden');
  }
  
  /**
   * Toggle the joystick visibility
   * @returns {boolean} New visibility state
   */
  toggleVisibility() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
    return this.visible;
  }
  
  /**
   * Setup touch event listeners
   */
  setupEventListeners() {
    if (!this.base) return;
    
    this.base.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.base.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.base.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.base.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
  }
  
  /**
   * Remove event listeners
   */
  removeEventListeners() {
    if (!this.base) return;
    
    this.base.removeEventListener('touchstart', this.onTouchStart);
    this.base.removeEventListener('touchmove', this.onTouchMove);
    this.base.removeEventListener('touchend', this.onTouchEnd);
    this.base.removeEventListener('touchcancel', this.onTouchCancel);
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    // Only process if not already active
    if (this.isActive) return;
    
    // Store the touch identifier to track this specific touch
    this.touchId = event.touches[0].identifier;
    
    // Set active state
    this.isActive = true;
    this.base.classList.add('active');
    this.knob.classList.add('active');
    
    // Clear auto-hide timer
    this.clearAutoHideTimer();
    
    // Process touch position
    this.processTouchEvent(event);
    
    // Add visual feedback
    this.addTouchFeedback();
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - Touch event
   */
  onTouchMove(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    // Only process if active
    if (!this.isActive) return;
    
    // Process touch position
    this.processTouchEvent(event);
    
    // Update visual feedback
    this.updateTouchFeedback();
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - Touch event
   */
  onTouchEnd(event) {
    // Prevent default
    event.preventDefault();
    
    // Check if this is the touch we're tracking
    let touchFound = false;
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.touchId) {
        touchFound = true;
        break;
      }
    }
    
    // Only process if this is our touch
    if (!touchFound) return;
    
    this.resetJoystick();
    
    // Start auto-hide timer if configured
    if (this.options.autoHide) {
      this.startAutoHideTimer();
    }
  }
  
  /**
   * Handle touch cancel event
   * @param {TouchEvent} event - Touch event
   */
  onTouchCancel(event) {
    // Prevent default
    event.preventDefault();
    
    // Reset regardless of which touch was cancelled
    this.resetJoystick();
    
    // Start auto-hide timer if configured
    if (this.options.autoHide) {
      this.startAutoHideTimer();
    }
  }
  
  /**
   * Reset joystick state
   */
  resetJoystick() {
    // Reset state
    this.isActive = false;
    this.touchId = null;
    this.base.classList.remove('active');
    this.knob.classList.remove('active');
    
    // Reset position
    this.position = { x: 0, y: 0 };
    this.rawPosition = { x: 0, y: 0 };
    this.distance = 0;
    this.angle = 0;
    this.updateKnobPosition(0, 0);
    
    // Reset visual feedback
    this.removeTouchFeedback();
    
    // Cancel any ongoing animations
    this.cancelAnimationFrame();
    
    // Reset target position
    this.targetPosition = { x: 0, y: 0 };
  }
  
  /**
   * Process touch event to calculate joystick position
   * @param {TouchEvent} event - Touch event
   */
  processTouchEvent(event) {
    // Find our specific touch
    let touch = null;
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === this.touchId) {
        touch = event.touches[i];
        break;
      }
    }
    
    // If touch not found, do nothing
    if (!touch) return;
    
    // Get touch position relative to base
    const rect = this.base.getBoundingClientRect();
    
    // Calculate center of base
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate touch position relative to center
    const relativeX = touch.clientX - centerX;
    const relativeY = touch.clientY - centerY;
    
    // Calculate distance from center
    const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
    
    // Calculate angle
    this.angle = Math.atan2(relativeY, relativeX);
    
    // Calculate maximum allowed distance (base radius)
    const maxDistance = rect.width / 2;
    
    // Store normalized distance (0-1)
    this.distance = Math.min(distance / maxDistance, 1);
    
    // If distance is greater than max, normalize the coordinates
    let normX = relativeX;
    let normY = relativeY;
    
    if (distance > maxDistance) {
      const scale = maxDistance / distance;
      normX *= scale;
      normY *= scale;
    }
    
    // Smooth position updates using animation frames
    this.targetPosition = {
      x: normX,
      y: normY
    };
    
    // Start animation loop if not already running
    if (!this.animationFrameId) {
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.updateAnimation.bind(this));
    }
  }
  
  /**
   * Animation frame update loop
   * @param {number} timestamp - Current animation frame timestamp
   */
  updateAnimation(timestamp) {
    // Calculate time since last frame
    const deltaTime = timestamp - this.lastFrameTime;
    
    // Only update if enough time has passed (frame limiting)
    if (deltaTime >= this.frameInterval) {
      this.lastFrameTime = timestamp - (deltaTime % this.frameInterval);
      
      // Increase frame counter for FPS calculation
      this.frameCount++;
      
      // Calculate knob position with smoothing if enabled
      if (this.options.smoothing > 0 && this.isActive) {
        const smoothFactor = Math.min(1.0, this.options.smoothing * (deltaTime / this.frameInterval));
        
        // Get target position (in pixels)
        const rect = this.base.getBoundingClientRect();
        const maxDistance = rect.width / 2;
        
        // Current knob position
        const transform = window.getComputedStyle(this.knob).transform;
        let currentX = 0;
        let currentY = 0;
        
        // Parse current transform if it's a matrix
        if (transform && transform !== 'none' && transform.includes('matrix')) {
          const values = transform.match(/matrix.*\((.+)\)/)[1].split(', ');
          if (values.length >= 6) {
            currentX = parseFloat(values[4]);
            currentY = parseFloat(values[5]);
          }
        }
        
        // Apply smoothing
        const newX = currentX + (this.targetPosition.x - currentX) * smoothFactor;
        const newY = currentY + (this.targetPosition.y - currentY) * smoothFactor;
        
        // Update knob position
        this.knob.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
        
        // Update raw position values based on new position
        this.rawPosition = {
          x: newX / maxDistance,
          y: newY / maxDistance
        };
        
        // Apply dead zone to raw position
        this.applyDeadZone();
      }
      else {
        // Directly update knob without smoothing
        this.knob.style.transform = `translate3d(${this.targetPosition.x}px, ${this.targetPosition.y}px, 0)`;
      }
    }
    
    // Continue animation loop if active
    if (this.isActive) {
      this.animationFrameId = requestAnimationFrame(this.updateAnimation.bind(this));
    } else {
      this.animationFrameId = null;
    }
  }
  
  /**
   * Cancel animation frame when not needed
   */
  cancelAnimationFrame() {
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Apply dead zone to joystick position
   * Positions within the dead zone are treated as zero,
   * positions outside are rescaled to maintain full range
   */
  applyDeadZone() {
    const deadZone = this.options.deadZone;
    
    // Calculate distance from center
    const rawDistance = Math.sqrt(
      this.rawPosition.x * this.rawPosition.x + 
      this.rawPosition.y * this.rawPosition.y
    );
    
    // If within dead zone, set position to zero
    if (rawDistance < deadZone) {
      this.position = { x: 0, y: 0 };
      return;
    }
    
    // Rescale the values outside the deadzone to the full range
    // This ensures that if deadzone is 0.1, values start at 0.1 and go to 1.0
    // We rescale to ensure we still reach exactly 1.0 at the edge
    const scaleFactor = (rawDistance - deadZone) / (1 - deadZone);
    const normalizedDistance = Math.min(scaleFactor, 1.0);
    
    // Calculate the normalized direction
    const directionX = rawDistance > 0 ? this.rawPosition.x / rawDistance : 0;
    const directionY = rawDistance > 0 ? this.rawPosition.y / rawDistance : 0;
    
    // Apply the rescaled distance in the same direction
    this.position = {
      x: directionX * normalizedDistance,
      y: directionY * normalizedDistance
    };
  }
  
  /**
   * Update the visual position of the knob
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   */
  updateKnobPosition(x, y) {
    if (!this.knob) return;
    
    // Set transform with hardware acceleration
    this.knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  
  /**
   * Add visual feedback when joystick is touched
   */
  addTouchFeedback() {
    if (!this.base || !this.knob) return;
    
    // Add a subtle pulse effect
    this.base.classList.add('pulse');
    
    // Make direction indicator visible
    if (this.directionIndicator) {
      this.directionIndicator.style.opacity = '0.7';
    }
  }
  
  /**
   * Update visual feedback based on joystick position
   */
  updateTouchFeedback() {
    if (!this.directionIndicator) return;
    
    // Update the direction indicator based on the angle and distance
    const intensity = this.distance;
    const rotationDegrees = (this.angle * 180 / Math.PI) + 90; // +90 to make up point at 0 deg
    
    this.directionIndicator.style.transform = `rotate(${rotationDegrees}deg)`;
    this.directionIndicator.style.opacity = 0.3 + (intensity * 0.4); // 0.3 to 0.7 based on intensity
  }
  
  /**
   * Remove visual feedback when joystick is released
   */
  removeTouchFeedback() {
    if (!this.base) return;
    
    // Remove pulse effect
    this.base.classList.remove('pulse');
    
    // Hide direction indicator
    if (this.directionIndicator) {
      this.directionIndicator.style.opacity = '0';
    }
  }
  
  /**
   * Start timer for auto-hiding joystick
   */
  startAutoHideTimer() {
    if (!this.options.autoHide) return;
    
    this.clearAutoHideTimer();
    
    this.autoHideTimer = setTimeout(() => {
      this.fadeOutJoystick();
    }, this.options.autoHideDelay);
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
   * Fade out the joystick
   */
  fadeOutJoystick() {
    if (!this.container) return;
    
    this.container.classList.add('fade-out');
    
    // After animation completes, hide the joystick
    setTimeout(() => {
      if (!this.isActive) {
        this.container.style.opacity = '0.3';
      }
    }, 500);
  }
  
  /**
   * Fade in the joystick
   */
  fadeInJoystick() {
    if (!this.container) return;
    
    this.container.classList.remove('fade-out');
    this.container.style.opacity = '1';
  }
  
  /**
   * Get the current joystick position
   * @returns {Object} Position with x and y properties (both from -1 to 1)
   */
  getPosition() {
    return { ...this.position };
  }
  
  /**
   * Get the raw joystick position before deadzone application
   * @returns {Object} Raw position with x and y properties (both from -1 to 1)
   */
  getRawPosition() {
    return { ...this.rawPosition };
  }
  
  /**
   * Get the distance from center (0 to 1)
   * @returns {number} Distance from center
   */
  getDistance() {
    return this.distance;
  }
  
  /**
   * Get the angle in radians
   * @returns {number} Angle in radians
   */
  getAngle() {
    return this.angle;
  }
  
  /**
   * Get the angle in degrees
   * @returns {number} Angle in degrees (0-360)
   */
  getAngleDegrees() {
    // Convert radians to degrees and normalize to 0-360 range
    let degrees = this.angle * (180 / Math.PI);
    return (degrees + 360) % 360;
  }
  
  /**
   * Check if the joystick is currently active (being touched)
   * @returns {boolean} True if active
   */
  getIsActive() {
    return this.isActive;
  }
  
  /**
   * Add debug panel for testing and adjustments
   */
  addDebugPanel() {
    // Create debug panel
    this.debugPanel = document.createElement('div');
    this.debugPanel.className = 'joystick-debug-panel';
    this.debugPanel.style.position = 'absolute';
    this.debugPanel.style.top = '10px';
    this.debugPanel.style.left = '10px';
    this.debugPanel.style.width = '180px';
    this.debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.debugPanel.style.color = 'white';
    this.debugPanel.style.padding = '10px';
    this.debugPanel.style.borderRadius = '5px';
    this.debugPanel.style.fontFamily = 'monospace';
    this.debugPanel.style.fontSize = '12px';
    this.debugPanel.style.zIndex = '2000';
    
    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Joystick Debug';
    title.style.margin = '0 0 10px 0';
    this.debugPanel.appendChild(title);
    
    // Add position display
    this.debugPosX = this.createDebugItem('X: 0.00');
    this.debugPosY = this.createDebugItem('Y: 0.00');
    this.debugDistance = this.createDebugItem('Dist: 0.00');
    this.debugAngle = this.createDebugItem('Angle: 0°');
    this.debugActive = this.createDebugItem('Active: false');
    
    // Add controls
    this.createControlSlider('Deadzone', 0, 0.5, 0.01, this.options.deadZone, (value) => {
      this.options.deadZone = parseFloat(value);
    });
    
    this.createControlSlider('Base Opacity', 0, 1, 0.05, this.options.baseOpacity, (value) => {
      this.options.baseOpacity = parseFloat(value);
      if (this.base && !this.isActive) {
        this.base.style.backgroundColor = `rgba(255, 255, 255, ${this.options.baseOpacity})`;
      }
    });
    
    this.createControlSlider('Knob Opacity', 0, 1, 0.05, this.options.knobOpacity, (value) => {
      this.options.knobOpacity = parseFloat(value);
      if (this.knob && !this.isActive) {
        this.knob.style.backgroundColor = `rgba(255, 255, 255, ${this.options.knobOpacity})`;
      }
    });
    
    this.createControlCheckbox('Auto Hide', this.options.autoHide, (checked) => {
      this.options.autoHide = checked;
    });
    
    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Joystick';
    resetButton.style.width = '100%';
    resetButton.style.margin = '10px 0';
    resetButton.style.padding = '5px';
    resetButton.addEventListener('click', () => {
      this.resetJoystick();
    });
    this.debugPanel.appendChild(resetButton);
    
    // Append to document
    document.body.appendChild(this.debugPanel);
    
    // Start debug update
    this.startDebugUpdates();
  }
  
  /**
   * Create a debug display item
   * @param {string} text - Initial text
   * @returns {HTMLElement} The created element
   */
  createDebugItem(text) {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.margin = '5px 0';
    this.debugPanel.appendChild(item);
    return item;
  }
  
  /**
   * Create a control slider
   * @param {string} label - Label for the slider
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {number} step - Step size
   * @param {number} value - Initial value
   * @param {Function} onChange - Callback for value changes
   */
  createControlSlider(label, min, max, step, value, onChange) {
    const container = document.createElement('div');
    container.style.margin = '10px 0';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.display = 'block';
    labelElement.style.marginBottom = '5px';
    container.appendChild(labelElement);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = '100%';
    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value;
      onChange(slider.value);
    });
    container.appendChild(slider);
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value;
    valueDisplay.style.marginLeft = '5px';
    container.appendChild(valueDisplay);
    
    this.debugPanel.appendChild(container);
  }
  
  /**
   * Create a control checkbox
   * @param {string} label - Label for the checkbox
   * @param {boolean} checked - Initial state
   * @param {Function} onChange - Callback for state changes
   */
  createControlCheckbox(label, checked, onChange) {
    const container = document.createElement('div');
    container.style.margin = '10px 0';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.id = `joystick-${label.toLowerCase().replace(/\s+/g, '-')}`;
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });
    container.appendChild(checkbox);
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.htmlFor = checkbox.id;
    labelElement.style.marginLeft = '5px';
    container.appendChild(labelElement);
    
    this.debugPanel.appendChild(container);
  }
  
  /**
   * Start debug updates
   */
  startDebugUpdates() {
    this.debugUpdateInterval = setInterval(() => {
      if (this.debugPosX && this.debugPosY) {
        this.debugPosX.textContent = `X: ${this.position.x.toFixed(2)}`;
        this.debugPosY.textContent = `Y: ${this.position.y.toFixed(2)}`;
        this.debugDistance.textContent = `Dist: ${this.distance.toFixed(2)}`;
        this.debugAngle.textContent = `Angle: ${(this.getAngleDegrees()).toFixed(0)}°`;
        this.debugActive.textContent = `Active: ${this.isActive}`;
      }
    }, 100);
  }
  
  /**
   * Clean up resources when done
   */
  dispose() {
    this.clearAutoHideTimer();
    
    // Clear debug update interval
    if (this.debugUpdateInterval) {
      clearInterval(this.debugUpdateInterval);
    }
    
    // Remove debug panel
    if (this.debugPanel && this.debugPanel.parentNode) {
      this.debugPanel.parentNode.removeChild(this.debugPanel);
    }
    
    this.removeEventListeners();
    this.removeFromDOM();
    
    if (this.removeOrientationListener) {
      this.removeOrientationListener();
    }
    
    // Cancel animation frame
    this.cancelAnimationFrame();
    
    console.log('MobileJoystick: Disposed');
  }
  
  /**
   * Enable joystick test mode on desktop
   * @static
   */
  static enableTestMode() {
    const joystick = new MobileJoystick({
      baseSize: 150,
      knobSize: 75,
      deadZone: 0.1,
      autoHide: false
    });
    
    // Force enable even on desktop
    joystick.init(true);
    joystick.appendToDOM();
    joystick.show();
    
    return joystick;
  }
  
  /**
   * Apply performance optimizations for mobile devices
   */
  applyPerformanceOptimizations() {
    if (!this.container || !this.base || !this.knob) return;
    
    // Force hardware acceleration
    this.container.style.transform = 'translateZ(0)';
    this.base.style.transform = 'translateZ(0)';
    this.knob.style.transform = 'translate3d(0, 0, 0)';
    
    // Prevent text selection which can cause performance issues
    this.container.style.userSelect = 'none';
    this.container.style.webkitUserSelect = 'none';
    this.container.style.mozUserSelect = 'none';
    
    // Optimize for touch devices
    this.container.style.touchAction = 'none';
    
    // Apply will-change for elements that will animate
    this.knob.style.willChange = 'transform';
    this.directionIndicator.style.willChange = 'transform, opacity';
    
    console.log('Performance optimizations applied');
  }
  
  /**
   * Start monitoring performance
   */
  startPerformanceMonitoring() {
    // Only in debug mode
    if (!this.debugPanel) return;
    
    // Add FPS counter to debug panel
    this.fpsDisplay = this.createDebugItem('FPS: --');
    this.modeDisplay = this.createDebugItem('Mode: high');
    
    // Track frame times for FPS calculation
    this.lastPerformanceUpdate = performance.now();
    this.frameCount = 0;
    
    setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastPerformanceUpdate;
      
      // Calculate FPS
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      
      // Update display
      if (this.fpsDisplay) {
        this.fpsDisplay.textContent = `FPS: ${fps}`;
      }
      
      // Dynamic performance mode switching
      this.adjustPerformanceMode(fps);
      
      // Reset counters
      this.frameCount = 0;
      this.lastPerformanceUpdate = now;
    }, 1000);
  }
  
  /**
   * Dynamically adjust performance based on FPS
   * @param {number} fps - Current frames per second
   */
  adjustPerformanceMode(fps) {
    if (!this.options.usePerformanceMode) return;
    
    // If FPS drops below threshold, switch to battery saving mode
    if (fps < 30 && this.performanceMode === 'high') {
      this.performanceMode = 'low';
      
      // Apply low performance optimizations
      this.directionIndicator.style.display = 'none';
      this.frameInterval = 1000 / 30; // Target 30fps for updates
      
      if (this.modeDisplay) {
        this.modeDisplay.textContent = 'Mode: low (battery saving)';
      }
      
      // Add battery saving class for CSS optimizations
      document.body.classList.add('battery-saving');
      
      console.log('Switched to battery saving mode');
    }
    // If FPS recovers, switch back to high performance
    else if (fps > 45 && this.performanceMode === 'low') {
      this.performanceMode = 'high';
      
      // Restore high performance features
      this.directionIndicator.style.display = 'block';
      this.frameInterval = 1000 / 60; // Target 60fps
      
      if (this.modeDisplay) {
        this.modeDisplay.textContent = 'Mode: high';
      }
      
      // Remove battery saving class
      document.body.classList.remove('battery-saving');
      
      console.log('Switched to high performance mode');
    }
  }
  
  /**
   * Get movement data optimized for character control
   * @returns {Object} Joystick data ready for character movement
   */
  getMovementData() {
    return {
      position: { ...this.position },
      distance: this.distance,
      angle: this.angle,
      active: this.isActive,
      frameTime: this.lastFrameTime
    };
  }
}

export default MobileJoystick; 
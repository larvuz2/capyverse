/**
 * DeviceDetector.js
 * Utility functions for detecting mobile devices and their capabilities
 */

/**
 * Check if the current device is a mobile device
 * This uses multiple detection methods for higher accuracy
 * 
 * @returns {boolean} True if the current device is mobile
 */
export function isMobileDevice() {
  // Check if device has touch capability
  const hasTouchCapability = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    navigator.msMaxTouchPoints > 0;
  
  // Check for mobile user agent patterns
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
  
  // Check screen dimensions
  const hasSmallScreen = window.innerWidth <= 1024;
  
  // Use combination for more reliable detection
  return (hasTouchCapability && (isMobileUserAgent || hasSmallScreen));
}

/**
 * Get the current device orientation
 * 
 * @returns {string} 'portrait' or 'landscape'
 */
export function getDeviceOrientation() {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * Add an event listener for orientation changes
 * 
 * @param {Function} callback - Function to call when orientation changes
 * @returns {Function} Function to remove the event listener
 */
export function addOrientationChangeListener(callback) {
  // The event we listen for depends on the browser
  const orientationEvent = 'onorientationchange' in window ? 'orientationchange' : 'resize';
  
  // Function to handle orientation change
  const handleOrientationChange = () => {
    callback(getDeviceOrientation());
  };
  
  // Add the event listener
  window.addEventListener(orientationEvent, handleOrientationChange, false);
  
  // Return a function to remove the listener
  return () => {
    window.removeEventListener(orientationEvent, handleOrientationChange, false);
  };
}

/**
 * Get detailed information about the mobile device
 * 
 * @returns {Object} Object with device information
 */
export function getMobileDeviceInfo() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const vendor = navigator.vendor || '';
  
  // Get battery status if available
  let batteryPromise = null;
  if (navigator.getBattery) {
    batteryPromise = navigator.getBattery();
  }
  
  // Basic device info
  const info = {
    userAgent: ua,
    platform: platform,
    vendor: vendor,
    isMobile: isMobileDevice(),
    orientation: getDeviceOrientation(),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    isLowEndDevice: false,
    isHighEndDevice: false,
    memoryInfo: navigator.deviceMemory || 'unknown',
    connectionType: 'unknown',
    batteryInfo: null,
    supportsTouchEvents: 'ontouchstart' in window,
    supportsOrientationEvents: 'onorientationchange' in window,
    osInfo: getOSInfo(ua),
    browserInfo: getBrowserInfo(ua, vendor),
    hardwareInfo: getHardwareInfo(ua),
    gpuInfo: getGPUInfo(),
    capabilities: getDeviceCapabilities()
  };
  
  // Get network information if available
  if (navigator.connection) {
    info.connectionType = navigator.connection.effectiveType || navigator.connection.type || 'unknown';
    info.downlink = navigator.connection.downlink;
    info.saveData = navigator.connection.saveData;
  }
  
  // Check for low-end or high-end device
  if (info.devicePixelRatio <= 1 || (info.memoryInfo !== 'unknown' && info.memoryInfo <= 2)) {
    info.isLowEndDevice = true;
  } else if (info.devicePixelRatio >= 2.5 || (info.memoryInfo !== 'unknown' && info.memoryInfo >= 6)) {
    info.isHighEndDevice = true;
  }
  
  // Return the promise that will resolve with the full device info
  return batteryPromise ? 
    batteryPromise.then(battery => {
      info.batteryInfo = {
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      };
      return info;
    }).catch(() => info) : 
    Promise.resolve(info);
}

/**
 * Get information about the operating system
 * 
 * @param {string} ua - User agent string
 * @returns {Object} OS information
 */
function getOSInfo(ua) {
  const lowercaseUA = ua.toLowerCase();
  let os = 'unknown';
  let version = 'unknown';
  
  // Detect OS type
  if (lowercaseUA.indexOf('win') >= 0) {
    os = 'Windows';
    if (lowercaseUA.indexOf('windows nt 10.0') >= 0) version = '10';
    else if (lowercaseUA.indexOf('windows nt 6.3') >= 0) version = '8.1';
    else if (lowercaseUA.indexOf('windows nt 6.2') >= 0) version = '8';
    else if (lowercaseUA.indexOf('windows nt 6.1') >= 0) version = '7';
  } else if (lowercaseUA.indexOf('iphone') >= 0 || lowercaseUA.indexOf('ipad') >= 0 || lowercaseUA.indexOf('ipod') >= 0) {
    os = 'iOS';
    const match = lowercaseUA.match(/os (\d+)_(\d+)_?(\d+)?/);
    if (match) version = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
  } else if (lowercaseUA.indexOf('android') >= 0) {
    os = 'Android';
    const match = lowercaseUA.match(/android (\d+(?:\.\d+)*)/);
    if (match) version = match[1];
  } else if (lowercaseUA.indexOf('mac') >= 0) {
    os = 'macOS';
    const match = lowercaseUA.match(/mac os x (\d+)_(\d+)_?(\d+)?/);
    if (match) version = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
  } else if (lowercaseUA.indexOf('linux') >= 0) {
    os = 'Linux';
  }
  
  return { name: os, version: version };
}

/**
 * Get information about the browser
 * 
 * @param {string} ua - User agent string
 * @param {string} vendor - Browser vendor string
 * @returns {Object} Browser information
 */
function getBrowserInfo(ua, vendor) {
  const lowercaseUA = ua.toLowerCase();
  const lowercaseVendor = vendor.toLowerCase();
  let browser = 'unknown';
  let version = 'unknown';
  
  // Chrome detection
  if (lowercaseUA.indexOf('chrome') > -1 && lowercaseVendor.indexOf('google') > -1) {
    browser = 'Chrome';
    const match = lowercaseUA.match(/chrome\/(\d+\.\d+)/);
    if (match) version = match[1];
  } 
  // Firefox detection
  else if (lowercaseUA.indexOf('firefox') > -1) {
    browser = 'Firefox';
    const match = lowercaseUA.match(/firefox\/(\d+\.\d+)/);
    if (match) version = match[1];
  } 
  // Safari detection
  else if (lowercaseUA.indexOf('safari') > -1 && lowercaseUA.indexOf('chrome') === -1) {
    browser = 'Safari';
    const match = lowercaseUA.match(/version\/(\d+\.\d+)/);
    if (match) version = match[1];
  } 
  // Edge detection
  else if (lowercaseUA.indexOf('edge') > -1 || lowercaseUA.indexOf('edg/') > -1) {
    browser = 'Edge';
    const match = lowercaseUA.match(/edge\/(\d+\.\d+)/) || lowercaseUA.match(/edg\/(\d+\.\d+)/);
    if (match) version = match[1];
  } 
  // IE detection
  else if (lowercaseUA.indexOf('trident') > -1) {
    browser = 'Internet Explorer';
    const match = lowercaseUA.match(/rv:(\d+\.\d+)/);
    if (match) version = match[1];
  }
  
  return { name: browser, version: version };
}

/**
 * Get information about the device hardware
 * 
 * @param {string} ua - User agent string
 * @returns {Object} Hardware information
 */
function getHardwareInfo(ua) {
  const lowercaseUA = ua.toLowerCase();
  const info = {
    model: 'unknown',
    manufacturer: 'unknown',
    cores: navigator.hardwareConcurrency || 'unknown'
  };
  
  // Try to detect iPhone/iPad models
  if (lowercaseUA.indexOf('iphone') >= 0) {
    info.manufacturer = 'Apple';
    info.model = 'iPhone';
  } else if (lowercaseUA.indexOf('ipad') >= 0) {
    info.manufacturer = 'Apple';
    info.model = 'iPad';
  }
  // Try to detect Samsung models
  else if (lowercaseUA.indexOf('samsung') >= 0) {
    info.manufacturer = 'Samsung';
    const match = lowercaseUA.match(/sm-[a-z0-9]+/i);
    if (match) info.model = match[0].toUpperCase();
  }
  // Try to detect Google Pixel
  else if (lowercaseUA.indexOf('pixel') >= 0) {
    info.manufacturer = 'Google';
    const match = lowercaseUA.match(/pixel \d+/i);
    if (match) info.model = match[0];
  }
  
  return info;
}

/**
 * Get information about the GPU
 * 
 * @returns {Object} GPU information
 */
function getGPUInfo() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    return { renderer: 'unknown', vendor: 'unknown' };
  }
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  
  if (!debugInfo) {
    return { renderer: 'unknown', vendor: 'unknown' };
  }
  
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  
  return { renderer, vendor };
}

/**
 * Test the device performance
 * 
 * @returns {Promise<Object>} Performance metrics
 */
export function testDevicePerformance() {
  return new Promise(resolve => {
    const metrics = {
      fpsEstimate: 0,
      processingPower: 0,
      renderingCapability: 0,
      memoryLimits: 0,
      overall: 0
    };
    
    // Start time for FPS estimation
    const startTime = performance.now();
    let frames = 0;
    let testDuration = 1000; // 1 second test
    
    // Create a simple rendering test
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Test processing power (math operations)
    let processingStart = performance.now();
    let operationsCount = 0;
    const targetOperations = 1000000;
    
    while (operationsCount < targetOperations && performance.now() - processingStart < 200) {
      Math.sin(operationsCount) * Math.cos(operationsCount);
      Math.sqrt(operationsCount);
      operationsCount++;
    }
    
    const processingTime = performance.now() - processingStart;
    metrics.processingPower = Math.min(100, Math.floor((operationsCount / targetOperations) * 100));
    
    // Test memory allocation
    try {
      let memory = [];
      let allocated = 0;
      const chunkSize = 1000000; // 1MB chunks
      const memoryStart = performance.now();
      
      // Try to allocate up to 200MB or 500ms
      while (allocated < 200 && performance.now() - memoryStart < 500) {
        memory.push(new Array(chunkSize).fill(0));
        allocated++;
      }
      
      metrics.memoryLimits = Math.min(100, allocated / 2);
      memory = null; // Free memory
    } catch (e) {
      metrics.memoryLimits = 10; // Very limited memory
    }
    
    // Animation frame function for FPS testing
    function testFrame() {
      frames++;
      
      // Simple rendering test
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw 100 random shapes
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.5)`;
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width, 
          Math.random() * canvas.height, 
          Math.random() * 50, 
          0, 
          Math.PI * 2
        );
        ctx.fill();
      }
      
      const elapsed = performance.now() - startTime;
      
      if (elapsed < testDuration) {
        requestAnimationFrame(testFrame);
      } else {
        // Calculate FPS and other metrics
        metrics.fpsEstimate = Math.floor(frames / (elapsed / 1000));
        metrics.renderingCapability = Math.min(100, Math.floor((metrics.fpsEstimate / 60) * 100));
        
        // Calculate overall performance score (weighted average)
        metrics.overall = Math.floor(
          (metrics.processingPower * 0.3) + 
          (metrics.renderingCapability * 0.4) + 
          (metrics.memoryLimits * 0.3)
        );
        
        resolve(metrics);
      }
    }
    
    // Start the test
    requestAnimationFrame(testFrame);
  });
}

/**
 * Get device capabilities
 * 
 * @returns {Object} Device capabilities
 */
export function getDeviceCapabilities() {
  return {
    // WebGL support
    webgl: !!window.WebGLRenderingContext,
    webgl2: !!window.WebGL2RenderingContext,
    
    // Audio/Video capabilities
    audioContext: !!window.AudioContext || !!window.webkitAudioContext,
    webAudio: !!window.AudioContext || !!window.webkitAudioContext,
    
    // Input capabilities
    touch: 'ontouchstart' in window,
    multitouch: navigator.maxTouchPoints > 1,
    gamepad: !!navigator.getGamepads,
    
    // Sensors
    deviceMotion: !!window.DeviceMotionEvent,
    deviceOrientation: !!window.DeviceOrientationEvent,
    geolocation: !!navigator.geolocation,
    
    // Storage
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    indexedDB: !!window.indexedDB,
    
    // Network
    webSockets: !!window.WebSocket,
    
    // Media
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    
    // Misc
    serviceWorker: 'serviceWorker' in navigator,
    webWorker: !!window.Worker,
    requestAnimationFrame: !!window.requestAnimationFrame,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

/**
 * Get battery status if available
 * 
 * @returns {Promise<Object|null>} Battery information or null if not available
 */
export function getBatteryStatus() {
  if (navigator.getBattery) {
    return navigator.getBattery().then(battery => ({
      level: battery.level,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime
    })).catch(() => null);
  }
  return Promise.resolve(null);
}

/**
 * Detect if battery saving is recommended
 * Checks battery level, performance, and user preferences
 * 
 * @returns {Promise<boolean>} True if battery saving is recommended
 */
export async function shouldUseBatterySaving() {
  // Check if user has requested reduced motion/data
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersReducedData = navigator.connection && navigator.connection.saveData;
  
  if (prefersReducedMotion || prefersReducedData) {
    return true;
  }
  
  // Check battery status
  const battery = await getBatteryStatus();
  if (battery && !battery.charging && battery.level < 0.3) {
    return true;
  }
  
  // Check if it's a low-end device
  const deviceInfo = await getMobileDeviceInfo();
  if (deviceInfo.isLowEndDevice) {
    return true;
  }
  
  return false;
}

/**
 * Add a listener for battery status changes
 * 
 * @param {Function} callback - Function to call when battery status changes
 * @returns {Promise<Function|null>} Function to remove listener or null if not supported
 */
export async function addBatteryStatusListener(callback) {
  if (!navigator.getBattery) {
    return null;
  }
  
  try {
    const battery = await navigator.getBattery();
    
    const handleChange = () => {
      callback({
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      });
    };
    
    // Listen for all battery events
    battery.addEventListener('levelchange', handleChange);
    battery.addEventListener('chargingchange', handleChange);
    battery.addEventListener('chargingtimechange', handleChange);
    battery.addEventListener('dischargingtimechange', handleChange);
    
    // Return function to remove listeners
    return () => {
      battery.removeEventListener('levelchange', handleChange);
      battery.removeEventListener('chargingchange', handleChange);
      battery.removeEventListener('chargingtimechange', handleChange);
      battery.removeEventListener('dischargingtimechange', handleChange);
    };
  } catch (error) {
    console.warn('Battery status API error:', error);
    return null;
  }
}
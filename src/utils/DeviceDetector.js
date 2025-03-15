/**
 * DeviceDetector.js
 * Utility for detecting device types and handling responsive design adaptations
 */

/**
 * Detects if the current device is a mobile device
 * Uses multiple detection methods for reliability
 * @returns {boolean} True if the device is mobile, false otherwise
 */
function isMobileDevice() {
  // Method 1: Check for touch capability
  const hasTouchCapability = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 || 
                           navigator.msMaxTouchPoints > 0;
  
  // Method 2: Check user agent for mobile patterns
  const userAgentMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Method 3: Check screen size (generally mobile devices are smaller)
  // This is a simple heuristic and might need adjustment
  const hasSmallScreen = window.innerWidth <= 1024;
  
  // Consider a device mobile if it has touch capabilities AND either matches mobile user agent OR has small screen
  return hasTouchCapability && (userAgentMatch || hasSmallScreen);
}

/**
 * Get the current device orientation
 * @returns {string} 'portrait' or 'landscape'
 */
function getDeviceOrientation() {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * Add an event listener for orientation changes
 * @param {Function} callback Function to call when orientation changes
 * @returns {Function} Function to remove the listener
 */
function addOrientationChangeListener(callback) {
  const handler = () => {
    const orientation = getDeviceOrientation();
    callback(orientation);
  };
  
  // Listen for both resize and orientationchange events for better coverage
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  
  // Return a function to remove the listeners
  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
  };
}

/**
 * Get mobile-specific device information with enhanced details
 * Useful for detailed analytics or device-specific adjustments
 * @returns {Object} Device information
 */
function getMobileDeviceInfo() {
  const ua = navigator.userAgent;
  const platformInfo = navigator.platform || '';
  
  // Base device info
  const deviceInfo = {
    isMobile: isMobileDevice(),
    orientation: getDeviceOrientation(),
    hasTouch: 'ontouchstart' in window,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    screenAspectRatio: window.innerWidth / window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
    isAndroid: /Android/.test(ua),
    isWindowsPhone: /Windows Phone/.test(ua),
    isSamsung: /SM-|SAMSUNG/.test(ua),
    os: 'Unknown',
    version: 'Unknown',
    browser: 'Unknown',
    browserVersion: 'Unknown',
    isLowEndDevice: false,
    batteryLevel: null,
    isLowPowerMode: false,
    hasGyroscope: false,
    hasPressureSensor: false,
    hasProximitySensor: false,
    cpu: {
      cores: navigator.hardwareConcurrency || 1,
      architecture: /arm|aarch64|iPad|iPhone|iPod/.test(ua) ? 'ARM' : 'x86'
    },
    memory: navigator.deviceMemory || 4, // Default to 4GB if not available
    connection: navigator.connection ? {
      type: navigator.connection.effectiveType || 'unknown',
      downlink: navigator.connection.downlink || 0,
      rtt: navigator.connection.rtt || 0,
      saveData: navigator.connection.saveData || false
    } : null
  };
  
  // Detailed OS version detection
  if (deviceInfo.isIOS) {
    deviceInfo.os = 'iOS';
    // Extract iOS version
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      deviceInfo.version = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
    
    // Identify specific device models
    if (/iPhone/.test(ua)) {
      deviceInfo.model = 'iPhone';
      // Try to identify iPhone model based on screen size and device pixel ratio
      if (window.screen) {
        const { width, height } = window.screen;
        const maxDim = Math.max(width, height);
        const minDim = Math.min(width, height);
        const dpr = window.devicePixelRatio || 1;
        
        if (maxDim === 896 && minDim === 414) {
          deviceInfo.model = dpr === 3 ? 'iPhone 11' : 'iPhone XR';
        } else if (maxDim === 812 && minDim === 375) {
          deviceInfo.model = 'iPhone X/XS/11 Pro';
        } else if (maxDim === 926 && minDim === 428) {
          deviceInfo.model = 'iPhone 12/13 Pro Max';
        }
      }
    } else if (/iPad/.test(ua)) {
      deviceInfo.model = 'iPad';
    } else if (/iPod/.test(ua)) {
      deviceInfo.model = 'iPod';
    }
  } else if (deviceInfo.isAndroid) {
    deviceInfo.os = 'Android';
    // Extract Android version
    const match = ua.match(/Android (\d+)\.(\d+)(\.(\d+))?/);
    if (match) {
      deviceInfo.version = `${match[1]}.${match[2]}${match[4] ? `.${match[4]}` : ''}`;
    }
    
    // Try to identify Android device model
    const modelMatch = ua.match(/;\s([^;]+)\sBuild\//) || ua.match(/;\s([^;]+);\s[a-zA-Z0-9]+\)/) || ua.match(/\(([^;]+);\s[a-zA-Z0-9]+\)/);
    if (modelMatch && modelMatch[1]) {
      deviceInfo.model = modelMatch[1].trim();
    }
  } else if (deviceInfo.isWindowsPhone) {
    deviceInfo.os = 'Windows Phone';
    const match = ua.match(/Windows Phone (\d+)\.(\d+)/);
    if (match) {
      deviceInfo.version = `${match[1]}.${match[2]}`;
    }
  } else if (/Windows/.test(ua)) {
    deviceInfo.os = 'Windows';
    if (/Windows NT 10\.0/.test(ua)) {
      deviceInfo.version = '10';
    } else if (/Windows NT 6\.3/.test(ua)) {
      deviceInfo.version = '8.1';
    } else if (/Windows NT 6\.2/.test(ua)) {
      deviceInfo.version = '8';
    } else if (/Windows NT 6\.1/.test(ua)) {
      deviceInfo.version = '7';
    }
  } else if (/Macintosh/.test(ua)) {
    deviceInfo.os = 'macOS';
    const match = ua.match(/Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/);
    if (match) {
      deviceInfo.version = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
  } else if (/Linux/.test(ua) || /X11/.test(ua)) {
    deviceInfo.os = 'Linux';
  }
  
  // Browser detection
  if (/Chrome/.test(ua) && !/Chromium|Edge|Edg|OPR|CriOS/.test(ua)) {
    deviceInfo.browser = 'Chrome';
    const match = ua.match(/Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      deviceInfo.browserVersion = `${match[1]}.${match[2]}.${match[3]}`;
    }
  } else if (/Firefox|FxiOS/.test(ua)) {
    deviceInfo.browser = 'Firefox';
    const match = ua.match(/Firefox\/(\d+)\.(\d+)/);
    if (match) {
      deviceInfo.browserVersion = `${match[1]}.${match[2]}`;
    }
  } else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|Edg|OPR|CriOS/.test(ua)) {
    deviceInfo.browser = 'Safari';
    const match = ua.match(/Version\/(\d+)\.(\d+)\.?(\d+)?/);
    if (match) {
      deviceInfo.browserVersion = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
  } else if (/MSIE|Trident|IEMobile/.test(ua)) {
    deviceInfo.browser = 'Internet Explorer';
    const match = ua.match(/MSIE (\d+)\.(\d+)/);
    if (match) {
      deviceInfo.browserVersion = `${match[1]}.${match[2]}`;
    } else {
      // For IE 11, which doesn't use MSIE token
      const tridentMatch = ua.match(/Trident\/(\d+)\.(\d+)/);
      if (tridentMatch) {
        deviceInfo.browserVersion = '11.0'; // IE 11
      }
    }
  } else if (/Edge|Edg/.test(ua)) {
    deviceInfo.browser = 'Edge';
    const match = ua.match(/Edge\/(\d+)\.(\d+)/) || ua.match(/Edg\/(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      deviceInfo.browserVersion = match[1] ? `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}` : '';
    }
  } else if (/OPR|Opera/.test(ua)) {
    deviceInfo.browser = 'Opera';
    const match = ua.match(/OPR\/(\d+)\.(\d+)\.(\d+)/) || ua.match(/Opera\/(\d+)\.(\d+)/);
    if (match) {
      deviceInfo.browserVersion = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
  }
  
  // Detect low-end device based on available metrics
  deviceInfo.isLowEndDevice = 
    (deviceInfo.memory && deviceInfo.memory < 2) || // Less than 2GB RAM
    (deviceInfo.cpu.cores && deviceInfo.cpu.cores <= 2) || // 2 cores or less
    (deviceInfo.connection && 
     (deviceInfo.connection.effectiveType === 'slow-2g' || 
      deviceInfo.connection.effectiveType === '2g'));
  
  // Try to access battery information if available
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      deviceInfo.batteryLevel = battery.level;
      deviceInfo.isCharging = battery.charging;
      
      // Consider low power mode if battery is below 20% and not charging
      deviceInfo.isLowPowerMode = (battery.level < 0.2 && !battery.charging);
    }).catch(() => {
      // Battery API access failed
    });
  }
  
  // Check for sensor availability
  deviceInfo.hasGyroscope = window.DeviceOrientationEvent !== undefined;
  
  // Detect WebGL capabilities for performance assessment
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      deviceInfo.gpuInfo = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        webglVersion: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions().length
      };
    }
  } catch (e) {
    // WebGL detection failed
  }
  
  return deviceInfo;
}

/**
 * Test device performance with a lightweight benchmark
 * @returns {Promise<Object>} Performance metrics
 */
function testDevicePerformance() {
  return new Promise(resolve => {
    const metrics = {
      computeScore: 0,
      renderingScore: 0,
      memoryScore: 0,
      storageScore: 0,
      overall: 0,
      category: 'unknown'
    };
    
    // Start compute test
    const startTime = performance.now();
    
    // Simple compute test - non-blocking
    setTimeout(() => {
      // Compute benchmarking - simple calculations
      try {
        let result = 0;
        const iterations = 10000;
        
        for (let i = 0; i < iterations; i++) {
          result += Math.sqrt(i) * Math.sin(i) / Math.cos(i);
        }
        
        const computeTime = performance.now() - startTime;
        metrics.computeScore = Math.min(100, Math.max(0, 100 - (computeTime / 50)));
        
        // Simple rendering test
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        
        const renderStart = performance.now();
        
        // Draw 500 random shapes
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
          ctx.beginPath();
          ctx.arc(Math.random() * 300, Math.random() * 300, Math.random() * 20, 0, Math.PI * 2);
          ctx.fill();
        }
        
        const renderTime = performance.now() - renderStart;
        metrics.renderingScore = Math.min(100, Math.max(0, 100 - (renderTime / 20)));
        
        // Memory benchmark - estimate available memory
        metrics.memoryScore = navigator.deviceMemory 
          ? Math.min(100, navigator.deviceMemory * 12.5) // 8GB+ = 100 score
          : 50; // Default if not available
        
        // Storage benchmark - test localStorage performance
        const storageStart = performance.now();
        const testSize = 100;
        const storageTestKey = '_device_detector_test';
        
        try {
          const dataToStore = new Array(testSize).fill('X').join('');
          localStorage.setItem(storageTestKey, dataToStore);
          const readValue = localStorage.getItem(storageTestKey);
          localStorage.removeItem(storageTestKey);
          
          const storageTime = performance.now() - storageStart;
          metrics.storageScore = Math.min(100, Math.max(0, 100 - (storageTime / 5)));
        } catch (e) {
          metrics.storageScore = 30; // Low score if storage access fails
        }
        
        // Calculate overall score
        metrics.overall = (metrics.computeScore + metrics.renderingScore + metrics.memoryScore + metrics.storageScore) / 4;
        
        // Categorize performance
        if (metrics.overall >= 70) {
          metrics.category = 'high';
        } else if (metrics.overall >= 40) {
          metrics.category = 'medium';
        } else {
          metrics.category = 'low';
        }
        
        // Return the metrics
        resolve(metrics);
      } catch (e) {
        // If benchmark fails, return default medium values
        resolve({
          computeScore: 50,
          renderingScore: 50,
          memoryScore: 50,
          storageScore: 50,
          overall: 50,
          category: 'medium',
          error: e.message
        });
      }
    }, 0); // Use setTimeout to avoid blocking the UI
  });
}

/**
 * Get device features and capabilities
 * @returns {Object} Device capabilities
 */
function getDeviceCapabilities() {
  return {
    webgl: !!window.WebGLRenderingContext,
    webgl2: !!window.WebGL2RenderingContext,
    canvas: !!window.CanvasRenderingContext2D,
    webAudio: !!window.AudioContext || !!window.webkitAudioContext,
    geolocation: !!navigator.geolocation,
    touchscreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    deviceMotion: !!window.DeviceMotionEvent,
    deviceOrientation: !!window.DeviceOrientationEvent,
    vibration: !!navigator.vibrate,
    ambientLight: !!window.AmbientLightSensor,
    batteryApi: !!navigator.getBattery,
    storageEstimate: !!(navigator.storage && navigator.storage.estimate),
    serviceWorker: 'serviceWorker' in navigator,
    indexedDb: !!window.indexedDB,
    webWorkers: !!window.Worker,
    sharedWorkers: !!window.SharedWorker,
    webSockets: !!window.WebSocket,
    webRtc: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection),
    webVr: !!navigator.getVRDisplays,
    webXr: !!navigator.xr,
    gamepad: !!navigator.getGamepads,
    bluetooth: !!navigator.bluetooth,
    usb: !!navigator.usb,
    notifications: 'Notification' in window,
    mediaRecorder: !!window.MediaRecorder,
    fullscreen: !!(document.documentElement.requestFullscreen || 
                document.documentElement.webkitRequestFullScreen || 
                document.documentElement.mozRequestFullScreen || 
                document.documentElement.msRequestFullscreen),
    screenWakeLock: 'wakeLock' in navigator,
    speech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    clipboard: !!(navigator.clipboard && navigator.clipboard.writeText),
    pointerLock: 'pointerLockElement' in document
  };
}

// Export utility functions
export {
  isMobileDevice,
  getDeviceOrientation,
  addOrientationChangeListener,
  getMobileDeviceInfo,
  testDevicePerformance,
  getDeviceCapabilities
}; 
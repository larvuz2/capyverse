/**
 * MobileDebugger.js
 * Utility for debugging on mobile devices
 * Shows console logs, errors, and warnings in a UI panel
 */

import { isMobileDevice } from './DeviceDetector.js';

// Store for captured logs
let capturedLogs = [];
let capturedErrors = [];
let isDebugPanelVisible = false;

/**
 * Initialize the mobile debugger
 * Only shows on mobile devices
 */
export function initMobileDebugger() {
  // Only show on mobile devices
  if (!isMobileDevice()) {
    return;
  }

  // Show the debug container
  const debugContainer = document.getElementById('debug-container');
  if (debugContainer) {
    debugContainer.style.display = 'block';
  }

  // Set up debug button
  const debugButton = document.getElementById('debug-button');
  const debugPanel = document.getElementById('debug-panel');
  
  if (debugButton && debugPanel) {
    debugButton.addEventListener('click', () => {
      isDebugPanelVisible = !isDebugPanelVisible;
      debugPanel.style.display = isDebugPanelVisible ? 'block' : 'none';
      updateDebugPanel();
    });
  }

  // Set up console interceptors
  setupConsoleInterceptors();
  
  // Set up error handler
  window.addEventListener('error', captureError);
  window.addEventListener('unhandledrejection', capturePromiseError);
  
  // Setup WebGL context monitoring
  setupWebGLMonitoring();
  
  // Initial update
  updateDebugPanel();
}

/**
 * Set up monitoring for WebGL context
 */
function setupWebGLMonitoring() {
  // Find the WebGL renderer (Three.js canvas)
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach((canvas, index) => {
    try {
      // Try to get context
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        // Log WebGL capabilities
        logWebGLInfo(gl, index);
        
        // Monitor for context lost
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          logToDebugPanel(`WebGL context lost on canvas #${index}`, 'error');
        });
        
        // Monitor for context restored
        canvas.addEventListener('webglcontextrestored', () => {
          logToDebugPanel(`WebGL context restored on canvas #${index}`, 'info');
        });
      }
    } catch (e) {
      logToDebugPanel(`Error accessing WebGL context: ${e.message}`, 'error');
    }
  });
}

/**
 * Log WebGL information
 */
function logWebGLInfo(gl, canvasIndex) {
  try {
    const info = {
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
    };
    
    logToDebugPanel(`WebGL canvas #${canvasIndex} info:`, 'info');
    logToDebugPanel(`Renderer: ${info.renderer}`, 'info');
    logToDebugPanel(`Vendor: ${info.vendor}`, 'info');
    logToDebugPanel(`Version: ${info.version}`, 'info');
    
    // Check for potential issues
    if (info.maxTextureSize < 2048) {
      logToDebugPanel(`Warning: Low max texture size (${info.maxTextureSize})`, 'warn');
    }
    
    // Check for WebGL extensions
    const extensions = gl.getSupportedExtensions();
    const criticalExtensions = [
      'ANGLE_instanced_arrays',
      'OES_element_index_uint',
      'OES_standard_derivatives',
      'OES_texture_float',
      'OES_vertex_array_object',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_depth_texture'
    ];
    
    const missingExtensions = criticalExtensions.filter(ext => !extensions.includes(ext));
    if (missingExtensions.length > 0) {
      logToDebugPanel(`Missing WebGL extensions: ${missingExtensions.join(', ')}`, 'warn');
    }
  } catch (error) {
    logToDebugPanel(`Error analyzing WebGL context: ${error.message}`, 'error');
  }
}

/**
 * Set up console interceptors to capture logs
 */
function setupConsoleInterceptors() {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  // Intercept console.log
  console.log = function(...args) {
    capturedLogs.push({
      type: 'log',
      message: args.map(arg => formatArg(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    updateDebugPanel();
    originalConsole.log.apply(console, args);
  };

  // Intercept console.error
  console.error = function(...args) {
    capturedLogs.push({
      type: 'error',
      message: args.map(arg => formatArg(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    updateDebugPanel();
    originalConsole.error.apply(console, args);
  };

  // Intercept console.warn
  console.warn = function(...args) {
    capturedLogs.push({
      type: 'warn',
      message: args.map(arg => formatArg(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    updateDebugPanel();
    originalConsole.warn.apply(console, args);
  };

  // Intercept console.info
  console.info = function(...args) {
    capturedLogs.push({
      type: 'info',
      message: args.map(arg => formatArg(arg)).join(' '),
      timestamp: new Date().toISOString()
    });
    updateDebugPanel();
    originalConsole.info.apply(console, args);
  };
}

/**
 * Format argument for display
 */
function formatArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return Object.prototype.toString.call(arg);
    }
  }
  
  return String(arg);
}

/**
 * Capture errors from window.onerror
 */
function captureError(event) {
  const error = {
    message: event.message || 'Unknown error',
    source: event.filename || 'Unknown source',
    lineno: event.lineno || 'Unknown line',
    colno: event.colno || 'Unknown column',
    timestamp: new Date().toISOString()
  };
  
  capturedErrors.push(error);
  updateDebugPanel();
}

/**
 * Capture unhandled promise rejections
 */
function capturePromiseError(event) {
  const error = {
    message: event.reason ? (event.reason.message || 'Unhandled Promise Rejection') : 'Unhandled Promise Rejection',
    source: 'Promise',
    timestamp: new Date().toISOString()
  };
  
  capturedErrors.push(error);
  updateDebugPanel();
}

/**
 * Update the debug panel with current logs and errors
 */
function updateDebugPanel() {
  if (!isDebugPanelVisible) return;
  
  const debugPanel = document.getElementById('debug-panel');
  if (!debugPanel) return;
  
  // Build HTML content
  let html = '<h3>Errors</h3>';
  
  if (capturedErrors.length === 0) {
    html += '<p>No errors captured</p>';
  } else {
    html += '<ul>';
    capturedErrors.slice(-10).forEach(error => {
      html += `<li style="color: red;">
        <strong>${error.timestamp.split('T')[1].split('.')[0]}</strong>: 
        ${error.message} 
        <br><small>(${error.source}:${error.lineno}:${error.colno})</small>
      </li>`;
    });
    html += '</ul>';
  }
  
  html += '<h3>Console Logs</h3>';
  
  if (capturedLogs.length === 0) {
    html += '<p>No logs captured</p>';
  } else {
    html += '<ul>';
    capturedLogs.slice(-15).forEach(log => {
      const color = log.type === 'error' ? 'red' : 
                   log.type === 'warn' ? 'orange' : 
                   log.type === 'info' ? 'lightblue' : 'white';
      
      html += `<li style="color: ${color};">
        <strong>${log.timestamp.split('T')[1].split('.')[0]}</strong>: 
        ${log.message}
      </li>`;
    });
    html += '</ul>';
  }
  
  // Add a clear button
  html += '<button id="clear-debug" style="margin-top:10px;padding:5px;">Clear Logs</button>';
  
  // Update panel content
  debugPanel.innerHTML = html;
  
  // Add event listener for clear button
  const clearButton = document.getElementById('clear-debug');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      capturedLogs = [];
      capturedErrors = [];
      updateDebugPanel();
    });
  }
  
  // Auto scroll to bottom
  debugPanel.scrollTop = debugPanel.scrollHeight;
}

/**
 * Add a log message directly to the debug panel
 */
export function logToDebugPanel(message, type = 'log') {
  capturedLogs.push({
    type,
    message: String(message),
    timestamp: new Date().toISOString()
  });
  
  updateDebugPanel();
}

/**
 * Clear all logs and errors
 */
export function clearDebugLogs() {
  capturedLogs = [];
  capturedErrors = [];
  updateDebugPanel();
} 
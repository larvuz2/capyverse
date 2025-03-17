// Configuration settings for the Capyverse game

// Determine the WebSocket server URL based on environment
const getServerUrl = () => {
  // When running in production (Render.com), use the deployed URL
  if (import.meta.env.PROD) {
    // Use the actual Render.com URL
    return 'https://capyverse.onrender.com';
  }
  
  // When running locally in development
  return 'http://localhost:3000';
};

// Configure WASM loading paths based on environment
const getWasmConfig = () => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  return {
    // Path to WASM file - adjust path based on environment
    wasmPath: import.meta.env.PROD ? 
      `${baseUrl}assets/` : 
      '/node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm',
    
    // Enable debug mode for WASM loading
    debug: import.meta.env.DEV || import.meta.env.VITE_DEBUG_WASM === 'true',
    
    // Number of retry attempts for WASM loading
    maxRetries: 3,
    
    // Delay between retries in milliseconds (starts with this value, then increases)
    retryDelay: 1000,
  };
};

export const SERVER_URL = getServerUrl();
export const WASM_CONFIG = getWasmConfig(); 
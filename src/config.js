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

export const SERVER_URL = getServerUrl(); 
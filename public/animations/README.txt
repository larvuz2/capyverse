This directory should contain the animation files:
- idle.glb: Played when the character is stationary on the ground
- walk.glb: Played when the character is moving on the ground
- jump.glb: Played when the character is airborne (jumping) - If this file is missing, the walk animation will be used as a fallback

Each animation file should contain a single animation clip that will be applied to the capybara character model. 

Note: The application is designed to gracefully handle missing animation files, so it will still work even if some animations aren't available yet. 
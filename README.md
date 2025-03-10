# Capyverse

A 3D capybara character controller built with Three.js and Rapier physics.

## Features

- 3D capybara character with physics-based movement
- WASD controls for movement
- Space bar for jumping
- Heavy gravity for realistic physics
- Advanced third-person camera system with adjustable settings
- GUI controls for camera customization

## Controls

- **W**: Move forward
- **A**: Move left
- **S**: Move backward
- **D**: Move right
- **Space**: Jump
- **Q**: Rotate camera left
- **E**: Rotate camera right

## Camera Settings

The camera can be adjusted using the GUI panel:
- **Distance**: How far the camera is from the character
- **Height**: How high the camera is positioned above the character
- **Look At Height**: Where the camera looks at (vertical offset)
- **Smoothing**: How smoothly the camera follows the character
- **Rotation Speed**: How quickly the camera rotates when using Q/E keys

## Development

This project uses Vite for fast development and building.

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

```bash
# Install dependencies
npm install
```

### Running locally

```bash
# Start development server
npm run dev
```

### Building for production

```bash
# Build for production
npm run build
```

## Technologies Used

- [Three.js](https://threejs.org/) - 3D library
- [Rapier](https://rapier.rs/) - Physics engine
- [Vite](https://vitejs.dev/) - Build tool
- [lil-gui](https://lil-gui.georgealways.com/) - GUI controls

## License

MIT
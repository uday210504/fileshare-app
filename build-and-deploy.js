const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const frontendDir = path.join(__dirname, 'frontend');
const backendDir = path.join(__dirname, 'backend');
const publicDir = path.join(backendDir, 'public');

// Ensure the public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Build the frontend
console.log('Building the frontend...');
try {
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
  console.log('Frontend build completed successfully.');
} catch (error) {
  console.error('Error building the frontend:', error);
  process.exit(1);
}

// Copy the build files to the backend's public directory
console.log('Copying build files to the backend...');
try {
  // Get the build directory path
  const buildDir = path.join(frontendDir, 'dist');
  
  // Copy all files from the build directory to the public directory
  copyDirectory(buildDir, publicDir);
  
  console.log('Files copied successfully.');
} catch (error) {
  console.error('Error copying files:', error);
  process.exit(1);
}

console.log('Deployment preparation completed!');
console.log('You can now start the server with: node backend/server.js');

// Helper function to copy a directory recursively
function copyDirectory(source, destination) {
  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  // Get all files and directories in the source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  // Copy each entry
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy directories
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

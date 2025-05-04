const { execSync } = require('child_process');

try {
  console.log('Starting GitHub push process...');
  
  // Add all files
  console.log('\nAdding all files...');
  execSync('git add .gitignore .node-version build-and-deploy.js deploy.js DEPLOYMENT.md GITHUB_SETUP.md nixpacks.toml package.json Procfile railway.json railway.toml README.md render.yaml', { stdio: 'inherit' });
  
  // Add backend files
  console.log('\nAdding backend files...');
  execSync('git add backend/.env backend/package.json backend/package-lock.json backend/Procfile backend/server.js', { stdio: 'inherit' });
  
  // Add frontend files
  console.log('\nAdding frontend files...');
  execSync('git add frontend/.env.production frontend/.gitignore frontend/eslint.config.js frontend/index.html frontend/package.json frontend/package-lock.json frontend/README.md frontend/vercel.json frontend/vite.config.js', { stdio: 'inherit' });
  
  // Commit changes
  console.log('\nCommitting changes...');
  execSync('git commit -m "Push all project files"', { stdio: 'inherit' });
  
  // Push to GitHub
  console.log('\nPushing to GitHub...');
  execSync('git push -f origin main', { stdio: 'inherit' });
  
  console.log('\nPush completed successfully!');
} catch (error) {
  console.error('Error during push process:', error.message);
  process.exit(1);
}

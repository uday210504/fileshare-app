const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = 'https://file-upload.up.railway.app';
const FRONTEND_URL = 'https://fileshare-app-eight.vercel.app';

console.log('Starting deployment preparation...');

// Update frontend configuration
console.log('\nUpdating frontend configuration...');

// Update .env.production
const envPath = path.join(__dirname, 'frontend', '.env.production');
fs.writeFileSync(envPath, `VITE_API_URL=${BACKEND_URL}\n`);
console.log('Updated .env.production');

// Update vercel.json
const vercelConfigPath = path.join(__dirname, 'frontend', 'vercel.json');
const vercelConfig = {
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": `${BACKEND_URL}/api/:path*`
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
};
fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2));
console.log('Updated vercel.json');

// Update backend configuration
console.log('\nUpdating backend configuration...');

// Update .env
const backendEnvPath = path.join(__dirname, 'backend', '.env');
fs.writeFileSync(backendEnvPath, `PORT=5000\nFRONTEND_URL=${FRONTEND_URL}\n`);
console.log('Updated backend .env');

console.log('\nDeployment preparation complete!');
console.log('\nNext steps:');
console.log('1. Commit and push these changes to your repository');
console.log('2. Railway will automatically redeploy your backend');
console.log('3. Manually redeploy your frontend on Vercel if needed');
console.log('\nYour application URLs:');
console.log(`Backend: ${BACKEND_URL}`);
console.log(`Frontend: ${FRONTEND_URL}`);

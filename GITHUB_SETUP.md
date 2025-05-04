# GitHub Repository Setup Guide

This guide will walk you through setting up a GitHub repository for your FileShare application and preparing it for deployment.

## Creating a GitHub Repository

1. **Sign in to GitHub**
   - Go to https://github.com and sign in to your account

2. **Create a new repository**
   - Click on the "+" icon in the top-right corner
   - Select "New repository"
   - Name your repository (e.g., "fileshare-app")
   - Add a description (optional)
   - Choose whether to make it public or private
   - Click "Create repository"

3. **Initialize your local repository**
   - Open a terminal in your project directory
   - Run the following commands:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/fileshare-app.git
   git push -u origin main
   ```

   - Replace `yourusername/fileshare-app.git` with your actual repository URL

## Preparing for Deployment

1. **Create a .gitignore file**
   - Create a file named `.gitignore` in the root directory
   - Add the following content:

   ```
   # Node.js
   node_modules/
   npm-debug.log
   yarn-debug.log
   yarn-error.log

   # Environment variables
   .env
   .env.local
   .env.development.local
   .env.test.local
   .env.production.local

   # Build files
   frontend/dist/
   backend/public/

   # Uploads
   backend/uploads/

   # Database
   backend/db.json

   # Logs
   logs
   *.log

   # OS files
   .DS_Store
   Thumbs.db
   ```

2. **Commit and push your changes**
   ```bash
   git add .gitignore
   git commit -m "Add .gitignore file"
   git push
   ```

3. **Create necessary directories**
   - Make sure the following directories exist:
     - `backend/uploads`
     - `backend/public`

   ```bash
   mkdir -p backend/uploads backend/public
   touch backend/uploads/.gitkeep backend/public/.gitkeep
   git add backend/uploads/.gitkeep backend/public/.gitkeep
   git commit -m "Add empty directories with .gitkeep"
   git push
   ```

## Repository Structure

Your repository should have the following structure:

```
fileshare-app/
├── backend/
│   ├── node_modules/
│   ├── public/
│   ├── uploads/
│   ├── .env
│   ├── db.json
│   ├── package.json
│   ├── package-lock.json
│   ├── Procfile
│   └── server.js
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   ├── .env.production
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vercel.json
│   └── vite.config.js
├── .gitignore
├── build-and-deploy.js
├── DEPLOYMENT.md
├── GITHUB_SETUP.md
├── package.json
└── README.md
```

## Next Steps

Once your repository is set up, you can proceed with deploying your application following the instructions in the `DEPLOYMENT.md` file.

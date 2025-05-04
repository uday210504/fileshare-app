# Deployment Guide for FileShare Application

This guide will walk you through deploying the FileShare application using Vercel for the frontend and a service like Render, Heroku, or Railway for the backend.

## Frontend Deployment with Vercel

### Prerequisites
- A GitHub account
- A Vercel account (sign up at https://vercel.com)

### Steps

1. **Push your code to GitHub**
   - Create a new repository on GitHub
   - Push your code to the repository

2. **Connect Vercel to your GitHub repository**
   - Log in to Vercel
   - Click "Add New" > "Project"
   - Select your GitHub repository
   - Choose the "frontend" directory as the root directory

3. **Configure the project**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Set up environment variables**
   - Add the following environment variable:
     - `VITE_API_URL`: Your backend URL (e.g., https://fileshare-backend.onrender.com)

5. **Update the Vercel configuration**
   - In the `frontend/vercel.json` file, update the API destination:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend-url.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
   - Replace `https://your-backend-url.com` with your actual backend URL

6. **Deploy**
   - Click "Deploy"
   - Wait for the deployment to complete
   - Vercel will provide you with a URL for your frontend (e.g., https://file-share-app.vercel.app)

## Backend Deployment

You have several options for deploying the backend. Here are instructions for three popular services:

### Option 1: Render

1. **Sign up for Render**
   - Create an account at https://render.com

2. **Create a new Web Service**
   - Click "New" > "Web Service"
   - Connect your GitHub repository
   - Choose the "backend" directory as the root directory

3. **Configure the service**
   - Name: fileshare-backend
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`

4. **Set up environment variables**
   - Add the following environment variables:
     - `PORT`: 10000 (Render uses this port by default)
     - `FRONTEND_URL`: Your Vercel frontend URL (e.g., https://file-share-app.vercel.app)

5. **Deploy**
   - Click "Create Web Service"
   - Wait for the deployment to complete
   - Render will provide you with a URL for your backend (e.g., https://fileshare-backend.onrender.com)

### Option 2: Heroku

1. **Sign up for Heroku**
   - Create an account at https://heroku.com

2. **Install the Heroku CLI**
   - Follow the instructions at https://devcenter.heroku.com/articles/heroku-cli

3. **Create a new Heroku app**
   ```bash
   cd backend
   heroku login
   heroku create fileshare-backend
   ```

4. **Set up environment variables**
   ```bash
   heroku config:set FRONTEND_URL=https://file-share-app.vercel.app
   ```

5. **Deploy to Heroku**
   ```bash
   git subtree push --prefix backend heroku main
   ```

6. **Open your app**
   ```bash
   heroku open
   ```

### Option 3: Railway

1. **Sign up for Railway**
   - Create an account at https://railway.app

2. **Create a new project**
   - Click "New Project" > "Deploy from GitHub repo"
   - Connect your GitHub repository
   - Choose the "backend" directory as the root directory

3. **Configure the service**
   - Set the start command to `node server.js`

4. **Set up environment variables**
   - Add the following environment variables:
     - `FRONTEND_URL`: Your Vercel frontend URL (e.g., https://file-share-app.vercel.app)

5. **Deploy**
   - Railway will automatically deploy your app
   - You can find your app URL in the "Settings" tab

## Final Steps

1. **Update the frontend configuration**
   - Once you have your backend URL, go back to your Vercel project
   - Update the `VITE_API_URL` environment variable with your backend URL
   - Update the `vercel.json` file with your backend URL
   - Redeploy the frontend if necessary

2. **Test the application**
   - Visit your frontend URL
   - Try uploading and downloading files
   - Make sure everything works as expected

## Important Notes

1. **File Storage**
   - The current implementation stores files on the server's local filesystem
   - For a production environment, consider using cloud storage like AWS S3, Google Cloud Storage, or Azure Blob Storage
   - Most hosting providers have ephemeral filesystems, meaning files may be lost when the server restarts

2. **Database**
   - The current implementation uses a JSON file as a simple database
   - For a production environment, consider using a proper database like MongoDB, PostgreSQL, or MySQL

3. **Security**
   - Consider implementing user authentication
   - Set up HTTPS for secure connections
   - Implement proper file access controls

4. **Scaling**
   - The current implementation may not scale well for high traffic
   - Consider using a CDN for file delivery
   - Implement caching for frequently accessed files

## Troubleshooting

1. **CORS Issues**
   - If you encounter CORS errors, make sure your backend CORS configuration includes your frontend URL
   - Update the `origin` array in the CORS configuration with your frontend URL

2. **File Upload Issues**
   - Check the file size limit in the backend configuration
   - Make sure the uploads directory exists and is writable

3. **Deployment Issues**
   - Check the logs of your hosting provider for error messages
   - Make sure all environment variables are set correctly


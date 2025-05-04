# FileShare - Web-Based File Sharing Application

A modern web application that allows users to upload files and share them with others using unique codes.

## Live Demo

- **Frontend**: [https://fileshare-app-eight.vercel.app](https://fileshare-app-eight.vercel.app)
- **Backend**: [https://fileshare-app-production.up.railway.app](https://fileshare-app-production.up.railway.app)

## Features

- **File Upload**: Drag and drop interface with progress tracking
- **Unique Codes**: Each file gets a unique code for sharing
- **Easy Download**: Enter a code to download the corresponding file
- **Modern UI**: Clean, responsive design that works on all devices
- **Dark/Light Mode**: Automatically adapts to system preferences

## Technology Stack

- **Frontend**: React with Vite
- **Backend**: Node.js with Express
- **File Storage**: Local file system
- **Styling**: Custom CSS with responsive design

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd file-sharing-app
   ```

2. Install dependencies:
   ```
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   cd ..
   ```

3. Start the development servers:
   ```
   # In one terminal
   npm run dev:backend

   # In another terminal
   npm run dev:frontend
   ```

4. Open your browser and navigate to:
   - Frontend: http://localhost:5173 (or the port shown in your terminal)
   - Backend API: http://localhost:5000

## Deployment

### Local Deployment

To deploy the application locally:

1. Build the frontend and copy to the backend:
   ```
   npm run build
   ```

2. Start the server:
   ```
   npm start
   ```

3. Access the application at http://localhost:5000

### Online Deployment

The application is currently deployed online:

1. **Frontend**: Deployed on Vercel
   - URL: [https://fileshare-app-eight.vercel.app](https://fileshare-app-eight.vercel.app)

2. **Backend**: Deployed on Railway
   - URL: [https://fileshare-app-production.up.railway.app](https://fileshare-app-production.up.railway.app)

To update the deployment:

1. Make your changes to the code
2. Run the deployment script:
   ```
   node deploy.js
   ```
3. Commit and push your changes to GitHub
4. Railway will automatically redeploy the backend
5. Manually trigger a redeployment on Vercel if needed

## Configuration

### File Size Limit

By default, the maximum file size is set to 50MB. To change this:

1. Open `backend/server.js`
2. Find the multer configuration section
3. Modify the `fileSize` parameter:
   ```javascript
   const upload = multer({
     storage,
     limits: {
       fileSize: 50 * 1024 * 1024, // 50MB limit
     }
   });
   ```

### Port Configuration

To change the port:

1. Open `backend/server.js`
2. Modify the PORT variable:
   ```javascript
   const PORT = process.env.PORT || 5000;
   ```

## License

MIT

## Acknowledgements

- React
- Express
- Multer
- React Dropzone
- Axios

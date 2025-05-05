# FileShare - Web-Based File Sharing Application

A modern web application that allows users to upload files and share them with others using unique codes.

## Repository Structure

- `/frontend` - Contains the React frontend application
- `/backend` - Contains the Node.js backend application (in a separate branch)

## Live Demo

- **Frontend**: [https://fileshare-app-eight.vercel.app](https://fileshare-app-eight.vercel.app)
- **Backend**: [https://file-upload.up.railway.app](https://file-upload.up.railway.app)

## Features

- **File Upload**: Drag and drop interface with progress tracking
- **Unique Codes**: Each file gets a unique code for sharing
- **Easy Download**: Enter a code to download the corresponding file
- **Multiple File Uploads**: Upload multiple files at once
- **File Groups**: Group multiple files under a single code
- **File Compression**: Option to compress files before uploading
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
   git clone https://github.com/uday210504/fileshare-app.git
   cd fileshare-app
   ```

2. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

3. Start the frontend development server:
   ```
   npm run dev
   ```

4. In a separate terminal, clone and set up the backend:
   ```
   git clone https://github.com/luffy-sensei05/fileshare-backend.git
   cd fileshare-backend
   npm install
   npm start
   ```

5. Open your browser and navigate to:
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
   - Repository: [https://github.com/uday210504/fileshare-app.git](https://github.com/uday210504/fileshare-app.git)

2. **Backend**: Deployed on Railway
   - URL: [https://file-upload.up.railway.app](https://file-upload.up.railway.app)
   - Repository: [https://github.com/luffy-sensei05/fileshare-backend.git](https://github.com/luffy-sensei05/fileshare-backend.git)

To update the deployment:

1. Make your changes to the code
2. Commit and push your changes to the appropriate GitHub repository:
   ```
   # For frontend changes
   git add .
   git commit -m "Your commit message"
   git push origin main

   # For backend changes
   git add .
   git commit -m "Your commit message"
   git push origin master
   ```
3. Railway will automatically redeploy the backend when changes are pushed to the master branch
4. Vercel will automatically redeploy the frontend when changes are pushed to the main branch

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

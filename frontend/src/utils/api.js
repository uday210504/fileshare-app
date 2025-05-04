import axios from 'axios';

// Create a base API URL that uses the environment variable in production
// or falls back to relative URLs in development
const baseURL = import.meta.env.VITE_API_URL || '';

// Create optimized axios instance with performance enhancements
const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Keep-alive is automatically handled by the browser

  // Set reasonable timeouts
  timeout: 60000, // 60 seconds default timeout

  // Retries are handled in the components for uploads

  // Optimize response handling
  decompress: true, // Handle gzipped responses

  // Optimize for large responses
  maxContentLength: 100 * 1024 * 1024, // 100MB max response size
  maxBodyLength: 100 * 1024 * 1024, // 100MB max request body size
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Log errors but don't expose them to the console in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('API Error:', error);
    }

    // Network errors often don't have response
    if (!error.response) {
      return Promise.reject({
        ...error,
        message: 'Network error. Please check your connection and try again.'
      });
    }

    return Promise.reject(error);
  }
);

export default api;

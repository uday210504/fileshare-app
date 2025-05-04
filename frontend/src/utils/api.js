import axios from 'axios';

// Create a base API URL that uses the environment variable in production
// or falls back to relative URLs in development
const baseURL = import.meta.env.VITE_API_URL || '';

// Create optimized axios instance with performance enhancements
const api = axios.create({
  baseURL,
  // Don't set default Content-Type header - let axios set it based on the request
  // This is important for multipart/form-data requests

  // Set reasonable timeouts
  timeout: 120000, // 2 minutes default timeout (increased for large files)

  // Enable cross-site cookies if needed
  withCredentials: false,

  // Optimize response handling
  decompress: true, // Handle gzipped responses

  // Optimize for large responses
  maxContentLength: 100 * 1024 * 1024, // 100MB max response size
  maxBodyLength: 100 * 1024 * 1024, // 100MB max request body size
});

// Add request interceptor to handle requests
api.interceptors.request.use(
  config => {
    // For multipart/form-data, don't set Content-Type header
    // Let the browser set it with the correct boundary
    if (config.data instanceof FormData) {
      // Delete the Content-Type header if it exists
      if (config.headers) {
        delete config.headers['Content-Type'];
      }
    }
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

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
      // Check if it's a timeout
      if (error.code === 'ECONNABORTED') {
        return Promise.reject({
          ...error,
          message: 'Request timed out. Please try again or try with a smaller file.'
        });
      }

      // Check if it's a CORS error
      if (error.message && error.message.includes('Network Error')) {
        return Promise.reject({
          ...error,
          message: 'Network error. This may be due to CORS restrictions or server unavailability.'
        });
      }

      return Promise.reject({
        ...error,
        message: 'Network error. Please check your connection and try again.'
      });
    }

    // Handle specific HTTP status codes
    if (error.response) {
      const status = error.response.status;

      if (status === 413) {
        return Promise.reject({
          ...error,
          message: 'File too large. Please try a smaller file or use compression.'
        });
      }

      if (status === 429) {
        return Promise.reject({
          ...error,
          message: 'Too many requests. Please wait a moment and try again.'
        });
      }

      if (status >= 500) {
        return Promise.reject({
          ...error,
          message: 'Server error. Please try again later.'
        });
      }
    }

    return Promise.reject(error);
  }
);

export default api;

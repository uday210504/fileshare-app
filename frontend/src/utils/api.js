import axios from 'axios';

// Create a base API URL that uses the environment variable in production
// or falls back to relative URLs in development
const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

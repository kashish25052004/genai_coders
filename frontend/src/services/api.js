import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response?.status === 429) {
      // Rate limit exceeded
      toast.error('Too many requests. Please try again later.');
    } else if (error.response?.status >= 500) {
      // Server error
      toast.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  changePassword: (passwordData) => api.put('/auth/password', passwordData),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
};

// Documents API
export const documentsAPI = {
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  uploadForComparison: (formData) => api.post('/documents/upload-compare', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getStats: () => api.get('/documents/stats'),
};

// Analysis API
export const analysisAPI = {
  analyze: (documentId) => api.post(`/analysis/analyze/${documentId}`),
  compare: (documentId1, documentId2) => api.post('/analysis/compare', {
    documentId1,
    documentId2,
  }),
  askQuestion: (documentId, question) => api.post(`/analysis/qa/${documentId}`, {
    question,
  }),
  getQAHistory: (documentId) => api.get(`/analysis/qa/${documentId}`),
  getSummary: (documentId) => api.get(`/analysis/summary/${documentId}`),
  reanalyze: (documentId) => api.post(`/analysis/reanalyze/${documentId}`),
};

// Users API
export const usersAPI = {
  getDashboard: () => api.get('/users/dashboard'),
  getActivity: (params) => api.get('/users/activity', { params }),
  updatePreferences: (preferences) => api.put('/users/preferences', preferences),
  getSubscription: () => api.get('/users/subscription'),
  deleteData: (confirmEmail, reason) => api.delete('/users/data', {
    data: { confirmEmail, reason },
  }),
};

// Admin API (if user is admin)
export const adminAPI = {
  getUsers: (params) => api.get('/users/admin/users', { params }),
  getStats: () => api.get('/users/admin/stats'),
};

// Utility functions
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('document', file);

  return api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

export const uploadFilesForComparison = async (files, onProgress) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append('documents', file);
  });

  return api.post('/documents/upload-compare', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;

import axios from 'axios';

// Remove trailing slash if user added it in VITE_API_URL
const cleanedApiUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
const getToken = () => localStorage.getItem("auth_token")
// Full API URL (e.g., http://localhost:5000/api)
const apiUrl = `${cleanedApiUrl}/api`;

const axiosInstance = axios.create({
  baseURL: apiUrl,
 // withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
      config.headers.Authorization = `Bearer ${token}`
  }
  return config;
})

export default axiosInstance;

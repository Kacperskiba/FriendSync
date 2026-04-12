import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/users';

export const login = async (username, password) => {
  // OAuth2PasswordRequestForm wymaga formatu "form-data", nie JSON
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  const response = await axios.post(`${API_URL}/login`, formData);
  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token); // Zapisujemy token w przeglądarce
  }
  return response.data;
};

export const register = async (userData) => {
  const response = await axios.post(`${API_URL}/register`, userData);
  return response.data;
};
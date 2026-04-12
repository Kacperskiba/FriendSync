import React, { useState } from 'react';
import { login } from '../services/authService';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      alert('Zalogowano pomyślnie!');
      window.location.href = '/dashboard'; // Przekierowanie po sukcesie
    } catch (error) {
      alert('Błąd logowania: ' + error.response.data.detail);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" placeholder="Email lub login" onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Hasło" onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Zaloguj się</button>
    </form>
  );
}

export default Login;
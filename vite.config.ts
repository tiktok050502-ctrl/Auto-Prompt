// FIX: Explicitly import `process` to provide Node.js types and resolve the error with `process.cwd()`.
import process from 'process';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Tải các biến môi trường từ tệp .env (nếu có) nhưng KHÔNG TIÊM vào client
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // SECURITY UPDATE: Removed 'define' block for process.env.API_KEY.
    // This guarantees that the app cannot access any system-level API Key.
    // The only way to access the API is via the User Input Key passed through the app state.
  }
})
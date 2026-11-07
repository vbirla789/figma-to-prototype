import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true so the prototype can be opened from a phone on the same Wi-Fi
// (http://<your-laptop-ip>:<port>) — the fastest way to check the phone layout.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: Number(process.env.PORT) || 5173, strictPort: true },
})

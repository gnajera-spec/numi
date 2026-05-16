import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND = 'http://localhost:8000'

// All backend route prefixes (none conflict with frontend /admin /employee /superadmin)
const backendPrefixes = [
  '/auth', '/comunicaciones', '/licencias', '/medico', '/recibos',
  '/periodos', '/users', '/tenants', '/reportes', '/departamentos',
  '/sedes', '/puestos', '/convenios', '/whatsapp', '/health',
  '/admin/invitaciones', '/admin/configuracion',
  '/onboarding',
  '/openapi.json', '/docs', '/redoc',
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5580,
    proxy: Object.fromEntries(
      backendPrefixes.map(prefix => [
        prefix,
        { target: BACKEND, changeOrigin: true, secure: false },
      ])
    ),
  },
})

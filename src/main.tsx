import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'

document.documentElement.dataset.platform = Capacitor.isNativePlatform()
  ? 'native'
  : 'web'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)

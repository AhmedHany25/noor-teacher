import '@fontsource/cairo/arabic-400.css'
import '@fontsource/cairo/arabic-600.css'
import '@fontsource/cairo/arabic-700.css'
import '@fontsource/amiri/arabic-700.css'
import './styles/app.css'
import './styles/design-v2.css'
import './styles/screens-v2.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { UpdateBanner } from './components/UpdateBanner'
import { AuthProvider } from './auth/AuthProvider'
import { reportWriteError } from './data/data'
import { firestoreRepos } from './data/firestoreRepos'
import { db, firebaseAuthApi } from './lib/firebase'
import { startUpdates } from './lib/updates'

startUpdates()

const makeRepos = (uid: string) => firestoreRepos(db, uid, reportWriteError)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider api={firebaseAuthApi}>
      <BrowserRouter>
        <App makeRepos={makeRepos} />
        <UpdateBanner />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

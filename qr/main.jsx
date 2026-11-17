import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Qr from './Qr.jsx'

/*
  A second Vite entry, deliberately without the main app's router. The QR code a phone scans
  opens exactly one page — this one — and that page does one thing: read the query, ask the
  device where it stands, and hand four digits plus a session id to /api/self. Nothing else is
  imported from src/App.jsx or src/page_functions/place.js so this bundle stays small enough
  that the scan does not sit on a spinner while a whole SPA loads.
*/
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Qr />
  </StrictMode>,
)

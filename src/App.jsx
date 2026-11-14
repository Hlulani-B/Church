import { Link, Route, Routes } from 'react-router-dom'
import LandingPage from './landing.jsx'
import LoginPage from './pages/login.jsx'
import CreateAccountPage from './pages/create_account.jsx'
import ForgotPasswordPage from './pages/forgot_password.jsx'
import TermsPage from './pages/TCs.jsx'
import CommunityPage from './pages/community.jsx'
import ProfilePage from './pages/profile.jsx'

function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/">Go to the home page</Link>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<CreateAccountPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App

import { Link, Route, Routes } from 'react-router-dom'
import LandingPage from './landing.jsx'
import LoginPage from './pages/login.jsx'
import CreateAccountPage from './pages/create_account.jsx'
import ForgotPasswordPage from './pages/forgot_password.jsx'
import TermsPage from './pages/TCs.jsx'
import CommunityPage from './pages/community.jsx'
import ProfilePage from './pages/profile.jsx'
import FeedbackPage from './pages/feedback.jsx'
import AdminDashboard from './admin/Dashboard.jsx'
import AdminTestimonies from './admin/testimonies.jsx'
import AdminAttendance from './admin/attendance.jsx'
import AdminFeedback from './admin/feedback.jsx'
import LeaderDashboard from './leader/Dashboard.jsx'
import LeaderTestimonies from './leader/testimonies.jsx'
import LeaderAttendance from './leader/attendance.jsx'
import MemberDashboard from './member/Dashboard.jsx'
import MemberTestimonies from './member/testimonies.jsx'
import TakeAttendance from './pages/take_attendance.jsx'
import ToastHost from './components/toast.jsx'

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
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<CreateAccountPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-testimonies" element={<AdminTestimonies />} />
        <Route path="/admin-attendance" element={<AdminAttendance />} />
        <Route path="/admin-feedback" element={<AdminFeedback />} />
        <Route path="/leader-dashboard" element={<LeaderDashboard />} />
        <Route path="/leader-testimonies" element={<LeaderTestimonies />} />
        <Route path="/leader-attendance" element={<LeaderAttendance />} />
        <Route path="/member-dashboard" element={<MemberDashboard />} />
        <Route path="/member-testimonies" element={<MemberTestimonies />} />
        <Route path="/take-attendance" element={<TakeAttendance />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* One host, mounted above the router so a check-in landing on any page can push a toast
          and every route keeps the same stack. */}
      <ToastHost />
    </>
  )
}

export default App

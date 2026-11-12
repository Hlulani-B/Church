import { Link, Route, Routes } from 'react-router-dom'

function Home() {
  return (
    <main>
      <h1>Church</h1>
    </main>
  )
}

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
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App

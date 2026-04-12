import ReviewerPage from './reviewer/ReviewerPage'
import Login from './components/Login'
import { UserProvider, useUser } from './lib/UserContext'

function Gate() {
  const { user } = useUser()
  if (!user) return <Login />
  return <ReviewerPage />
}

export default function App() {
  return (
    <UserProvider>
      <div className="app-shell">
        <Gate />
      </div>
    </UserProvider>
  )
}

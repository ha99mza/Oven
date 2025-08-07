import HistoryPage from "./page/HistoryPage"
import HomePage from "./page/HomePage"
import SessionDetailPage from "./page/SessionDetailPage"
import TrackingPage from "./page/TrackingPage"
import { HashRouter, Routes, Route } from "react-router-dom"


function App() {
  return(
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/track/:ovenId" element={<TrackingPage />} />
        <Route path="/history/:ovenId" element={<HistoryPage />} />
        <Route path="/session-detail/:productId" element={<SessionDetailPage />} />
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </HashRouter>
  )  
}

export default App

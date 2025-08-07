import HistoryPage from "./page/HistoryPage"
import HomePage from "./page/HomePage"
import SessionDetailPage from "./page/SessionDetailPage"
import TrackingPage from "./page/TrackingPage"
import { BrowserRouter, Routes, Route } from "react-router-dom"


function App() {
  return(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/track/:ovenId" element={<TrackingPage />} />
        <Route path="/history/:ovenId" element={<HistoryPage />} />
        <Route path="/session-detail/:productId" element={<SessionDetailPage />} />
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </BrowserRouter>
  )  
}

export default App

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { Home } from './pages/Home'
import { Gallery } from './pages/Gallery'
import { TokenDetail } from './pages/TokenDetail'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/token/:id" element={<TokenDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}

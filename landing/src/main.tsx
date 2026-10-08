import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Whitepaper from './Whitepaper.tsx'
import Team from './Team.tsx'
import { BlogIndex, BlogPost } from './Blog.tsx'
import NotFound from './NotFound.tsx'
import { DocsRedirect, ScrollToTop } from './routing.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/whitepaper" element={<Whitepaper />} />
        <Route path="/team" element={<Team />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/docs" element={<DocsRedirect />} />
        <Route path="/docs/*" element={<DocsRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

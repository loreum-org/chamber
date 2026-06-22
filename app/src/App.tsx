import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from '@/components/Layout'
import { Dashboard, DeployChamber, ChamberDetail, TransactionQueue, Docs, DirectorProfile } from '@/pages'

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#141c2b',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.18)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#f5f5f4',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#f5f5f4',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="deploy" element={<DeployChamber />} />
          <Route path="chamber/:address" element={<ChamberDetail />} />
          <Route path="chamber/:address/:tab" element={<ChamberDetail />} />
          <Route path="chamber/:address/transactions" element={<TransactionQueue />} />
          <Route path="chamber/:address/director/:tokenId" element={<DirectorProfile />} />
          <Route path="docs" element={<Docs />} />
          <Route path="docs/*" element={<Docs />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

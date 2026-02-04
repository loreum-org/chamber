import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from '@/components/Layout'
import { Dashboard, DeployChamber, ChamberDetail, TransactionQueue, Docs } from '@/pages'

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#1e293b',
            color: '#f5f5f4',
            border: '1px solid rgba(251, 191, 36, 0.3)',
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
          <Route path="docs" element={<Docs />} />
          <Route path="docs/*" element={<Docs />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

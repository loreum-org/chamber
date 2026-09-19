import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAccount, useConnections } from 'wagmi'
import Layout from '@/components/Layout'
import { Dashboard, DeployChamber, ChamberDetail, TransactionQueue, Docs, DirectorProfile, Migrate, Operators, OperatorWizard, Compliance } from '@/pages'

/**
 * `/` shows the Dashboard for connected wallets and sends everyone else to
 * `/deploy`. Before wagmi's auto-reconnect starts, status is 'disconnected'
 * even for returning users; their persisted connection is still in the store,
 * so only redirect once there is no connection left to restore.
 */
function HomeRoute() {
  const { status } = useAccount()
  const connections = useConnections()
  if (status === 'disconnected' && connections.length === 0) {
    return <Navigate to="/deploy" replace />
  }
  return <Dashboard />
}

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
          <Route index element={<HomeRoute />} />
          <Route path="deploy" element={<DeployChamber />} />
          <Route path="chamber/:address" element={<ChamberDetail />} />
          <Route path="chamber/:address/:tab" element={<ChamberDetail />} />
          <Route path="chamber/:address/transactions" element={<TransactionQueue />} />
          <Route path="chamber/:address/director/:tokenId" element={<DirectorProfile />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="docs" element={<Docs />} />
          <Route path="docs/*" element={<Docs />} />
          <Route path="migrate" element={<Migrate />} />
          <Route path="operators" element={<Operators />} />
          <Route path="operators/wizard" element={<OperatorWizard />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

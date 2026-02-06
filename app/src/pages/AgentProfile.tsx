import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiCpu, FiCheckCircle, FiShield, FiActivity, FiExternalLink } from 'react-icons/fi'

// Mock data for now - will be replaced by contract calls
const MOCK_AGENT = {
  name: 'Treasury Manager Bot',
  description: 'Autonomous agent managing stablecoin yield strategies for the Alpha Chamber.',
  model: 'Llama 3 (70B)',
  reputation: 92,
  validations: [
    { type: 'TEE Verification', validator: 'Cortensor', date: '2026-02-01' },
    { type: 'Code Audit', validator: 'OpenZeppelin', date: '2026-01-15' }
  ],
  status: 'Active',
  identityTokenId: '42'
}

export default function AgentProfile() {
  const { address } = useParams()
  // const { data: agentData } = useAgentData(address) // TODO: Implement hook

  const agent = MOCK_AGENT // Fallback to mock

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Profile */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel p-8 flex flex-col md:flex-row items-start md:items-center gap-6"
      >
        <div className="w-24 h-24 bg-space-800 rounded-full border border-space-accent/30 flex items-center justify-center flex-shrink-0">
          <FiCpu className="w-12 h-12 text-space-accent" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-heading font-bold text-white">{agent.name}</h1>
            <span className="badge badge-primary flex items-center gap-1">
              <FiCheckCircle className="w-3 h-3" /> Verified
            </span>
          </div>
          <p className="text-slate-400 mb-4 max-w-2xl">{agent.description}</p>
          
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Address:</span>
              <span className="text-cyan-400">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <FiExternalLink className="w-3 h-3 hover:text-white cursor-pointer" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">ID Token:</span>
              <span className="text-white">#{agent.identityTokenId}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <span className="text-slate-400">Model:</span>
              <span className="text-purple-400">{agent.model}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <FiShield className="w-5 h-5" />
            <h3 className="font-medium">Reputation Score</h3>
          </div>
          <div className="text-4xl font-heading font-bold text-green-400">
            {agent.reputation}/100
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-green-400 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${agent.reputation}%` }}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <FiActivity className="w-5 h-5" />
            <h3 className="font-medium">Activity</h3>
          </div>
          <div className="text-4xl font-heading font-bold text-white">
            248
          </div>
          <p className="text-slate-500 text-sm mt-2">Transactions Executed</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <FiCheckCircle className="w-5 h-5" />
            <h3 className="font-medium">Validations</h3>
          </div>
          <div className="space-y-3">
            {agent.validations.map((val, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-slate-300">{val.type}</span>
                <span className="text-green-400 font-mono">Passed</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Governance History Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="panel p-8"
      >
        <h3 className="text-xl font-heading font-semibold text-white mb-6">Recent Governance Actions</h3>
        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
          <p>No recent actions found.</p>
        </div>
      </motion.div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Mermaid from '@/components/Mermaid'
import { FiChevronRight, FiChevronDown, FiFileText, FiFolder } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

// Import all markdown files in the docs folder
const docFiles = import.meta.glob('../docs/**/*.md', { as: 'raw', eager: true })

console.log('Available doc files:', Object.keys(docFiles))

interface DocNode {
  name: string
  path: string
  fullPath: string
  children?: DocNode[]
  type: 'file' | 'directory'
}

function buildDocTree(files: Record<string, any>): DocNode[] {
  const root: DocNode[] = []

  Object.keys(files).forEach((filePath) => {
    // Clean up the path: remove query params
    const cleanPath = filePath.split('?')[0]
    
    // Get the path parts after "docs/"
    const match = cleanPath.match(/\/docs\/(.+)\.md$/) || cleanPath.match(/docs\/(.+)\.md$/)
    if (!match) return

    const relativePath = match[1]
    const parts = relativePath.split('/')
    
    let currentLevel = root
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      const existing = currentLevel.find((node) => node.name === part)
      
      if (existing) {
        if (!isLast) {
          if (!existing.children) existing.children = []
          currentLevel = existing.children
        }
      } else {
        const newNode: DocNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          fullPath: filePath,
          type: isLast ? 'file' : 'directory',
          children: isLast ? undefined : []
        }
        currentLevel.push(newNode)
        if (!isLast && newNode.children) {
          currentLevel = newNode.children
        }
      }
    })
  })

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: DocNode[]) => {
    const order = ['introduction', 'protocol', 'guides', 'reference', 'security', 'whitepaper']
    
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      
      const indexA = order.indexOf(a.name.toLowerCase())
      const indexB = order.indexOf(b.name.toLowerCase())
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      } else if (indexA !== -1) {
        return -1
      } else if (indexB !== -1) {
        return 1
      }
      
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children)
    })
  }

  sortNodes(root)
  return root
}

const NavItem = ({ node, level, activePath }: { node: DocNode; level: number; activePath: string }) => {
  const [isOpen, setIsOpen] = useState(true)
  const navigate = useNavigate()
  const isActive = activePath === node.path || (node.path === 'README' && activePath === '')
  
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors ${
          isActive 
            ? 'bg-cyan-500/10 text-cyan-400' 
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
        }`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => {
          if (node.type === 'file') {
            navigate(`/docs/${node.path}`)
          } else {
            setIsOpen(!isOpen)
            // If there's an index file in this directory, navigate to it
            const indexPath = node.children?.find(c => 
              c.name.toLowerCase() === 'readme' || c.name.toLowerCase() === 'index'
            )
            if (indexPath) {
              navigate(`/docs/${indexPath.path}`)
            }
          }
        }}
      >
        {hasChildren ? (
          isOpen ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronRight className="w-3.5 h-3.5" />
        ) : (
          <FiFileText className="w-3.5 h-3.5 opacity-50" />
        )}
        <span className="text-sm font-medium capitalize">
          {node.name.replace(/-/g, ' ')}
        </span>
      </div>
      
      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <NavItem key={child.fullPath} node={child} level={level + 1} activePath={activePath} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Docs() {
  const { '*': path } = useParams()
  const activePath = path || ''
  
  const docTree = useMemo(() => buildDocTree(docFiles), [])
  const keys = Object.keys(docFiles)
  
  const content = useMemo(() => {
    if (keys.length === 0) {
      return '# No Documentation Found\n\nThe documentation folder seems to be empty or could not be loaded.'
    }
    
    let targetKey = ''
    if (activePath) {
      // Find key that ends with the activePath + .md (ignoring query)
      targetKey = keys.find(k => {
        const cleanK = k.split('?')[0]
        return cleanK.endsWith(`${activePath}.md`) || cleanK.endsWith(`${activePath}/README.md`) || cleanK.endsWith(`${activePath}/INDEX.md`)
      }) || ''
    } else {
      // Try to find README or INDEX or Overview
      const possibleDefaults = [
        'introduction/overview.md',
        'README.md',
        'INDEX.md',
        'index.md',
        'chamber.md'
      ]
      for (const def of possibleDefaults) {
        targetKey = keys.find(k => k.split('?')[0].endsWith(def)) || ''
        if (targetKey) break
      }
      if (!targetKey) targetKey = keys[0]
    }

    const doc = docFiles[targetKey]
    if (!doc) {
      return `# 404 - Document Not Found\n\nCould not find document: ${activePath}\n\nAvailable keys: ${keys.join(', ')}`
    }
    
    // With as: 'raw', doc should be the string content directly
    return typeof doc === 'string' ? doc : (doc as any).default || String(doc)
  }, [activePath, keys])

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[calc(100vh-12rem)]">
      {/* Debug info - hidden but searchable in DOM */}
      <div className="sr-only">Debug: path={activePath} content={content?.substring(0, 100)}</div>
      {/* Sidebar */}
      <aside className="w-full md:w-64 flex-shrink-0">
        <div className="text-[10px] text-slate-500 mb-2">
          Debug: {keys.length} files found
        </div>
        <div className="sticky top-24 panel p-4 max-h-[calc(100vh-8rem)] overflow-y-auto scroll-container">
          <div className="flex items-center gap-2 px-3 mb-4 text-slate-100 font-semibold">
            <FiFolder className="text-cyan-500" />
            <span>Documentation</span>
          </div>
          <div className="space-y-1">
            {docTree.map((node) => (
              <NavItem key={node.fullPath} node={node} level={0} activePath={activePath} />
            ))}
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <motion.div
          key={activePath}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-8 md:p-12"
        >
          <div className="prose prose-invert prose-cyan max-w-none prose-headings:font-heading prose-headings:font-bold prose-h1:text-4xl prose-h1:mb-8 prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-slate-400 prose-p:leading-relaxed prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-100 prose-code:text-cyan-300 prose-code:bg-slate-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-ul:list-disc prose-ol:list-decimal">
            <div className="hidden">Debug: content length {content.length}</div>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1({ children }) {
                  return (
                    <h1 className="text-4xl font-heading font-bold text-slate-100 mb-8 pb-4 border-b border-slate-800/50">
                      {children}
                    </h1>
                  )
                },
                h2({ children }) {
                  return (
                    <h2 className="text-2xl font-heading font-bold text-slate-100 mt-12 mb-4 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                      {children}
                    </h2>
                  )
                },
                h3({ children }) {
                  return (
                    <h3 className="text-xl font-heading font-bold text-slate-200 mt-8 mb-3">
                      {children}
                    </h3>
                  )
                },
                p({ children }) {
                  return <p className="text-slate-400 leading-relaxed mb-6">{children}</p>
                },
                ul({ children }) {
                  return <ul className="list-disc list-outside ml-6 mb-6 space-y-2 text-slate-400">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal list-outside ml-6 mb-6 space-y-2 text-slate-400">{children}</ol>
                },
                li({ children }) {
                  return <li className="pl-1">{children}</li>
                },
                a({ href, children }) {
                  return (
                    <a 
                      href={href} 
                      className="text-cyan-400 hover:text-cyan-300 transition-colors underline decoration-cyan-500/30 underline-offset-4"
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {children}
                    </a>
                  )
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-cyan-500/50 bg-cyan-500/5 px-6 py-4 rounded-r-xl my-8 italic text-slate-300">
                      {children}
                    </blockquote>
                  )
                },
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-mermaid/.exec(className || '')
                  if (!inline && match) {
                    return (
                      <div className="my-8">
                        <Mermaid chart={String(children).replace(/\n$/, '')} />
                      </div>
                    )
                  }
                  if (!inline) {
                    return (
                      <div className="my-6 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800/50">
                          <span className="text-xs font-mono text-slate-500">
                            {className?.replace('language-', '') || 'code'}
                          </span>
                        </div>
                        <pre className="p-4 overflow-x-auto scroll-container">
                          <code className="text-sm text-cyan-100 font-mono" {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    )
                  }
                  return (
                    <code className="bg-slate-800/80 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-700/30" {...props}>
                      {children}
                    </code>
                  )
                },
                // Style tables in markdown
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-8 rounded-xl border border-slate-700/50">
                      <table className="min-w-full border-collapse">
                        {children}
                      </table>
                    </div>
                  )
                },
                thead({ children }) {
                  return <thead className="bg-slate-800/50 border-b border-slate-700/50">{children}</thead>
                },
                th({ children }) {
                  return (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="px-6 py-4 text-sm text-slate-400 border-t border-slate-700/30">
                      {children}
                    </td>
                  )
                }
              }}
            >
              {content}
            </ReactMarkdown>
            {content.length === 0 && <p className="text-red-500">Error: Content is empty</p>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

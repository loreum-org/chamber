import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'strict',
  htmlLabels: false,
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    primaryColor: '#1e40af',
    primaryTextColor: '#f1f5f9',
    primaryBorderColor: '#2563eb',
    lineColor: '#64748b',
    secondaryColor: '#334155',
    tertiaryColor: '#0f172a',
    nodeTextColor: '#f1f5f9',
    textColor: '#f1f5f9',
  },
})

interface MermaidProps {
  chart: string
}

export default function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const renderChart = async () => {
      if (!chart) return
      
      try {
        // Clear previous content
        setSvg('')
        
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`
        const { svg: rawSvg } = await mermaid.render(id, chart)
        const cleanSvg = DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } })
        
        if (isMounted) {
          setSvg(cleanSvg)
          setError(null)
        }
      } catch (err) {
        console.error('Mermaid rendering failed:', err)
        if (isMounted) {
          setError('Failed to render diagram')
        }
      }
    }

    renderChart()
    return () => { isMounted = false }
  }, [chart])

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
        {error}
        <pre className="mt-2 text-xs opacity-50 overflow-auto">{chart}</pre>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className="mermaid-container flex justify-center my-8 p-6 bg-slate-900/40 rounded-2xl border border-slate-700/50 overflow-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

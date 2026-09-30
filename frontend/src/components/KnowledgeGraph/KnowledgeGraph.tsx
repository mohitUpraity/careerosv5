import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Layers, 
  ExternalLink, 
  Github, 
  Linkedin, 
  X, 
  Info,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { GraphData, GraphNode, GraphLink } from '../../types';

interface KnowledgeGraphProps {
  graphData: GraphData | null;
  loading: boolean;
}

const CATEGORY_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  Candidate: { fill: '#10b981', stroke: '#34d399', glow: 'rgba(16, 185, 129, 0.4)' },
  Project: { fill: '#6366f1', stroke: '#818cf8', glow: 'rgba(99, 102, 241, 0.4)' },
  Skill: { fill: '#f59e0b', stroke: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)' },
  Company: { fill: '#06b6d4', stroke: '#22d3ee', glow: 'rgba(6, 182, 212, 0.4)' },
  Contact: { fill: '#ec4899', stroke: '#f472b6', glow: 'rgba(236, 72, 153, 0.4)' },
  Education: { fill: '#8b5cf6', stroke: '#a78bfa', glow: 'rgba(139, 92, 246, 0.4)' },
  Default: { fill: '#64748b', stroke: '#94a3b8', glow: 'rgba(100, 116, 139, 0.4)' },
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ graphData, loading }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const categories = ['all', 'Candidate', 'Project', 'Skill', 'Company', 'Contact', 'Education'];

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup definitions (Glow filters and gradients)
    const defs = svg.append('defs');
    
    // Add glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('class', 'graph-group');

    // Zoom setup
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    setZoomTransform(() => zoom);

    // Deep copy data for D3 mutation
    const nodes: GraphNode[] = graphData.nodes.map(d => ({ ...d }));
    const links: GraphLink[] = graphData.links.map(d => ({ ...d }));

    // Filter nodes by category and search
    const filteredNodeIds = new Set(
      nodes
        .filter(n => {
          const cat = n.type || n.category || 'Skill';
          const matchesCat = selectedCategory === 'all' || cat === selectedCategory;
          const matchesSearch = !searchQuery || (n.label || n.name || '').toLowerCase().includes(searchQuery.toLowerCase());
          return matchesCat && matchesSearch;
        })
        .map(n => n.id)
    );

    // D3 Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(28));

    // Render Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', d => {
        const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return (filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)) ? 0.7 : 0.15;
      });

    // Render Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group cursor-pointer')
      .attr('opacity', d => (filteredNodeIds.has(d.id) ? 1 : 0.2))
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Outer ring / glow
    node.append('circle')
      .attr('r', d => (d.type === 'Candidate' ? 24 : d.type === 'Project' ? 18 : 14))
      .attr('fill', d => (CATEGORY_COLORS[d.type] || CATEGORY_COLORS.Default).fill)
      .attr('stroke', d => (CATEGORY_COLORS[d.type] || CATEGORY_COLORS.Default).stroke)
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#glow)');

    // Node Labels
    node.append('text')
      .text(d => d.label || d.name || d.id)
      .attr('x', 0)
      .attr('y', d => (d.type === 'Candidate' ? 36 : 28))
      .attr('text-anchor', 'middle')
      .attr('fill', '#f1f5f9')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none');

    // Simulation Tick Update
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0);

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, selectedCategory, searchQuery]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomTransform) {
      d3.select(svgRef.current).transition().duration(300).call(zoomTransform.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomTransform) {
      d3.select(svgRef.current).transition().duration(300).call(zoomTransform.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomTransform) {
      d3.select(svgRef.current).transition().duration(400).call(zoomTransform.transform, d3.zoomIdentity);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-130px)] flex flex-col bg-[#090E17] rounded-2xl border border-slate-800/90 overflow-hidden shadow-2xl">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0 mr-1" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-medium capitalize transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search and Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter nodes..."
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 w-36 sm:w-48"
            />
          </div>

          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div ref={containerRef} className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing bg-radial-grid">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Rendering Force-Directed Topology...</p>
            </div>
          </div>
        ) : null}

        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Slide-In Node Inspector Drawer */}
      {selectedNode && (
        <div className="absolute top-16 right-4 bottom-4 w-80 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-5 z-30 flex flex-col justify-between animate-slide-in">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${(CATEGORY_COLORS[selectedNode.type] || CATEGORY_COLORS.Default).fill}20`,
                  color: (CATEGORY_COLORS[selectedNode.type] || CATEGORY_COLORS.Default).stroke,
                  border: `1px solid ${(CATEGORY_COLORS[selectedNode.type] || CATEGORY_COLORS.Default).stroke}40`,
                }}
              >
                {selectedNode.type || 'Entity'}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1">
              {selectedNode.label || selectedNode.name || selectedNode.id}
            </h3>
            
            {selectedNode.headline && (
              <p className="text-xs text-slate-300 font-medium mb-3">{selectedNode.headline}</p>
            )}

            {selectedNode.summary && (
              <p className="text-xs text-slate-400 leading-relaxed mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {selectedNode.summary}
              </p>
            )}

            <div className="space-y-2 text-xs">
              {selectedNode.company && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40">
                  <span className="text-slate-400">Company:</span>
                  <span className="font-semibold text-slate-200">{selectedNode.company}</span>
                </div>
              )}
              {selectedNode.proficiency && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40">
                  <span className="text-slate-400">Proficiency:</span>
                  <span className="font-semibold text-emerald-400">{selectedNode.proficiency}%</span>
                </div>
              )}
              {selectedNode.role && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-semibold text-slate-200">{selectedNode.role}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            {selectedNode.repo_url && (
              <a
                href={selectedNode.repo_url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-all"
              >
                <Github className="w-4 h-4" />
                View GitHub Repository
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
              </a>
            )}
            {selectedNode.url && (
              <a
                href={selectedNode.url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all"
              >
                <Linkedin className="w-4 h-4" />
                View LinkedIn Profile
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-indigo-400" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

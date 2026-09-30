import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Layers, 
  ExternalLink, 
  Github, 
  X,
  Sparkles,
  Briefcase,
  Code,
  GraduationCap,
  Users,
  User,
  Building2,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { GraphData, GraphNode, GraphLink } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface KnowledgeGraphProps {
  graphData: GraphData | null;
  loading: boolean;
  onOpenSyncGitHub?: () => void;
}

// Visual design tokens for each category — high contrast & human-crafted
export interface CategoryTheme {
  id: string;
  label: string;
  bg: string;
  border: string;
  pillBg: string;
  pillText: string;
  icon: React.ComponentType<{ className?: string }>;
  radius: number;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  Candidate: {
    id: 'Candidate',
    label: 'You (Profile)',
    bg: '#2563EB',
    border: '#1D4ED8',
    pillBg: '#EFF6FF',
    pillText: '#1E40AF',
    icon: User,
    radius: 26,
  },
  Project: {
    id: 'Project',
    label: 'Projects & Code',
    bg: '#7C3AED',
    border: '#6D28D9',
    pillBg: '#F5F3FF',
    pillText: '#5B21B6',
    icon: Code,
    radius: 19,
  },
  Skill: {
    id: 'Skill',
    label: 'Verified Skills',
    bg: '#059669',
    border: '#047857',
    pillBg: '#ECFDF5',
    pillText: '#065F46',
    icon: CheckCircle2,
    radius: 14,
  },
  Company: {
    id: 'Company',
    label: 'Companies',
    bg: '#D97706',
    border: '#B45309',
    pillBg: '#FFFBEB',
    pillText: '#92400E',
    icon: Building2,
    radius: 17,
  },
  Contact: {
    id: 'Contact',
    label: 'Referral Network',
    bg: '#DB2777',
    border: '#BE185D',
    pillBg: '#FDF2F8',
    pillText: '#9D174D',
    icon: Users,
    radius: 15,
  },
  Education: {
    id: 'Education',
    label: 'Education',
    bg: '#0891B2',
    border: '#0E7490',
    pillBg: '#ECFEFF',
    pillText: '#155E75',
    icon: GraduationCap,
    radius: 18,
  },
  Default: {
    id: 'Default',
    label: 'Entities',
    bg: '#64748B',
    border: '#475569',
    pillBg: '#F1F5F9',
    pillText: '#334155',
    icon: Sparkles,
    radius: 13,
  },
};

export const normalizeCategory = (type?: string, id?: string, category?: string): string => {
  const t = (type || category || '').toLowerCase();
  const i = (id || '').toLowerCase();

  if (t === 'user' || t === 'candidate' || i.startsWith('user_')) return 'Candidate';
  if (t === 'project' || t === 'repo' || t === 'repository' || i.startsWith('proj_')) return 'Project';
  if (t === 'skill' || t === 'technical skill' || i.startsWith('skill_')) return 'Skill';
  if (t === 'company' || t === 'employer' || i.startsWith('comp_')) return 'Company';
  if (t === 'contact' || t === 'person' || t === 'alumni' || i.startsWith('contact_') || i.startsWith('person_')) return 'Contact';
  if (t === 'university' || t === 'education' || i.startsWith('univ_') || i.startsWith('edu_')) return 'Education';
  return 'Skill';
};

export const getThemeForNode = (node: GraphNode): CategoryTheme => {
  const cat = normalizeCategory(node.type, node.id, node.category);
  return CATEGORY_THEMES[cat] || CATEGORY_THEMES.Default;
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ 
  graphData, 
  loading,
  onOpenSyncGitHub 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRelations, setShowRelations] = useState<boolean>(true);
  const [zoomBehavior, setZoomBehavior] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Category counts
  const categoryStats = useMemo(() => {
    if (!graphData?.nodes) return {};
    const counts: Record<string, number> = { all: graphData.nodes.length };
    graphData.nodes.forEach(n => {
      const cat = normalizeCategory(n.type, n.id, n.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  const categories = ['all', 'Candidate', 'Project', 'Skill', 'Company', 'Contact', 'Education'];

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // D3 Visual Theme Config
    const gridDotColor = isDark ? '#334155' : '#CBD5E1';
    const canvasBg = isDark ? '#0B0F17' : '#F8FAFC';
    const defaultLinkColor = isDark ? '#334155' : '#CBD5E1';
    const highlightLinkColor = isDark ? '#60A5FA' : '#2563EB';
    const outerRingFill = isDark ? '#1E293B' : '#FFFFFF';
    const outerRingBorder = isDark ? '#334155' : '#E2E8F0';
    const pillBg = isDark ? '#1E293B' : '#FFFFFF';
    const pillBorder = isDark ? '#334155' : '#E2E8F0';
    const pillText = isDark ? '#F8FAFC' : '#0F172A';
    const relPillBg = isDark ? '#0F172A' : '#FFFFFF';
    const relPillBorder = isDark ? '#334155' : '#E2E8F0';
    const relTextColor = isDark ? '#94A3B8' : '#64748B';

    // Definitions & Patterns
    const defs = svg.append('defs');

    // Dot grid pattern
    const pattern = defs.append('pattern')
      .attr('id', 'grid-dots')
      .attr('width', 24)
      .attr('height', 24)
      .attr('patternUnits', 'userSpaceOnUse');
    pattern.append('circle')
      .attr('cx', 12)
      .attr('cy', 12)
      .attr('r', 0.9)
      .attr('fill', gridDotColor);

    // Arrow marker for directed relations
    defs.append('marker')
      .attr('id', 'arrow-head')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', isDark ? '#64748B' : '#94A3B8');

    // Highlighted Arrow Marker
    defs.append('marker')
      .attr('id', 'arrow-head-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', highlightLinkColor);

    // Background Canvas
    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', canvasBg);

    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#grid-dots)');

    const g = svg.append('g').attr('class', 'graph-group');

    // Zoom setup
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    setZoomBehavior(() => zoom);

    // Deep copy data for D3 mutation
    const nodes: GraphNode[] = graphData.nodes.map(d => ({ ...d }));
    const links: GraphLink[] = graphData.links.map(d => ({ ...d }));

    // Filter logic
    const filteredNodeIds = new Set(
      nodes
        .filter(n => {
          const cat = normalizeCategory(n.type, n.id, n.category);
          const matchesCat = selectedCategory === 'all' || cat === selectedCategory;
          const query = searchQuery.trim().toLowerCase();
          const name = (n.label || n.name || n.id || '').toLowerCase();
          const matchesSearch = !query || name.includes(query);
          return matchesCat && matchesSearch;
        })
        .map(n => n.id)
    );

    // D3 Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => getThemeForNode(d).radius + 22));

    // Connected neighbor map for hover focus
    const connectedMap: Record<string, Set<string>> = {};
    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (!connectedMap[s]) connectedMap[s] = new Set();
      if (!connectedMap[t]) connectedMap[t] = new Set();
      connectedMap[s].add(t);
      connectedMap[t].add(s);
    });

    // Render Links
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', defaultLinkColor)
      .attr('stroke-width', 1.3)
      .attr('marker-end', 'url(#arrow-head)')
      .attr('stroke-opacity', d => {
        const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return (filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)) ? 0.65 : 0.08;
      });

    // Render Relationship Labels (like Neo4j Bloom)
    const linkLabelGroup = g.append('g').attr('class', 'link-labels');
    const linkLabel = linkLabelGroup
      .selectAll('g')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'link-label-badge pointer-events-none transition-opacity duration-150')
      .attr('opacity', d => {
        const s = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const t = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return (filteredNodeIds.has(s) && filteredNodeIds.has(t) && showRelations) ? 0.9 : 0;
      });

    linkLabel.append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', relPillBg)
      .attr('stroke', relPillBorder)
      .attr('stroke-width', 0.8)
      .attr('opacity', 0.96);

    linkLabel.append('text')
      .text(d => (d.label || d.type || d.relation || 'RELATES').toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', relTextColor)
      .attr('font-size', '8px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .each(function() {
        const bbox = this.getBBox();
        const parent = d3.select(this.parentNode as SVGGElement);
        parent.select('rect')
          .attr('x', bbox.x - 4)
          .attr('y', bbox.y - 2)
          .attr('width', bbox.width + 8)
          .attr('height', bbox.height + 4);
      });

    // Render Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group cursor-pointer transition-opacity duration-150')
      .attr('opacity', d => (filteredNodeIds.has(d.id) ? 1 : 0.12))
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
      })
      .on('mouseenter', (_, d) => {
        setHoveredNodeId(d.id);
        const neighbors = connectedMap[d.id] || new Set();
        
        node.attr('opacity', n => {
          if (!filteredNodeIds.has(n.id)) return 0.05;
          if (n.id === d.id || neighbors.has(n.id)) return 1;
          return 0.22;
        });

        link.attr('stroke-opacity', l => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (s === d.id || t === d.id) return 1;
          return 0.05;
        }).attr('stroke-width', l => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return (s === d.id || t === d.id) ? 2.2 : 1;
        }).attr('stroke', l => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return (s === d.id || t === d.id) ? highlightLinkColor : defaultLinkColor;
        }).attr('marker-end', l => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return (s === d.id || t === d.id) ? 'url(#arrow-head-active)' : 'url(#arrow-head)';
        });

        // Highlight relations on hover
        linkLabel.attr('opacity', l => {
          const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (s === d.id || t === d.id) return 1;
          return showRelations ? 0.2 : 0;
        });
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
        node.attr('opacity', d => (filteredNodeIds.has(d.id) ? 1 : 0.12));
        link
          .attr('stroke', defaultLinkColor)
          .attr('stroke-width', 1.3)
          .attr('marker-end', 'url(#arrow-head)')
          .attr('stroke-opacity', d => {
            const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
            const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
            return (filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)) ? 0.65 : 0.08;
          });

        linkLabel.attr('opacity', d => {
          const s = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          const t = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          return (filteredNodeIds.has(s) && filteredNodeIds.has(t) && showRelations) ? 0.9 : 0;
        });
      });

    // Outer subtle border / ring
    node.append('circle')
      .attr('r', d => getThemeForNode(d).radius + 3)
      .attr('fill', outerRingFill)
      .attr('stroke', outerRingBorder)
      .attr('stroke-width', 1);

    // Colored node core
    node.append('circle')
      .attr('r', d => getThemeForNode(d).radius)
      .attr('fill', d => getThemeForNode(d).bg)
      .attr('stroke', d => getThemeForNode(d).border)
      .attr('stroke-width', 1.5);

    // Node Initials or Icon Text
    node.append('text')
      .text(d => {
        const cat = normalizeCategory(d.type, d.id, d.category);
        if (cat === 'Candidate') return 'YOU';
        const name = d.label || d.name || d.id;
        return name.substring(0, 2).toUpperCase();
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#FFFFFF')
      .attr('font-size', d => (normalizeCategory(d.type, d.id, d.category) === 'Candidate' ? '10px' : '9px'))
      .attr('font-weight', '700')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none');

    // Crisp Label Background Pill
    node.append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('y', d => getThemeForNode(d).radius + 6)
      .attr('fill', pillBg)
      .attr('stroke', pillBorder)
      .attr('stroke-width', 1)
      .attr('opacity', 0.96)
      .attr('pointer-events', 'none');

    // Label Text
    node.append('text')
      .text(d => {
        const name = d.label || d.name || d.id;
        return name.length > 18 ? name.substring(0, 16) + '…' : name;
      })
      .attr('x', 0)
      .attr('y', d => getThemeForNode(d).radius + 17)
      .attr('text-anchor', 'middle')
      .attr('fill', pillText)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .each(function() {
        const bbox = this.getBBox();
        const parent = d3.select(this.parentNode as SVGGElement);
        parent.select('rect')
          .attr('x', bbox.x - 6)
          .attr('width', bbox.width + 12)
          .attr('height', bbox.height + 4);
      });

    // Simulation Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0);

      linkLabel.attr('transform', d => {
        const sx = (d.source as GraphNode).x || 0;
        const sy = (d.source as GraphNode).y || 0;
        const tx = (d.target as GraphNode).x || 0;
        const ty = (d.target as GraphNode).y || 0;
        return `translate(${(sx + tx) / 2}, ${(sy + ty) / 2})`;
      });

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, selectedCategory, searchQuery, isDark, showRelations]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehavior.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehavior) {
      d3.select(svgRef.current).transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
    }
  };

  const activeTheme = selectedNode ? getThemeForNode(selectedNode) : CATEGORY_THEMES.Default;

  return (
    <div
      className={`relative w-full h-[calc(100vh-130px)] flex flex-col rounded-xl overflow-hidden border shadow-sm transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      {/* Top Filter & Toolbar Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 z-10 border-b transition-colors duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Layers className={`w-4 h-4 shrink-0 mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          {categories.map(cat => {
            const theme = cat === 'all' ? null : CATEGORY_THEMES[cat];
            const isSelected = selectedCategory === cat;
            const count = categoryStats[cat] || 0;

            let pillStyle = '';
            if (isSelected) {
              pillStyle = isDark 
                ? 'bg-blue-950/80 text-blue-300 border-blue-800 font-semibold shadow-xs'
                : 'bg-blue-50 text-blue-700 border-blue-200 font-semibold shadow-xs';
            } else {
              pillStyle = isDark
                ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900';
            }

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${pillStyle}`}
              >
                {theme && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: theme.bg }}
                  />
                )}
                <span>{cat === 'all' ? 'All Entities' : theme?.label || cat}</span>
                <span className={`text-[10px] tabular-nums px-1.5 py-0.2 rounded-full ${
                  isSelected 
                    ? (isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-200/60 text-blue-800')
                    : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Relations Toggle, GitHub Sync & Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search nodes by name..."
              className={`pl-8 pr-3 py-1.5 text-xs w-36 sm:w-48 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Relations Toggle Button (Bloom style) */}
          <button
            onClick={() => setShowRelations(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              showRelations
                ? (isDark ? 'bg-purple-950/70 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200')
                : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')
            }`}
            title="Toggle relationship labels on edges"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Relations</span>
            <span className={`text-[10px] font-bold px-1 rounded ${
              showRelations ? (isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-200/60 text-purple-800') : 'bg-slate-200/60 dark:bg-slate-700 text-slate-500'
            }`}>
              {showRelations ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Sync GitHub Action */}
          {onOpenSyncGitHub && (
            <button
              onClick={onOpenSyncGitHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all shrink-0"
              title="Sync GitHub Repositories"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sync GitHub</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className={`flex items-center border rounded-lg p-0.5 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <button
              onClick={handleZoomIn}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-100' : 'hover:bg-white text-slate-600 hover:text-slate-900'
              }`}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-100' : 'hover:bg-white text-slate-600 hover:text-slate-900'
              }`}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-100' : 'hover:bg-white text-slate-600 hover:text-slate-900'
              }`}
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full h-full cursor-grab active:cursor-grabbing ${
          isDark ? 'bg-slate-950' : 'bg-slate-50'
        }`}
      >
        {loading && (
          <div className={`absolute inset-0 flex items-center justify-center z-20 backdrop-blur-xs ${
            isDark ? 'bg-slate-900/80' : 'bg-white/80'
          }`}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Simulating Career Footprint Graph…
              </p>
            </div>
          </div>
        )}

        <svg ref={svgRef} className="w-full h-full" />

        {/* Crisp Categorical Legend — Bottom Left */}
        <div
          className={`absolute bottom-4 left-4 p-3.5 rounded-xl z-10 backdrop-blur-md border shadow-sm ${
            isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                Knowledge Graph Legend
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Neo4j AuraDB</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {Object.entries(CATEGORY_THEMES)
              .filter(([key]) => key !== 'Default')
              .map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-2 shrink-0"
                    style={{ 
                      backgroundColor: val.bg,
                      ringColor: isDark ? '#1E293B' : '#FFFFFF'
                    }}
                  />
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {val.label}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Node Inspector Drawer */}
      {selectedNode && (
        <div
          className={`absolute top-16 right-4 bottom-4 w-84 sm:w-96 rounded-xl p-5 z-30 flex flex-col justify-between border shadow-lg animate-in slide-in-from-right-4 duration-200 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Header Badge & Close */}
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isDark ? `${activeTheme.bg}25` : activeTheme.pillBg,
                  color: isDark ? '#93C5FD' : activeTheme.pillText,
                  border: `1px solid ${activeTheme.border}40`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeTheme.bg }}
                />
                {activeTheme.label}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Node Title & Description */}
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {selectedNode.label || selectedNode.name || selectedNode.id}
              </h3>
              {selectedNode.headline && (
                <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {selectedNode.headline}
                </p>
              )}
            </div>

            {selectedNode.desc && (
              <p className={`text-xs leading-relaxed p-3 rounded-lg border ${
                isDark ? 'bg-slate-800/60 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
              }`}>
                {selectedNode.desc}
              </p>
            )}

            {selectedNode.summary && (
              <p className={`text-xs leading-relaxed p-3 rounded-lg border ${
                isDark ? 'bg-slate-800/60 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
              }`}>
                {selectedNode.summary}
              </p>
            )}

            {/* Metadata Badges */}
            <div className="space-y-2 text-xs">
              {selectedNode.company && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Building2 className="w-3.5 h-3.5" /> Company
                  </span>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {selectedNode.company}
                  </span>
                </div>
              )}

              {selectedNode.role && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Briefcase className="w-3.5 h-3.5" /> Role / Title
                  </span>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {selectedNode.role}
                  </span>
                </div>
              )}

              {selectedNode.timeline && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Duration</span>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {selectedNode.timeline}
                  </span>
                </div>
              )}

              {selectedNode.lang && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Code className="w-3.5 h-3.5" /> Primary Tech
                  </span>
                  <span className="font-semibold text-blue-500">{selectedNode.lang}</span>
                </div>
              )}

              {selectedNode.verified && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isDark ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                }`}>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> AST Code-Verified
                  </span>
                  <span className={`font-bold text-[11px] px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    100% Proof
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Links */}
          <div className={`pt-4 mt-2 border-t space-y-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            {selectedNode.url && (
              <a
                href={selectedNode.url}
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-between py-2 px-3.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark 
                    ? 'bg-blue-950/80 text-blue-300 border-blue-800 hover:bg-blue-900' 
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> Open Link / Profile
                </span>
                <span className="text-[10px] uppercase font-mono">External &rarr;</span>
              </a>
            )}
            {selectedNode.repo_url && (
              <a
                href={selectedNode.repo_url}
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-between py-2 px-3.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark 
                    ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' 
                    : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Github className="w-3.5 h-3.5" /> GitHub Repository
                </span>
                <span className="text-[10px] uppercase font-mono">&rarr;</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

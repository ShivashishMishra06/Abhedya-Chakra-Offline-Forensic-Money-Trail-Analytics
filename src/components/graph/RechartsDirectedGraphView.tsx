import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Sankey,
  BarChart,
  Bar,
  Cell,
  Legend as RechartsLegend,
  CartesianGrid,
} from 'recharts';
import {
  GitCommit,
  Activity,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  DollarSign,
  AlertTriangle,
  ShieldAlert,
  Search,
  Sparkles,
  Info,
  Clock,
  Building,
} from 'lucide-react';
import { TraceEdge, TraceNode } from '../../types/dataset';
import { formatINR } from '../../lib/currency';
import {
  computeGraphLayout,
  findConnectedTrail,
  GraphLayoutResult,
  getTierForNode,
} from './graphLayout';

function truncateMiddle(str: string, prefixLen = 4, suffixLen = 3): string {
  if (!str) return '';
  if (str.length <= prefixLen + suffixLen + 2) return str;
  if (suffixLen === 0) return `${str.slice(0, prefixLen)}...`;
  return `${str.slice(0, prefixLen)}...${str.slice(-suffixLen)}`;
}

interface RechartsDirectedGraphViewProps {
  nodes: TraceNode[];
  edges: TraceEdge[];
  selectedAccountId?: string;
  onSelectNode: (accountNumber: string) => void;
  className?: string;
  maxVisibleHop?: number;
}

type RechartsSubView = 'DIGRAPH' | 'SANKEY' | 'METRICS';

const THEME = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  gold: '#B45309',
  goldLight: '#FEF3C7',
  navy: '#0B2545',
  navyLight: '#E0E7FF',
  redAlert: '#DC2626',
  redLight: '#FEE2E2',
  orange: '#EA580C',
  orangeLight: '#FFEDD5',
  greenSuccess: '#166534',
  greenLight: '#DCFCE7',
  edgeRest: '#94A3B8',
  edgeActive: '#0B2545',
  edgeAlert: '#DC2626',
};

export const RechartsDirectedGraphView: React.FC<RechartsDirectedGraphViewProps> = ({
  nodes,
  edges,
  selectedAccountId,
  onSelectNode,
  className = 'h-[540px]',
  maxVisibleHop = 4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSubView, setActiveSubView] = useState<RechartsSubView>('DIGRAPH');
  const [isFlowAnimated, setIsFlowAnimated] = useState<boolean>(true);
  const [showEdgeAmounts, setShowEdgeAmounts] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Compute DAG layout using Dagre crossing minimization
  const layoutResult: GraphLayoutResult = useMemo(() => {
    return computeGraphLayout(nodes, edges, maxVisibleHop);
  }, [nodes, edges, maxVisibleHop]);

  const { nodes: positionedNodes, nodeMap, edges: positionedEdges, bounds, columnHeaders } = layoutResult;

  // Active highlighted account
  const activeAccountId = hoveredNodeId || selectedAccountId || null;

  // 2. Connected upstream and downstream trail for highlighting
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    return findConnectedTrail(activeAccountId, positionedEdges);
  }, [activeAccountId, positionedEdges]);

  // 3. Filtered nodes based on search query
  const searchMatchedAccountIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const set = new Set<string>();
    positionedNodes.forEach((n) => {
      if (
        n.data.accountNumber.toLowerCase().includes(q) ||
        n.data.bankName.toLowerCase().includes(q) ||
        (n.data.primaryIfsc && n.data.primaryIfsc.toLowerCase().includes(q))
      ) {
        set.add(n.data.accountNumber);
      }
    });
    return set;
  }, [searchQuery, positionedNodes]);

  // 4. Prepare Recharts Scatter data for Directed Digraph Nodes
  const scatterNodesData = useMemo(() => {
    return positionedNodes.map((n) => {
      const isSelected = n.data.accountNumber === selectedAccountId;
      const isHovered = n.data.accountNumber === hoveredNodeId;
      const isConnected = connectedNodeIds.has(n.data.accountNumber);
      const isSearchHit = searchMatchedAccountIds ? searchMatchedAccountIds.has(n.data.accountNumber) : true;
      const isDimmed =
        (activeAccountId && !isConnected && !isSelected && !isHovered) ||
        (searchMatchedAccountIds && !isSearchHit);

      return {
        id: n.data.accountNumber,
        x: n.x,
        y: n.y,
        z: n.data.netHoldingInTrace > 0 ? 150 : 100,
        nodeData: n.data,
        positionedNode: n,
        tier: n.tier,
        tierIndex: n.tierIndex,
        isSelected,
        isHovered,
        isConnected,
        isDimmed,
      };
    });
  }, [
    positionedNodes,
    selectedAccountId,
    hoveredNodeId,
    connectedNodeIds,
    searchMatchedAccountIds,
    activeAccountId,
  ]);

  // 5. Prepare Recharts Sankey Data
  const sankeyData = useMemo(() => {
    if (positionedNodes.length === 0 || positionedEdges.length === 0) {
      return { nodes: [], links: [] };
    }

    // Filter edges by maxVisibleHop
    const validEdges = positionedEdges.filter((e) => {
      const srcNode = nodeMap.get(e.source);
      const tgtNode = nodeMap.get(e.target);
      if (!srcNode || !tgtNode) return false;
      return srcNode.tierIndex <= maxVisibleHop && tgtNode.tierIndex <= maxVisibleHop;
    });

    if (validEdges.length === 0) {
      return { nodes: [], links: [] };
    }

    // Distinct nodes participating in valid edges
    const activeNodeIds = new Set<string>();
    validEdges.forEach((e) => {
      activeNodeIds.add(e.source);
      activeNodeIds.add(e.target);
    });

    const orderedNodes = positionedNodes.filter((n) => activeNodeIds.has(n.data.accountNumber));
    const nodeIdToIndex = new Map<string, number>();
    const nodesArray = orderedNodes.map((n, index) => {
      nodeIdToIndex.set(n.data.accountNumber, index);
      const tierInfo = getTierForNode(n.data);
      return {
        name: `${n.data.bankName} (${truncateMiddle(n.data.accountNumber, 4, 3)})`,
        accountNumber: n.data.accountNumber,
        bankName: n.data.bankName,
        layer: n.data.layer,
        tier: tierInfo.tier,
        holding: n.data.netHoldingInTrace,
        riskScore: n.data.riskScore,
        data: n.data,
      };
    });

    // Merge directed links between same source and target
    const linkMap = new Map<string, { source: number; target: number; value: number; count: number }>();
    validEdges.forEach((e) => {
      const sIdx = nodeIdToIndex.get(e.source);
      const tIdx = nodeIdToIndex.get(e.target);
      if (sIdx !== undefined && tIdx !== undefined && sIdx !== tIdx) {
        const key = `${sIdx}->${tIdx}`;
        const existing = linkMap.get(key);
        const amount = Math.max(1, Math.round(e.amount));
        if (existing) {
          existing.value += amount;
          existing.count += e.count;
        } else {
          linkMap.set(key, { source: sIdx, target: tIdx, value: amount, count: e.count });
        }
      }
    });

    return {
      nodes: nodesArray,
      links: Array.from(linkMap.values()),
    };
  }, [positionedNodes, positionedEdges, nodeMap, maxVisibleHop]);

  // 6. Hop Flow Metrics Data for Bar/Metrics View
  const hopMetricsData = useMemo(() => {
    const hopMap = new Map<
      number,
      { hop: number; label: string; totalInflow: number; totalOutflow: number; retained: number; accountCount: number }
    >();

    const labels = ['Victim (Hop 0)', 'L1 Aggregators', 'L2 Distributors', 'L3 Terminals'];

    [0, 1, 2, 3].forEach((hop) => {
      hopMap.set(hop, {
        hop,
        label: labels[hop] || `Hop ${hop}`,
        totalInflow: 0,
        totalOutflow: 0,
        retained: 0,
        accountCount: 0,
      });
    });

    nodes.forEach((n) => {
      const hop = Math.min(3, n.hop ?? 0);
      const record = hopMap.get(hop);
      if (record) {
        record.totalInflow += n.inflowFromTrace;
        record.totalOutflow += n.outflowInTrace;
        record.retained += n.netHoldingInTrace;
        record.accountCount += 1;
      }
    });

    return Array.from(hopMap.values());
  }, [nodes]);

  // Hovered node details for inspector summary
  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return nodeMap.get(hoveredNodeId)?.data || null;
  }, [hoveredNodeId, nodeMap]);

  // Hovered edge details for inspector summary
  const hoveredEdge = useMemo(() => {
    if (!hoveredEdgeId) return null;
    return positionedEdges.find((e) => e.id === hoveredEdgeId) || null;
  }, [hoveredEdgeId, positionedEdges]);

  // Scale bounds for scatter chart coordinate system
  const paddingX = 60;
  const paddingY = 50;
  const graphWidth = Math.max(400, bounds.width + paddingX * 2);
  const graphHeight = Math.max(300, bounds.height + paddingY * 2);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] overflow-hidden shadow-xs ${className} ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-32px)] bg-[#F8FAFC] shadow-2xl' : ''
      }`}
    >
      {/* Top Police Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1] bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-[4px] bg-[#0B2545] text-white">
            <Activity className="h-4 w-4 text-[#E2B734]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                Recharts Directed Fund Flow Visualizer
              </span>
              <span className="rounded-[3px] bg-[#E0E7FF] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#0B2545] border border-[#CBD5E1]">
                {positionedNodes.length} Accounts &middot; {positionedEdges.length} Transfers
              </span>
            </div>
            <p className="text-[10px] text-[#64748B]">
              Standardized Directed Graph & Volumetric Flow Model for Criminal Fund Tracing
            </p>
          </div>
        </div>

        {/* View Switcher Sub-Tabs */}
        <div className="flex items-center gap-1 rounded-[6px] border border-[#CBD5E1] bg-[#F1F5F9] p-0.5 text-xs font-mono">
          <button
            onClick={() => setActiveSubView('DIGRAPH')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] cursor-pointer transition-colors ${
              activeSubView === 'DIGRAPH'
                ? 'bg-[#0B2545] text-white font-bold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
            title="Directed Topology Digraph using Recharts"
          >
            <GitCommit className="h-3.5 w-3.5" />
            <span>Directed Digraph</span>
          </button>

          <button
            onClick={() => setActiveSubView('SANKEY')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] cursor-pointer transition-colors ${
              activeSubView === 'SANKEY'
                ? 'bg-[#0B2545] text-white font-bold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
            title="Volumetric Flow using Recharts Sankey"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Sankey Flow</span>
          </button>

          <button
            onClick={() => setActiveSubView('METRICS')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] cursor-pointer transition-colors ${
              activeSubView === 'METRICS'
                ? 'bg-[#0B2545] text-white font-bold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
            title="Layer Dispersion & Retention Matrix"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Hop Metrics</span>
          </button>
        </div>

        {/* Action & Toggle Controls */}
        <div className="flex items-center gap-2">
          {activeSubView === 'DIGRAPH' && (
            <>
              <button
                onClick={() => setIsFlowAnimated(!isFlowAnimated)}
                className={`flex items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
                  isFlowAnimated
                    ? 'border-[#0B2545] bg-[#E0E7FF] text-[#0B2545] font-bold'
                    : 'border-[#CBD5E1] bg-white text-[#64748B]'
                }`}
                title="Toggle animated current pulses along transfer arrows"
              >
                <Sparkles className="h-3 w-3" />
                <span>Flow Pulse</span>
              </button>

              <button
                onClick={() => setShowEdgeAmounts(!showEdgeAmounts)}
                className={`flex items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
                  showEdgeAmounts
                    ? 'border-[#0B2545] bg-[#E0E7FF] text-[#0B2545] font-bold'
                    : 'border-[#CBD5E1] bg-white text-[#64748B]'
                }`}
                title="Toggle ₹ amounts on directed arrows"
              >
                <DollarSign className="h-3 w-3" />
                <span>₹ Labels</span>
              </button>
            </>
          )}

          {/* Account search within graph */}
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Filter account or bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-40 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] pl-7 pr-2 text-[11px] font-mono text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0B2545] focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center justify-center h-7 w-7 rounded-[4px] border border-[#CBD5E1] bg-white text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="relative flex-1 w-full bg-[#F8FAFC] overflow-hidden min-h-[380px]">
        {/* SUBVIEW 1: DIRECTED TOPOLOGY DIGRAPH (RECHARTS SCATTER + CUSTOMIZED ARROWS) */}
        {activeSubView === 'DIGRAPH' && (
          <div className="relative h-full w-full">
            {/* SVG Canvas for Layer Column Guides & Recharts Flow Graph */}
            <div className="absolute inset-0 overflow-auto">
              <svg
                width={Math.max(graphWidth, 750)}
                height={Math.max(graphHeight, 480)}
                viewBox={`${bounds.minX - paddingX} ${bounds.minY - paddingY} ${graphWidth} ${graphHeight}`}
                className="w-full h-full"
                style={{ minWidth: '700px', minHeight: '440px' }}
              >
                {/* SVG Marker Definitions for Directed Digraph Arrowheads */}
                <defs>
                  {/* Default arrow */}
                  <marker
                    id="recharts-arrowhead-rest"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94A3B8" />
                  </marker>

                  {/* Active/Connected arrow */}
                  <marker
                    id="recharts-arrowhead-active"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0B2545" />
                  </marker>

                  {/* Alert/High Value arrow */}
                  <marker
                    id="recharts-arrowhead-alert"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#DC2626" />
                  </marker>

                  {/* Grid pattern */}
                  <pattern id="recharts-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#CBD5E1" opacity="0.6" />
                  </pattern>

                  {/* Node shadows */}
                  <filter id="node-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
                  </filter>
                </defs>

                {/* Subtle Background dot pattern */}
                <rect
                  x={bounds.minX - paddingX}
                  y={bounds.minY - paddingY}
                  width={graphWidth}
                  height={graphHeight}
                  fill="url(#recharts-grid-dots)"
                />

                {/* Column Hop Header Background Ribbons */}
                {columnHeaders.map((col) => (
                  <g key={col.tierIndex}>
                    <line
                      x1={col.x}
                      y1={bounds.minY - paddingY + 30}
                      x2={col.x}
                      y2={bounds.maxY + paddingY}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={col.x - 70}
                      y={bounds.minY - paddingY + 8}
                      width="140"
                      height="24"
                      rx="4"
                      fill="#FFFFFF"
                      stroke="#CBD5E1"
                      strokeWidth="1"
                    />
                    <text
                      x={col.x}
                      y={bounds.minY - paddingY + 24}
                      textAnchor="middle"
                      fill="#0B2545"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {col.title.toUpperCase()}
                    </text>
                  </g>
                ))}

                {/* DIRECTED EDGES (ARROWS) */}
                <g className="directed-edges-layer">
                  {positionedEdges.map((edge) => {
                    const isSelectedEdge = hoveredEdgeId === edge.id;
                    const isConnected = connectedEdgeIds.has(edge.id);
                    const isDimmed = activeAccountId && !isConnected;
                    const isHoldingEdge =
                      edge.amount >= 200000 || nodeMap.get(edge.target)?.data.isHolding;

                    let markerId = 'recharts-arrowhead-rest';
                    let strokeColor = THEME.edgeRest;
                    let strokeWidth = Math.min(4, Math.max(1.5, Math.log10(Math.max(10, edge.amount)) * 0.7));

                    if (isConnected || isSelectedEdge) {
                      markerId = isHoldingEdge ? 'recharts-arrowhead-alert' : 'recharts-arrowhead-active';
                      strokeColor = isHoldingEdge ? THEME.redAlert : THEME.navy;
                      strokeWidth = Math.max(2.5, strokeWidth + 1);
                    } else if (isDimmed) {
                      strokeColor = '#E2E8F0';
                      strokeWidth = 1;
                    }

                    // Cubic Bezier path
                    const pathData = `M ${edge.startX} ${edge.startY} C ${edge.cp1X} ${edge.cp1Y}, ${edge.cp2X} ${edge.cp2Y}, ${edge.endX} ${edge.endY}`;

                    return (
                      <g
                        key={edge.id}
                        className="cursor-pointer transition-opacity"
                        opacity={isDimmed ? 0.35 : 1}
                        onMouseEnter={() => setHoveredEdgeId(edge.id)}
                        onMouseLeave={() => setHoveredEdgeId(null)}
                      >
                        {/* Edge hover hit area */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="18"
                        />

                        {/* Directed Base Path */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          markerEnd={`url(#${markerId})`}
                        />

                        {/* Animated Current Pulses (Flow of funds simulation) */}
                        {isFlowAnimated && !isDimmed && (
                          <path
                            d={pathData}
                            fill="none"
                            stroke={isConnected ? '#E2B734' : '#CBD5E1'}
                            strokeWidth={Math.max(1.5, strokeWidth * 0.7)}
                            strokeDasharray="6 8"
                            strokeDashoffset="0"
                            className="animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                            opacity={isConnected ? 0.9 : 0.6}
                          />
                        )}

                        {/* Transfer Rupee Amount Badge along the arrow */}
                        {showEdgeAmounts && !isDimmed && (
                          <g transform={`translate(${edge.midX}, ${edge.midY})`}>
                            <rect
                              x="-34"
                              y="-10"
                              width="68"
                              height="20"
                              rx="3"
                              fill="#FFFFFF"
                              stroke={isConnected ? strokeColor : '#CBD5E1'}
                              strokeWidth="1"
                              filter="url(#node-shadow)"
                            />
                            <text
                              x="0"
                              y="3"
                              textAnchor="middle"
                              fill={isConnected ? strokeColor : '#475569'}
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {formatINR(edge.amount)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* DIRECTED GRAPH VERTICES (NODES) */}
                <g className="directed-nodes-layer">
                  {positionedNodes.map((pNode) => {
                    const node = pNode.data;
                    const isSelected = node.accountNumber === selectedAccountId;
                    const isHovered = node.accountNumber === hoveredNodeId;
                    const isConnected = connectedNodeIds.has(node.accountNumber);
                    const isSearchHit = searchMatchedAccountIds
                      ? searchMatchedAccountIds.has(node.accountNumber)
                      : true;
                    const isDimmed =
                      (activeAccountId && !isConnected && !isSelected && !isHovered) ||
                      (searchMatchedAccountIds && !isSearchHit);

                    const tierInfo = getTierForNode(node);
                    const isVictim = tierInfo.tierIndex === 0;
                    const isHolding = node.isHolding || node.netHoldingInTrace > 0;

                    // Node styles based on role
                    let badgeBg = '#FFFFFF';
                    let badgeBorder = '#CBD5E1';
                    let badgeAccent = '#0B2545';
                    let roleLabel = 'L1 MULE';

                    if (isVictim) {
                      badgeAccent = '#B45309';
                      badgeBorder = '#B45309';
                      roleLabel = 'VICTIM';
                    } else if (isHolding) {
                      badgeAccent = '#DC2626';
                      badgeBorder = '#DC2626';
                      roleLabel = 'FREEZE';
                    } else if (tierInfo.tierIndex === 1) {
                      badgeAccent = '#D97706';
                      roleLabel = 'L1 COLLECTOR';
                    } else if (tierInfo.tierIndex === 2) {
                      badgeAccent = '#EA580C';
                      roleLabel = 'L2 LAYERING';
                    } else {
                      badgeAccent = '#0B2545';
                      roleLabel = 'L3 TERMINAL';
                    }

                    if (isSelected || isHovered) {
                      badgeBorder = '#0B2545';
                    }

                    const cardWidth = 120;
                    const cardHeight = 56;
                    const halfW = cardWidth / 2;
                    const halfH = cardHeight / 2;

                    return (
                      <g
                        key={node.accountNumber}
                        transform={`translate(${pNode.x}, ${pNode.y})`}
                        className="cursor-pointer transition-all"
                        opacity={isDimmed ? 0.35 : 1}
                        onClick={() => onSelectNode(node.accountNumber)}
                        onMouseEnter={() => setHoveredNodeId(node.accountNumber)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        {/* Active Selection Glow Ring */}
                        {(isSelected || isHovered) && (
                          <rect
                            x={-halfW - 4}
                            y={-halfH - 4}
                            width={cardWidth + 8}
                            height={cardHeight + 8}
                            rx="8"
                            fill="none"
                            stroke={isHolding ? '#DC2626' : '#0B2545'}
                            strokeWidth="2.5"
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Account Card Container */}
                        <rect
                          x={-halfW}
                          y={-halfH}
                          width={cardWidth}
                          height={cardHeight}
                          rx="6"
                          fill={badgeBg}
                          stroke={badgeBorder}
                          strokeWidth={isSelected || isHovered ? 2 : 1.2}
                          filter="url(#node-shadow)"
                        />

                        {/* Top Role Header Bar */}
                        <path
                          d={`M ${-halfW} ${-halfH + 6} A 6 6 0 0 1 ${-halfW + 6} ${-halfH} L ${halfW - 6} ${-halfH} A 6 6 0 0 1 ${halfW} ${-halfH + 6} L ${halfW} ${-halfH + 16} L ${-halfW} ${-halfH + 16} Z`}
                          fill={badgeAccent}
                        />

                        {/* Role text */}
                        <text
                          x="0"
                          y={-halfH + 12}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {roleLabel}
                        </text>

                        {/* Bank Name */}
                        <text
                          x={-halfW + 8}
                          y={-halfH + 28}
                          textAnchor="start"
                          fill="#0F172A"
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="bold"
                        >
                          {truncateMiddle(node.bankName, 10, 0)}
                        </text>

                        {/* Account Number */}
                        <text
                          x={-halfW + 8}
                          y={-halfH + 40}
                          textAnchor="start"
                          fill="#64748B"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {truncateMiddle(node.accountNumber, 4, 3)}
                        </text>

                        {/* Holding amount or Net Balance Pill */}
                        <text
                          x={halfW - 8}
                          y={-halfH + 48}
                          textAnchor="end"
                          fill={isHolding ? '#DC2626' : '#166534'}
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {isHolding
                            ? `HOLD ${formatINR(node.netHoldingInTrace)}`
                            : formatINR(node.inflowFromTrace)}
                        </text>

                        {/* Risk score pill in top right corner */}
                        {node.riskScore > 0 && !isVictim && (
                          <g transform={`translate(${halfW - 14}, ${-halfH + 8})`}>
                            <circle
                              cx="0"
                              cy="0"
                              r="7"
                              fill={node.riskScore >= 70 ? '#DC2626' : '#D97706'}
                            />
                            <text
                              x="0"
                              y="2.5"
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="7"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {Math.round(node.riskScore)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>
        )}

        {/* SUBVIEW 2: VOLUMETRIC SANKEY FLOW (RECHARTS SANKEY) */}
        {activeSubView === 'SANKEY' && (
          <div className="h-full w-full p-4 flex flex-col justify-between">
            <div className="mb-2 flex items-center justify-between text-xs font-mono text-[#64748B]">
              <span>Proportional Fund Volume (Band thickness = Value in ₹)</span>
              <span>Click any node to select account</span>
            </div>

            {sankeyData.nodes.length > 0 && sankeyData.links.length > 0 ? (
              <div className="h-[440px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={sankeyData}
                    nodePadding={24}
                    nodeWidth={18}
                    linkCurvature={0.5}
                    margin={{ top: 20, right: 180, bottom: 20, left: 20 }}
                    node={(props: any) => {
                      const { x, y, width, height, index, payload } = props;
                      const isSelected = payload.accountNumber === selectedAccountId;
                      const isHolding = (payload.holding || 0) > 0;
                      let fill = '#0B2545';
                      if (payload.tier === 'VICTIM') fill = '#B45309';
                      else if (isHolding) fill = '#DC2626';
                      else if (payload.tier === 'L1') fill = '#D97706';
                      else if (payload.tier === 'L2') fill = '#EA580C';

                      return (
                        <g
                          className="cursor-pointer"
                          onClick={() => onSelectNode(payload.accountNumber)}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={Math.max(10, height)}
                            fill={fill}
                            rx={3}
                            stroke={isSelected ? '#0F172A' : fill}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                          <text
                            x={x + width + 8}
                            y={y + Math.max(10, height) / 2 - 3}
                            textAnchor="start"
                            fill="#0F172A"
                            fontSize="10"
                            fontFamily="sans-serif"
                            fontWeight="bold"
                          >
                            {payload.bankName}
                          </text>
                          <text
                            x={x + width + 8}
                            y={y + Math.max(10, height) / 2 + 10}
                            textAnchor="start"
                            fill="#64748B"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {truncateMiddle(payload.accountNumber, 4, 3)}
                            {isHolding ? ` (Hold: ${formatINR(payload.holding)})` : ''}
                          </text>
                        </g>
                      );
                    }}
                    link={(props: any) => {
                      const {
                        sourceX,
                        targetX,
                        sourceY,
                        targetY,
                        sourceControlX,
                        targetControlX,
                        linkWidth,
                        payload,
                      } = props;
                      const path = `M ${sourceX} ${sourceY} C ${sourceControlX} ${sourceY}, ${targetControlX} ${targetY}, ${targetX} ${targetY}`;

                      return (
                        <path
                          d={path}
                          fill="none"
                          stroke="#0B2545"
                          strokeWidth={Math.max(2, linkWidth)}
                          strokeOpacity={0.25}
                          className="hover:stroke-[#DC2626] hover:stroke-opacity-80 transition-all cursor-pointer"
                        >
                          <title>
                            {`Transfer: ${formatINR(payload.value || 0)}`}
                          </title>
                        </path>
                      );
                    }}
                  >
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0];
                        return (
                          <div className="rounded-[6px] border border-[#CBD5E1] bg-white p-2.5 font-mono text-xs shadow-md">
                            <p className="font-bold text-[#0B2545]">{data.name}</p>
                            <p className="text-[#DC2626] mt-0.5 font-bold">
                              Routed: {formatINR(data.value)}
                            </p>
                          </div>
                        );
                      }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-20 text-center text-xs font-mono text-[#64748B]">
                Insufficient multi-hop branches to compute Sankey distribution. Use Directed Digraph.
              </div>
            )}
          </div>
        )}

        {/* SUBVIEW 3: HOP METRICS & RETENTION MATRIX (RECHARTS BAR CHART) */}
        {activeSubView === 'METRICS' && (
          <div className="h-full w-full p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              {hopMetricsData.map((hm) => (
                <div
                  key={hm.hop}
                  className="rounded-[6px] border border-[#CBD5E1] bg-white p-3 shadow-xs"
                >
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">{hm.label}</span>
                  <p className="text-sm font-bold text-[#0B2545] mt-1">{hm.accountCount} Accounts</p>
                  <div className="mt-2 text-[11px] space-y-1">
                    <div className="flex justify-between text-[#DC2626]">
                      <span>Inflow:</span>
                      <span>{formatINR(hm.totalInflow)}</span>
                    </div>
                    <div className="flex justify-between text-[#B45309]">
                      <span>Trapped/Held:</span>
                      <span className="font-bold">{formatINR(hm.retained)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[6px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <h4 className="font-serif text-xs font-bold text-[#0B2545] mb-3 uppercase tracking-wider">
                Fund Dissipation Across Directed Hops (Inflow vs Retained Balance)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hopMetricsData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => formatINR(Number(val) || 0)}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                      }}
                    />
                    <RechartsLegend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="totalInflow" name="Total Inflow Routed" fill="#0B2545" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="retained" name="Retained Balance (Freeze Target)" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Hover Inspector Pill / Fast Info Overlay */}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 z-30 max-w-sm rounded-[6px] border border-[#CBD5E1] bg-white p-3 font-mono text-xs shadow-lg pointer-events-none">
            <div className="flex items-center gap-1.5 font-bold text-[#0B2545]">
              <Building className="h-3.5 w-3.5 text-[#B45309]" />
              <span>{hoveredNode.bankName}</span>
              <span className="text-[#64748B]">({hoveredNode.accountNumber})</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div>
                <span className="text-[#64748B]">Layer:</span>{' '}
                <strong className="text-[#0F172A]">{hoveredNode.layer}</strong>
              </div>
              <div>
                <span className="text-[#64748B]">Risk Score:</span>{' '}
                <strong className={hoveredNode.riskScore >= 70 ? 'text-[#DC2626]' : 'text-[#D97706]'}>
                  {hoveredNode.riskScore}/100
                </strong>
              </div>
              <div>
                <span className="text-[#64748B]">Inflow:</span>{' '}
                <strong className="text-[#166534]">{formatINR(hoveredNode.inflowFromTrace)}</strong>
              </div>
              <div>
                <span className="text-[#64748B]">Holding:</span>{' '}
                <strong className={hoveredNode.netHoldingInTrace > 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}>
                  {formatINR(hoveredNode.netHoldingInTrace)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {hoveredEdge && (
          <div className="absolute bottom-3 left-3 z-30 max-w-sm rounded-[6px] border border-[#CBD5E1] bg-white p-3 font-mono text-xs shadow-lg pointer-events-none">
            <div className="flex items-center gap-1.5 font-bold text-[#0B2545]">
              <ArrowRight className="h-3.5 w-3.5 text-[#DC2626]" />
              <span>Transfer: {formatINR(hoveredEdge.amount)}</span>
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              From: <span className="font-bold text-[#0F172A]">{truncateMiddle(hoveredEdge.source, 5, 4)}</span> &rarr;{' '}
              To: <span className="font-bold text-[#0F172A]">{truncateMiddle(hoveredEdge.target, 5, 4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Police Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#CBD5E1] bg-white px-4 py-2 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#64748B] font-bold uppercase">Roles:</span>
          <span className="flex items-center gap-1.5 text-[#0F172A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#B45309]" />
            Victim Source
          </span>
          <span className="flex items-center gap-1.5 text-[#0F172A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
            L1 Collector
          </span>
          <span className="flex items-center gap-1.5 text-[#0F172A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EA580C]" />
            L2 Layering
          </span>
          <span className="flex items-center gap-1.5 text-[#0F172A]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0B2545]" />
            L3 Terminal
          </span>
          <span className="flex items-center gap-1.5 text-[#DC2626] font-bold">
            <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
            Section 91 Freeze Target
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#64748B]">
          <Info className="h-3 w-3" />
          <span>Arrows designate verified chronological fund vectors</span>
        </div>
      </div>
    </div>
  );
};

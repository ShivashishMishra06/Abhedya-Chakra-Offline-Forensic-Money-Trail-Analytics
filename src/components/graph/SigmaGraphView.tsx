import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { TraceEdge, TraceNode } from '../../types/dataset';
import { formatINR } from '../../lib/currency';
import {
  computeGraphLayout,
  findConnectedTrail,
  GraphLayoutResult,
  MergedEdge,
  PositionedNode,
} from './graphLayout';

interface SigmaGraphViewProps {
  nodes: TraceNode[];
  edges: TraceEdge[];
  selectedAccountId?: string;
  onSelectNode: (accountNumber: string) => void;
  className?: string;
  maxVisibleHop?: number; // Progressive rendering: 1 = Victim + L1, 2 = L2, 3+ = All
}

// Colors adhering to the official Indian Police Portal theme (Light slate canvas, Police Navy, Gold, Alert Red)
const THEME = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  gold: '#B45309',
  navy: '#0B2545',
  redAlert: '#DC2626',
  greenSuccess: '#166534',
  edgeRest: '#94A3B8',
  gridDot: '#CBD5E1',
};

export const SigmaGraphView: React.FC<SigmaGraphViewProps> = ({
  nodes,
  edges,
  selectedAccountId,
  onSelectNode,
  className = 'h-[540px]',
  maxVisibleHop = 4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan and Zoom view state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover and fullscreen state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 1. Compute layered layout with Dagre crossing minimization
  const layoutResult: GraphLayoutResult = useMemo(() => {
    return computeGraphLayout(nodes, edges, maxVisibleHop);
  }, [nodes, edges, maxVisibleHop]);

  const { nodes: positionedNodes, nodeMap, edges: positionedEdges, columnHeaders, bounds } = layoutResult;

  // Threshold: SVG up to 150 nodes, switch to Canvas renderer above 150 nodes
  const useCanvasRenderer = positionedNodes.length > 150;

  // Active highlighted account: hover takes immediate precedence, followed by clicked selection
  const activeAccountId = hoveredNodeId || selectedAccountId || null;

  // 2. Compute connected trail for highlighted paths (upstream and downstream)
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    return findConnectedTrail(activeAccountId, positionedEdges);
  }, [activeAccountId, positionedEdges]);

  // Hovered node data for dossier tooltip overlay
  const hoveredNodeData = useMemo(() => {
    if (!hoveredNodeId) return null;
    return nodeMap.get(hoveredNodeId)?.data || null;
  }, [hoveredNodeId, nodeMap]);

  // Hovered edge data for transaction tooltip
  const hoveredEdgeData = useMemo(() => {
    if (!hoveredEdgeId) return null;
    return positionedEdges.find((e) => e.id === hoveredEdgeId) || null;
  }, [hoveredEdgeId, positionedEdges]);

  // 3. Auto-fit graph to container on initial load or trace changes
  const fitGraphToScreen = useCallback(() => {
    if (!containerRef.current || positionedNodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 800;
    const containerHeight = rect.height || 540;

    const padding = 75;
    const graphWidth = Math.max(200, bounds.width + padding * 2);
    const graphHeight = Math.max(200, bounds.height + padding * 2);

    const scaleX = containerWidth / graphWidth;
    const scaleY = containerHeight / graphHeight;
    const initialScale = Math.min(1.35, Math.max(0.35, Math.min(scaleX, scaleY)));

    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;

    const initialPanX = containerWidth / 2 - centerX * initialScale;
    const initialPanY = containerHeight / 2 - centerY * initialScale;

    setZoom(Math.round(initialScale * 100) / 100);
    setPan({ x: Math.round(initialPanX), y: Math.round(initialPanY) });
  }, [bounds, positionedNodes.length]);

  // Trigger auto-fit when graph layout updates
  useEffect(() => {
    fitGraphToScreen();
  }, [fitGraphToScreen]);

  // 4. Mouse interaction handlers for Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      return;
    }

    // In canvas mode, hit test coordinates against nodes
    if (useCanvasRenderer && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      let foundNode: PositionedNode | null = null;
      for (const node of positionedNodes) {
        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
          foundNode = node;
          break;
        }
      }

      if (foundNode) {
        setHoveredNodeId(foundNode.data.accountNumber);
      } else {
        setHoveredNodeId(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(3.0, Math.max(0.25, zoom * zoomFactor));

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(Math.round(newZoom * 100) / 100);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(3.0, zoom * 1.25);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
    const newPanY = cy - (cy - pan.y) * (newZoom / zoom);
    setZoom(Math.round(newZoom * 100) / 100);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.25, zoom * 0.8);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
    const newPanY = cy - (cy - pan.y) * (newZoom / zoom);
    setZoom(Math.round(newZoom * 100) / 100);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(fitGraphToScreen, 60);
  };

  // 5. Canvas Renderer for large node counts (> 150 nodes)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !useCanvasRenderer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark canvas background
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    // Apply Pan and Zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Faint dot grid (#1A1A1A)
    const dotSpacing = 24;
    const startGridX = Math.floor((bounds.minX - 250) / dotSpacing) * dotSpacing;
    const endGridX = Math.ceil((bounds.maxX + 250) / dotSpacing) * dotSpacing;
    const startGridY = Math.floor((bounds.minY - 250) / dotSpacing) * dotSpacing;
    const endGridY = Math.ceil((bounds.maxY + 250) / dotSpacing) * dotSpacing;

    ctx.fillStyle = THEME.gridDot;
    for (let gx = startGridX; gx <= endGridX; gx += dotSpacing) {
      for (let gy = startGridY; gy <= endGridY; gy += dotSpacing) {
        ctx.fillRect(gx, gy, 1.2, 1.2);
      }
    }

    // Tier column labels above each column
    ctx.font = '600 11px IBM Plex Mono, monospace';
    ctx.fillStyle = THEME.textSecondary;
    ctx.textAlign = 'center';
    columnHeaders.forEach((col) => {
      ctx.fillText(col.title.toUpperCase(), col.x, col.y);
    });

    const hasActive = Boolean(activeAccountId);

    // Render Edges (smooth cubic bezier)
    positionedEdges.forEach((edge) => {
      const isHighlighted = connectedEdgeIds.has(edge.id);
      const edgeOpacity = hasActive ? (isHighlighted ? 1.0 : 0.15) : 1.0;
      const edgeStroke = isHighlighted ? THEME.gold : THEME.edgeRest;
      const edgeWidth = isHighlighted ? Math.max(2, edge.strokeWidth * 1.5) : edge.strokeWidth;

      ctx.save();
      ctx.globalAlpha = edgeOpacity;
      ctx.strokeStyle = edgeStroke;
      ctx.lineWidth = edgeWidth;

      if (isHighlighted) {
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -((Date.now() / 60) % 20);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(edge.startX, edge.startY);
      ctx.bezierCurveTo(edge.cp1X, edge.cp1Y, edge.cp2X, edge.cp2Y, edge.endX, edge.endY);
      ctx.stroke();

      // Arrowhead at target node edge
      ctx.beginPath();
      if (edge.isLoop) {
        ctx.moveTo(edge.endX, edge.endY);
        ctx.lineTo(edge.endX + 7, edge.endY - 3.8);
        ctx.lineTo(edge.endX + 7, edge.endY + 3.8);
      } else {
        ctx.moveTo(edge.endX, edge.endY);
        ctx.lineTo(edge.endX - 7, edge.endY - 3.8);
        ctx.lineTo(edge.endX - 7, edge.endY + 3.8);
      }
      ctx.closePath();
      ctx.fillStyle = edgeStroke;
      ctx.fill();

      // Merged parallel transfers count badge
      if (edge.count > 1) {
        ctx.fillStyle = THEME.card;
        ctx.strokeStyle = isHighlighted ? THEME.gold : THEME.edgeRest;
        ctx.lineWidth = 1;
        ctx.fillRect(edge.midX - 11, edge.midY - 8, 22, 16);
        ctx.strokeRect(edge.midX - 11, edge.midY - 8, 22, 16);
        ctx.fillStyle = isHighlighted ? THEME.gold : THEME.textSecondary;
        ctx.font = '600 9px IBM Plex Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${edge.count}x`, edge.midX, edge.midY);
      }

      ctx.restore();
    });

    // Render Nodes (Tier-specific shapes with 1.5px #0A0A0A border)
    positionedNodes.forEach((node) => {
      const isHighlighted = connectedNodeIds.has(node.data.accountNumber);
      const isSelected = node.data.accountNumber === selectedAccountId;
      const isHovered = node.data.accountNumber === hoveredNodeId;
      const nodeOpacity = hasActive ? (isHighlighted ? 1.0 : 0.15) : 1.0;

      ctx.save();
      ctx.globalAlpha = nodeOpacity;

      const { tier, x, y, radius } = node;

      if (tier === 'VICTIM') {
        // Victim: Thin outer ring + White inner circle + Shield glyph + 1.5px #0A0A0A border
        ctx.beginPath();
        ctx.arc(x, y, radius + 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = isHighlighted ? THEME.gold : '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = THEME.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Simple shield glyph inside (black)
        ctx.fillStyle = THEME.bg;
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 5.5, y - 3.5);
        ctx.lineTo(x + 5.5, y);
        ctx.quadraticCurveTo(x + 5.5, y + 4.2, x, y + 8);
        ctx.quadraticCurveTo(x - 5.5, y + 4.2, x - 5.5, y);
        ctx.lineTo(x - 5.5, y - 3.5);
        ctx.closePath();
        ctx.fill();
      } else if (tier === 'L1') {
        // Layer 1: Hexagon + Alert Red (#B3261E) + Bank glyph + 1.5px #0A0A0A border
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          const px = x + radius * Math.cos(angle);
          const py = y + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = THEME.redAlert;
        ctx.fill();
        ctx.strokeStyle = THEME.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Simple bank glyph in white
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(x, y - 7.5);
        ctx.lineTo(x + 6.5, y - 2);
        ctx.lineTo(x - 6.5, y - 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 4.5, y - 0.5);
        ctx.lineTo(x - 4.5, y + 4.5);
        ctx.moveTo(x - 1.5, y - 0.5);
        ctx.lineTo(x - 1.5, y + 4.5);
        ctx.moveTo(x + 1.5, y - 0.5);
        ctx.lineTo(x + 1.5, y + 4.5);
        ctx.moveTo(x + 4.5, y - 0.5);
        ctx.lineTo(x + 4.5, y + 4.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - 7, y + 5.5);
        ctx.lineTo(x + 7, y + 5.5);
        ctx.stroke();
      } else if (tier === 'L2') {
        // Layer 2: Rounded Diamond + Gold (#C9A227) + Arrows-exchange glyph + 1.5px #0A0A0A border
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        const dSize = 25;
        const half = dSize / 2;
        const cornerR = 3.5;
        ctx.roundRect(-half, -half, dSize, dSize, cornerR);
        ctx.fillStyle = THEME.gold;
        ctx.fill();
        ctx.strokeStyle = THEME.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Arrows-exchange glyph inside (black)
        ctx.strokeStyle = THEME.bg;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 5.5, y - 2.5);
        ctx.lineTo(x + 3.5, y - 2.5);
        ctx.moveTo(x + 1, y - 4.8);
        ctx.lineTo(x + 3.8, y - 2.5);
        ctx.lineTo(x + 1, y - 0.2);

        ctx.moveTo(x + 5.5, y + 2.5);
        ctx.lineTo(x - 3.5, y + 2.5);
        ctx.moveTo(x - 1, y + 0.2);
        ctx.lineTo(x - 3.8, y + 2.5);
        ctx.lineTo(x - 1, y + 4.8);
        ctx.stroke();
      } else {
        // Layer 3: Circle + Police Navy (#1F3A5F) outline + Dark fill + Downward arrow glyph + 1.5px #0A0A0A border
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = THEME.card;
        ctx.fill();
        ctx.strokeStyle = THEME.navy;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = THEME.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Small downward arrow in white
        ctx.strokeStyle = THEME.textPrimary;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 3.5);
        ctx.moveTo(x - 3.5, y);
        ctx.lineTo(x, y + 3.8);
        ctx.lineTo(x + 3.5, y);
        ctx.stroke();
      }

      // Selection or Hover ring halo
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = THEME.gold;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Account ID label below node (IBM Plex Mono, truncated in middle, full on hover)
      ctx.font = '500 10.5px IBM Plex Mono, monospace';
      ctx.fillStyle = isHighlighted ? THEME.textPrimary : THEME.textSecondary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelText = isHovered ? node.data.accountNumber : node.truncatedLabel;
      ctx.fillText(labelText, x, y + radius + 7);

      ctx.restore();
    });

    ctx.restore();
  }, [
    useCanvasRenderer,
    pan,
    zoom,
    bounds,
    columnHeaders,
    positionedEdges,
    positionedNodes,
    connectedEdgeIds,
    connectedNodeIds,
    activeAccountId,
    selectedAccountId,
    hoveredNodeId,
  ]);

  // Canvas size and animation loop when canvas is active
  useEffect(() => {
    if (!useCanvasRenderer) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    renderCanvas();

    // Only run animation if a path is actively highlighted
    if (activeAccountId && connectedEdgeIds.size > 0) {
      let animId: number;
      const animate = () => {
        renderCanvas();
        animId = requestAnimationFrame(animate);
      };
      animId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animId);
    }
  }, [useCanvasRenderer, renderCanvas, activeAccountId, connectedEdgeIds]);

  const hasActive = Boolean(activeAccountId);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsPanning(false);
        setHoveredNodeId(null);
        setHoveredEdgeId(null);
      }}
      onWheel={handleWheel}
      className={`relative w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-[6px] overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-xs ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : className
      }`}
    >
      {/* Dynamic Keyframe style for animated flow on highlighted path only */}
      <style>{`
        @keyframes abhedyaFlowDash {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .highlighted-trail-edge {
          stroke-dasharray: 6 4;
          animation: abhedyaFlowDash 1.4s linear infinite;
        }
      `}</style>

      {/* SVG Vector Renderer (<= 150 nodes) */}
      {!useCanvasRenderer ? (
        <svg
          className="w-full h-full block"
          style={{ backgroundColor: THEME.bg }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setHoveredNodeId(null);
            }
          }}
        >
          <defs>
            {/* Very faint dot grid (#1A1A1A) */}
            <pattern id="abhedya-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill={THEME.gridDot} />
            </pattern>
          </defs>

          {/* Background faint dot grid */}
          <rect width="100%" height="100%" fill="url(#abhedya-dot-grid)" />

          {/* Coordinate system for Zoom and Pan */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Column Tier Labels above columns */}
            {columnHeaders.map((col) => (
              <text
                key={col.tierIndex}
                x={col.x}
                y={col.y}
                textAnchor="middle"
                fill={THEME.textSecondary}
                fontSize="11"
                fontWeight="600"
                fontFamily="IBM Plex Mono, monospace"
                letterSpacing="1.5"
                className="pointer-events-none uppercase"
              >
                {col.title}
              </text>
            ))}

            {/* EDGES LAYER: Smooth cubic bezier curves flowing strictly node edge to node edge */}
            <g className="edges-layer">
              {positionedEdges.map((edge) => {
                const isHighlighted = connectedEdgeIds.has(edge.id);
                const edgeOpacity = hasActive ? (isHighlighted ? 1.0 : 0.15) : 1.0;
                const edgeStroke = isHighlighted ? THEME.gold : THEME.edgeRest;
                const edgeWidth = isHighlighted ? Math.max(2, edge.strokeWidth * 1.5) : edge.strokeWidth;

                const pathD = `M ${edge.startX} ${edge.startY} C ${edge.cp1X} ${edge.cp1Y}, ${edge.cp2X} ${edge.cp2Y}, ${edge.endX} ${edge.endY}`;

                return (
                  <g
                    key={edge.id}
                    opacity={edgeOpacity}
                    className="transition-opacity duration-150"
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(edge.target);
                    }}
                  >
                    {/* Invisible wider hit area for easy hover/clicking */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                    />

                    {/* Visible smooth bezier edge */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={edgeStroke}
                      strokeWidth={edgeWidth}
                      strokeLinecap="round"
                      className={`pointer-events-none ${isHighlighted ? 'highlighted-trail-edge' : ''}`}
                    />

                    {/* Directional arrowhead touching target node edge */}
                    {edge.isLoop ? (
                      <polygon
                        points={`${edge.endX},${edge.endY} ${edge.endX + 7},${edge.endY - 3.8} ${edge.endX + 7},${edge.endY + 3.8}`}
                        fill={edgeStroke}
                        className="pointer-events-none"
                      />
                    ) : (
                      <polygon
                        points={`${edge.endX},${edge.endY} ${edge.endX - 7},${edge.endY - 3.8} ${edge.endX - 7},${edge.endY + 3.8}`}
                        fill={edgeStroke}
                        className="pointer-events-none"
                      />
                    )}

                    {/* Merged parallel transfers badge (only shown if real transfer count > 1) */}
                    {edge.count > 1 && (
                      <g
                        transform={`translate(${edge.midX}, ${edge.midY})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x="-11"
                          y="-8"
                          width="22"
                          height="16"
                          rx="3"
                          fill={THEME.card}
                          stroke={isHighlighted ? THEME.gold : THEME.edgeRest}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          fill={isHighlighted ? THEME.gold : THEME.textSecondary}
                          fontSize="9"
                          fontFamily="IBM Plex Mono, monospace"
                          fontWeight="600"
                        >
                          {edge.count}x
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* NODES LAYER: Tier-specific SVG shapes and truncated monospaced account labels */}
            <g className="nodes-layer">
              {positionedNodes.map((node) => {
                const isHighlighted = connectedNodeIds.has(node.data.accountNumber);
                const isSelected = node.data.accountNumber === selectedAccountId;
                const isHovered = node.data.accountNumber === hoveredNodeId;
                const nodeOpacity = hasActive ? (isHighlighted ? 1.0 : 0.15) : 1.0;

                return (
                  <g
                    key={node.data.accountNumber}
                    transform={`translate(${node.x}, ${node.y})`}
                    opacity={nodeOpacity}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHoveredNodeId(node.data.accountNumber)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(node.data.accountNumber);
                    }}
                  >
                    {/* Active / Selected Highlight Halo */}
                    {(isSelected || isHovered) && (
                      <circle
                        r={node.radius + (node.tier === 'VICTIM' ? 7.5 : 5.5)}
                        fill="none"
                        stroke={THEME.gold}
                        strokeWidth="1.8"
                        strokeDasharray="3 2"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Tier 0: Victim Node Symbol (Circle with outer ring + Shield glyph) */}
                    {node.tier === 'VICTIM' && (
                      <g className="victim-symbol">
                        {/* Thin outer ring */}
                        <circle
                          r={node.radius + 4.5}
                          fill="none"
                          stroke={isHighlighted ? THEME.gold : '#FFFFFF'}
                          strokeWidth="1"
                          opacity={isHighlighted ? 1 : 0.8}
                        />
                        {/* White inner circle with 1.5px #0A0A0A border */}
                        <circle
                          r={node.radius}
                          fill="#FFFFFF"
                          stroke={THEME.bg}
                          strokeWidth="1.5"
                        />
                        {/* Simple shield glyph inside (black) */}
                        <path
                          d="M 0,-7 L 5.5,-3.5 V 0 C 5.5,4.2 0,8 0,8 C 0,8 -5.5,4.2 -5.5,0 V -3.5 Z"
                          fill={THEME.bg}
                        />
                      </g>
                    )}

                    {/* Tier 1: Layer 1 Mule Node Symbol (Hexagon + Bank glyph) */}
                    {node.tier === 'L1' && (
                      <g className="l1-symbol">
                        {/* Alert Red Hexagon with 1.5px #0A0A0A border */}
                        <polygon
                          points="0,-19 16.45,-9.5 16.45,9.5 0,19 -16.45,9.5 -16.45,-9.5"
                          fill={THEME.redAlert}
                          stroke={THEME.bg}
                          strokeWidth="1.5"
                        />
                        {/* Simple bank glyph inside (white) */}
                        <path
                          d="M -6.5,-2 L 0,-7.5 L 6.5,-2 Z"
                          fill="#FFFFFF"
                        />
                        <line x1="-4.5" y1="-0.5" x2="-4.5" y2="4.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="-1.5" y1="-0.5" x2="-1.5" y2="4.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="1.5" y1="-0.5" x2="1.5" y2="4.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="4.5" y1="-0.5" x2="4.5" y2="4.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                        <line x1="-7" y1="5.5" x2="7" y2="5.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                      </g>
                    )}

                    {/* Tier 2: Layer 2 Mule Node Symbol (Rounded Diamond + Exchange arrows glyph) */}
                    {node.tier === 'L2' && (
                      <g className="l2-symbol">
                        {/* Gold Rounded Diamond with 1.5px #0A0A0A border */}
                        <rect
                          x="-12.5"
                          y="-12.5"
                          width="25"
                          height="25"
                          rx="3.5"
                          transform="rotate(45)"
                          fill={THEME.gold}
                          stroke={THEME.bg}
                          strokeWidth="1.5"
                        />
                        {/* Arrows-exchange glyph inside (black) */}
                        <path
                          d="M -5.5,-2.5 H 3.5 M 1,-4.8 L 3.8,-2.5 L 1,-0.2"
                          fill="none"
                          stroke={THEME.bg}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M 5.5,2.5 H -3.5 M -1,0.2 L -3.8,2.5 L -1,4.8"
                          fill="none"
                          stroke={THEME.bg}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}

                    {/* Tier 3: Layer 3 Mule Node Symbol (Navy circle + Downward arrow glyph) */}
                    {node.tier === 'L3' && (
                      <g className="l3-symbol">
                        {/* Circle with navy outline and dark fill */}
                        <circle
                          r={node.radius}
                          fill={THEME.card}
                          stroke={THEME.navy}
                          strokeWidth="2.2"
                        />
                        <circle
                          r={node.radius + 1}
                          fill="none"
                          stroke={THEME.bg}
                          strokeWidth="1.5"
                        />
                        {/* Small downward arrow glyph inside */}
                        <path
                          d="M 0,-5 V 3.5 M -3.5,0 L 0,3.8 L 3.5,0"
                          fill="none"
                          stroke={THEME.textPrimary}
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}

                    {/* Account ID Monospaced Label (Truncated in middle by default, full on hover) */}
                    <text
                      x="0"
                      y={node.radius + 15}
                      textAnchor="middle"
                      fill={isHighlighted ? THEME.textPrimary : THEME.textSecondary}
                      fontSize="10.5"
                      fontFamily="IBM Plex Mono, monospace"
                      fontWeight="500"
                      className="pointer-events-none"
                    >
                      {isHovered ? node.data.accountNumber : node.truncatedLabel}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      ) : (
        /* High-performance Canvas Renderer (> 150 nodes) */
        <canvas
          ref={canvasRef}
          onClick={(e) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const clickX = (e.clientX - rect.left - pan.x) / zoom;
            const clickY = (e.clientY - rect.top - pan.y) / zoom;

            for (const node of positionedNodes) {
              const dx = clickX - node.x;
              const dy = clickY - node.y;
              if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
                onSelectNode(node.data.accountNumber);
                break;
              }
            }
          }}
          className="w-full h-full block"
        />
      )}

      {/* Forensic Tier Legend in Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex flex-col gap-1.5 border border-[#CBD5E1] bg-white/95 p-3 rounded-[6px] text-xs font-mono shadow-sm">
        <span className="text-[10px] font-bold text-[#0B2545] uppercase tracking-wider">
          Forensic Tier Symbols
        </span>
        <div className="flex flex-wrap items-center gap-3.5 text-[11px]">
          {/* Victim Symbol */}
          <div className="flex items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#0B2545" strokeWidth="1" />
              <circle cx="12" cy="12" r="7.5" fill="#FFFFFF" stroke="#0B2545" strokeWidth="1" />
              <path d="M12 7 L16 9.5 V12 C16 15 12 17 12 17 C12 17 8 15 8 12 V9.5 Z" fill="#0B2545" />
            </svg>
            <span className="text-[#0F172A] font-medium">Victim</span>
          </div>

          {/* Layer 1 Symbol */}
          <div className="flex items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <polygon points="12,3 20,7.6 20,16.4 12,21 4,16.4 4,7.6" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
              <path d="M8 10 L12 7 L16 10 Z" fill="#FFFFFF" />
              <line x1="9" y1="11" x2="9" y2="15" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="12" y1="11" x2="12" y2="15" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="15" y1="11" x2="15" y2="15" stroke="#FFFFFF" strokeWidth="1" />
              <line x1="7.5" y1="16" x2="16.5" y2="16" stroke="#FFFFFF" strokeWidth="1" />
            </svg>
            <span className="text-[#0F172A] font-medium">Layer 1 (Mule)</span>
          </div>

          {/* Layer 2 Symbol */}
          <div className="flex items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <rect x="5.5" y="5.5" width="13" height="13" rx="2" transform="rotate(45 12 12)" fill="#B45309" stroke="#FFFFFF" strokeWidth="1" />
              <path d="M9 10 H15 M13 8 L15 10 L13 12" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
              <path d="M15 14 H9 M11 12 L9 14 L11 16" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
            </svg>
            <span className="text-[#0F172A] font-medium">Layer 2 (Distributor)</span>
          </div>

          {/* Layer 3 Symbol */}
          <div className="flex items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" fill="#FFFFFF" stroke="#0B2545" strokeWidth="2.2" />
              <path d="M12 8 V14 M9 12 L12 15 L15 12" fill="none" stroke="#0B2545" strokeWidth="1.2" />
            </svg>
            <span className="text-[#0F172A] font-medium">Layer 3 (Terminal)</span>
          </div>
        </div>
        <p className="text-[10px] text-[#64748B] mt-0.5">
          Click any account node to highlight its forensic money trail
        </p>
      </div>

      {/* Control Buttons (Zoom In, Zoom Out, Reset View, Fullscreen) */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-white border border-[#CBD5E1] p-1 rounded-[6px] text-xs font-mono text-[#0F172A] shadow-sm">
        <button
          onClick={handleZoomIn}
          className="h-7 w-7 rounded-[4px] hover:bg-[#F1F5F9] hover:text-[#0B2545] flex items-center justify-center cursor-pointer transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="h-7 w-7 rounded-[4px] hover:bg-[#F1F5F9] hover:text-[#0B2545] flex items-center justify-center cursor-pointer transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={fitGraphToScreen}
          className="h-7 w-7 rounded-[4px] hover:bg-[#F1F5F9] hover:text-[#0B2545] flex items-center justify-center cursor-pointer transition-colors"
          title="Reset View"
          aria-label="Reset View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleToggleFullscreen}
          className="h-7 w-7 rounded-[4px] hover:bg-[#F1F5F9] hover:text-[#0B2545] flex items-center justify-center cursor-pointer transition-colors border-l border-[#CBD5E1] ml-1 pl-1"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Graph'}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <span className="text-[#64748B] text-[10px] pl-2 pr-1 border-l border-[#CBD5E1]">
          {positionedNodes.length} nodes
        </span>
      </div>

      {/* Hover Node Tooltip Overlay */}
      {hoveredNodeData && (
        <div className="absolute top-3 left-3 z-20 bg-white border border-[#CBD5E1] p-3 rounded-[6px] text-xs pointer-events-none max-w-xs text-[#0F172A] shadow-md">
          <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-1.5 mb-1.5">
            <span className="font-mono font-bold text-[#0B2545]">{hoveredNodeData.accountNumber}</span>
            <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold text-white bg-[#0B2545]">
              {hoveredNodeData.layer}
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px] text-[#475569]">
            <p>
              Bank: <span className="text-[#0F172A] font-semibold">{hoveredNodeData.bankName}</span>
            </p>
            <p>
              IFSC: <span className="text-[#0F172A] font-semibold">{hoveredNodeData.primaryIfsc}</span>
            </p>
            <p>
              Trace Inflow:{' '}
              <span className="text-[#16A34A] font-bold">
                {formatINR(hoveredNodeData.inflowFromTrace)}
              </span>
            </p>
            <p>
              Trace Outflow:{' '}
              <span className="text-[#DC2626] font-bold">
                {formatINR(hoveredNodeData.outflowInTrace)}
              </span>
            </p>
            {hoveredNodeData.isHolding && (
              <p className="text-[#B45309] font-bold">
                Retaining: {formatINR(hoveredNodeData.netHoldingInTrace)}
              </p>
            )}
            {hoveredNodeData.anomalies.length > 0 && (
              <p className="text-[#DC2626] border-t border-[#CBD5E1] pt-1 mt-1">
                {hoveredNodeData.anomalies.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hover Edge Tooltip Overlay */}
      {hoveredEdgeData && !hoveredNodeData && (
        <div className="absolute top-3 left-3 z-20 bg-white border border-[#CBD5E1] p-3 rounded-[6px] text-xs pointer-events-none max-w-xs text-[#0F172A] font-mono shadow-md">
          <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-1 mb-1.5">
            <span className="text-[10px] uppercase font-bold text-[#64748B]">Transaction Flow</span>
            {hoveredEdgeData.count > 1 && (
              <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold text-white bg-[#0B2545]">
                {hoveredEdgeData.count} Transfers
              </span>
            )}
          </div>
          <div className="space-y-1 text-[11px] text-[#475569]">
            <p>
              Sender: <span className="text-[#0F172A] font-semibold">{hoveredEdgeData.source}</span>
            </p>
            <p>
              Receiver: <span className="text-[#0F172A] font-semibold">{hoveredEdgeData.target}</span>
            </p>
            <p>
              Total Transfer:{' '}
              <span className="text-[#B45309] font-bold">
                {formatINR(hoveredEdgeData.amount)}
              </span>
            </p>
            {hoveredEdgeData.timestamps.length > 0 && (
              <p className="text-[10px] text-[#64748B]">
                Time: {hoveredEdgeData.timestamps[0]}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

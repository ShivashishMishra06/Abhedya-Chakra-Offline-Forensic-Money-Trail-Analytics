/**
 * Operation Abhedya-Chakra - Forensic Graph Layout Engine
 * Layered Left-to-Right layout with Dagre crossing minimization,
 * node-edge to node-edge curved bezier routing, and trail connectivity.
 */

import dagre from 'dagre';
import { TraceEdge, TraceNode } from '../../types/dataset';

export type TierType = 'VICTIM' | 'L1' | 'L2' | 'L3';

export interface PositionedNode {
  data: TraceNode;
  x: number;
  y: number;
  radius: number;
  edgeLeft: number;
  edgeRight: number;
  tier: TierType;
  tierIndex: number;
  label: string;
  truncatedLabel: string;
}

export interface MergedEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  count: number;
  timestamps: string[];
  // Cubic Bezier coordinates from node edge to node edge
  startX: number;
  startY: number;
  cp1X: number;
  cp1Y: number;
  cp2X: number;
  cp2Y: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  strokeWidth: number;
  isLoop: boolean;
}

export interface ColumnHeader {
  title: string;
  tierIndex: number;
  x: number;
  y: number;
}

export interface GraphLayoutResult {
  nodes: PositionedNode[];
  nodeMap: Map<string, PositionedNode>;
  edges: MergedEdge[];
  columnHeaders: ColumnHeader[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Determine tier classification for a node.
 * Column 0: Victim, Column 1: Layer 1, Column 2: Layer 2, Column 3: Layer 3
 */
export function getTierForNode(node: TraceNode): { tier: TierType; tierIndex: number; title: string } {
  const hop = node.hop ?? 0;
  const layer = (node.layer || '').toUpperCase();

  if (hop === 0 || layer.includes('VICTIM')) {
    return { tier: 'VICTIM', tierIndex: 0, title: 'Victim' };
  }
  if (hop === 1 || layer.includes('L1')) {
    return { tier: 'L1', tierIndex: 1, title: 'Layer 1' };
  }
  if (hop === 2 || layer.includes('L2')) {
    return { tier: 'L2', tierIndex: 2, title: 'Layer 2' };
  }
  return { tier: 'L3', tierIndex: 3, title: 'Layer 3' };
}

/**
 * Consistent node sizing per tier:
 * Victim largest (22px radius), then L1 (19px), L2 (18px), L3 (16.5px).
 */
export function getNodeRadius(tierIndex: number): number {
  switch (tierIndex) {
    case 0:
      return 22; // Victim
    case 1:
      return 19; // Layer 1 (Hexagon)
    case 2:
      return 18; // Layer 2 (Rounded Diamond half-diagonal)
    case 3:
    default:
      return 16.5; // Layer 3 (Navy Circle)
  }
}

/**
 * Horizontal offset from node center to outer boundary attachment edge.
 * Prevents lines from running across node symbols.
 */
export function getNodeEdgeOffsets(tierIndex: number): { leftOffset: number; rightOffset: number } {
  switch (tierIndex) {
    case 0:
      // Victim: outer ring is 26px
      return { leftOffset: 26, rightOffset: 26 };
    case 1:
      // Layer 1: Hexagon width is ~18px from center
      return { leftOffset: 18, rightOffset: 18 };
    case 2:
      // Layer 2: Diamond width is ~18px from center
      return { leftOffset: 18, rightOffset: 18 };
    case 3:
    default:
      // Layer 3: Circle radius is 16.5px
      return { leftOffset: 16.5, rightOffset: 16.5 };
  }
}

/**
 * Truncate long account numbers in the middle (e.g. 9110...0042)
 * for clean monospace display below nodes.
 */
export function truncateAccountId(id: string): string {
  if (!id) return '';
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/**
 * Merge parallel edges between identical source and target.
 * Sums transfer amounts and records actual transaction count without inventing data.
 */
export function mergeParallelEdges(edges: TraceEdge[]): {
  id: string;
  source: string;
  target: string;
  amount: number;
  count: number;
  timestamps: string[];
}[] {
  const edgeMap = new Map<
    string,
    { id: string; source: string; target: string; amount: number; count: number; timestamps: string[] }
  >();

  edges.forEach((edge) => {
    const key = `${edge.source}->${edge.target}`;
    const existing = edgeMap.get(key);
    const amt = typeof edge.amount === 'number' ? edge.amount : 0;
    const ts = edge.timestamp ? [edge.timestamp] : [];

    if (existing) {
      existing.amount += amt;
      existing.count += 1;
      if (edge.timestamp) existing.timestamps.push(edge.timestamp);
    } else {
      edgeMap.set(key, {
        id: edge.id || key,
        source: edge.source,
        target: edge.target,
        amount: amt,
        count: 1,
        timestamps: ts,
      });
    }
  });

  return Array.from(edgeMap.values());
}

/**
 * Calculate layered left-to-right layout with Dagre crossing minimization.
 * Generous vertical spacing, tier columns, and smooth cubic bezier edge routing.
 */
export function computeGraphLayout(
  rawNodes: TraceNode[],
  rawEdges: TraceEdge[],
  maxVisibleHop: number = 4
): GraphLayoutResult {
  // 1. Filter nodes by progressive stage hop and maintain backend node cap (max 300)
  const cappedNodes = rawNodes.slice(0, 300);
  const visibleNodes = cappedNodes.filter((n) => (n.hop ?? 0) <= maxVisibleHop);
  const validAccountSet = new Set(visibleNodes.map((n) => n.accountNumber));

  // 2. Filter edges to only include visible node endpoints
  const validEdges = rawEdges.filter(
    (e) => validAccountSet.has(e.source) && validAccountSet.has(e.target)
  );

  // 3. Merge parallel links from real data
  const mergedRawEdges = mergeParallelEdges(validEdges);

  if (visibleNodes.length === 0) {
    return {
      nodes: [],
      nodeMap: new Map(),
      edges: [],
      columnHeaders: [],
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 },
    };
  }

  // 4. Initialize Dagre graph to compute optimal vertical ordering and minimize crossings
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    align: 'UL',
    nodesep: 45,
    ranksep: 280,
    marginx: 80,
    marginy: 100,
  });
  g.setDefaultEdgeLabel(() => ({}));

  visibleNodes.forEach((n) => {
    const { tierIndex } = getTierForNode(n);
    const r = getNodeRadius(tierIndex);
    g.setNode(n.accountNumber, { width: r * 2 + 20, height: r * 2 + 40 });
  });

  mergedRawEdges.forEach((e) => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  // 5. Partition nodes into tier columns
  const tierGroups: Record<number, TraceNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  visibleNodes.forEach((n) => {
    const { tierIndex } = getTierForNode(n);
    if (!tierGroups[tierIndex]) tierGroups[tierIndex] = [];
    tierGroups[tierIndex].push(n);
  });

  // Sort nodes in each column according to Dagre's crossing-minimized Y coordinates
  Object.keys(tierGroups).forEach((tierKey) => {
    const tIdx = Number(tierKey);
    tierGroups[tIdx].sort((a, b) => {
      const ya = g.hasNode(a.accountNumber) ? (g.node(a.accountNumber)?.y ?? 0) : 0;
      const yb = g.hasNode(b.accountNumber) ? (g.node(b.accountNumber)?.y ?? 0) : 0;
      return ya - yb;
    });
  });

  // 6. Column coordinate layout
  const colSpacing = 280;
  const startX = 140;

  // Determine maximum column count for vertical distribution
  const counts = Object.values(tierGroups).map((grp) => grp.length);
  const maxNodeCountInCol = Math.max(1, ...counts);

  // Generous vertical spacing so nothing overlaps (minimum 84px between node centers)
  const rowSpacing = Math.max(84, Math.min(112, 1000 / maxNodeCountInCol));
  const totalContentHeight = Math.max(520, (maxNodeCountInCol - 1) * rowSpacing + 220);

  const positionedNodes: PositionedNode[] = [];
  const nodeMap = new Map<string, PositionedNode>();

  const columnHeaders: ColumnHeader[] = [
    { title: 'Victim', tierIndex: 0, x: startX, y: 48 },
    { title: 'Layer 1', tierIndex: 1, x: startX + colSpacing, y: 48 },
    { title: 'Layer 2', tierIndex: 2, x: startX + colSpacing * 2, y: 48 },
    { title: 'Layer 3', tierIndex: 3, x: startX + colSpacing * 3, y: 48 },
  ];

  // Assign clean aligned column X and evenly spaced Y coordinates
  Object.keys(tierGroups).forEach((tierKey) => {
    const tIdx = Number(tierKey);
    const group = tierGroups[tIdx];
    if (group.length === 0) return;

    const colX = startX + tIdx * colSpacing;
    const colTotalHeight = (group.length - 1) * rowSpacing;
    // Vertically center this column relative to total content height
    const colStartY = Math.max(120, (totalContentHeight - colTotalHeight) / 2);

    group.forEach((node, idx) => {
      const { tier } = getTierForNode(node);
      const radius = getNodeRadius(tIdx);
      const offsets = getNodeEdgeOffsets(tIdx);
      const nodeY = colStartY + idx * rowSpacing;

      const pNode: PositionedNode = {
        data: node,
        x: colX,
        y: nodeY,
        radius,
        edgeLeft: colX - offsets.leftOffset,
        edgeRight: colX + offsets.rightOffset,
        tier,
        tierIndex: tIdx,
        label: node.accountNumber,
        truncatedLabel: truncateAccountId(node.accountNumber),
      };

      positionedNodes.push(pNode);
      nodeMap.set(node.accountNumber, pNode);
    });
  });

  // Find min and max amounts across valid edges for proportional thickness (1px to 3px range)
  let minAmount = Infinity;
  let maxAmount = -Infinity;
  mergedRawEdges.forEach((e) => {
    if (e.amount > 0) {
      if (e.amount < minAmount) minAmount = e.amount;
      if (e.amount > maxAmount) maxAmount = e.amount;
    }
  });

  // 7. Route smooth cubic bezier edges flowing strictly from node edge to node edge
  const positionedEdges: MergedEdge[] = [];

  mergedRawEdges.forEach((edge) => {
    const srcNode = nodeMap.get(edge.source);
    const dstNode = nodeMap.get(edge.target);
    if (!srcNode || !dstNode) return;

    const isSameColumn = srcNode.tierIndex === dstNode.tierIndex;
    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;
    let cp1X: number;
    let cp1Y: number;
    let cp2X: number;
    let cp2Y: number;
    let midX: number;
    let midY: number;

    if (isSameColumn) {
      // Loop connection within the same column: arcs outward to the right
      startX = srcNode.edgeRight;
      startY = srcNode.y;
      endX = dstNode.edgeRight;
      endY = dstNode.y;

      const loopWidth = 45;
      cp1X = startX + loopWidth;
      cp1Y = startY;
      cp2X = endX + loopWidth;
      cp2Y = endY;

      midX = startX + loopWidth * 0.75;
      midY = (startY + endY) / 2;
    } else {
      // Standard Left-to-Right flow: exiting sender's right edge -> entering receiver's left edge
      startX = srcNode.edgeRight;
      startY = srcNode.y;
      endX = dstNode.edgeLeft;
      endY = dstNode.y;

      const dx = Math.max(30, Math.abs(endX - startX));
      // Smooth S-curve control points with horizontal tangents
      cp1X = startX + dx * 0.45;
      cp1Y = startY;
      cp2X = endX - dx * 0.45;
      cp2Y = endY;

      // Exact midpoint along cubic bezier curve: B(0.5)
      midX = 0.125 * startX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * endX;
      midY = 0.125 * startY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * endY;
    }

    // Lightly scale thickness by real amount (strictly within 1.0px to 3.0px range)
    let strokeWidth = 1.25;
    if (maxAmount > minAmount && edge.amount > 0) {
      const norm = (edge.amount - minAmount) / (maxAmount - minAmount);
      strokeWidth = 1.0 + norm * 2.0;
    }

    positionedEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      amount: edge.amount,
      count: edge.count,
      timestamps: edge.timestamps,
      startX,
      startY,
      cp1X,
      cp1Y,
      cp2X,
      cp2Y,
      endX,
      endY,
      midX,
      midY,
      strokeWidth,
      isLoop: isSameColumn,
    });
  });

  // 8. Compute graph bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positionedNodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.radius - 50);
    maxX = Math.max(maxX, n.x + n.radius + 50);
    minY = Math.min(minY, n.y - n.radius - 60);
    maxY = Math.max(maxY, n.y + n.radius + 60);
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 800;
    minY = 0;
    maxY = 600;
  }

  // Include column headers in bounds
  minY = Math.min(minY, 20);

  return {
    nodes: positionedNodes,
    nodeMap,
    edges: positionedEdges,
    columnHeaders,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(800, maxX - minX),
      height: Math.max(520, maxY - minY),
    },
  };
}

/**
 * Traverse the graph to find all upstream and downstream connected nodes and edges
 * for the currently active (hovered or clicked) account.
 */
export function findConnectedTrail(
  activeAccountId: string | null,
  edges: MergedEdge[]
): {
  connectedNodeIds: Set<string>;
  connectedEdgeIds: Set<string>;
} {
  const connectedNodeIds = new Set<string>();
  const connectedEdgeIds = new Set<string>();

  if (!activeAccountId) {
    return { connectedNodeIds, connectedEdgeIds };
  }

  connectedNodeIds.add(activeAccountId);

  // Build adjacency lookup
  const outgoing = new Map<string, MergedEdge[]>();
  const incoming = new Map<string, MergedEdge[]>();

  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);

    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge);
  });

  // 1. Forward traversal (Downstream dispersion)
  const forwardQueue: string[] = [activeAccountId];
  const visitedForward = new Set<string>([activeAccountId]);

  while (forwardQueue.length > 0) {
    const current = forwardQueue.shift()!;
    const nextEdges = outgoing.get(current) || [];
    for (const e of nextEdges) {
      connectedEdgeIds.add(e.id);
      if (!visitedForward.has(e.target)) {
        visitedForward.add(e.target);
        connectedNodeIds.add(e.target);
        forwardQueue.push(e.target);
      }
    }
  }

  // 2. Backward traversal (Upstream source trail)
  const backwardQueue: string[] = [activeAccountId];
  const visitedBackward = new Set<string>([activeAccountId]);

  while (backwardQueue.length > 0) {
    const current = backwardQueue.shift()!;
    const prevEdges = incoming.get(current) || [];
    for (const e of prevEdges) {
      connectedEdgeIds.add(e.id);
      if (!visitedBackward.has(e.source)) {
        visitedBackward.add(e.source);
        connectedNodeIds.add(e.source);
        backwardQueue.push(e.source);
      }
    }
  }

  return { connectedNodeIds, connectedEdgeIds };
}

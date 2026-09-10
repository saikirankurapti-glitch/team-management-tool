import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem } from '../../types';

interface WorkBreakdownStructureViewProps {
  projectId: string;
}

interface WBSNode {
  item: WorkItem;
  children: WBSNode[];
  totalEstimated: number;
  totalActual: number;
  totalRemaining: number;
}

export const WorkBreakdownStructureView: React.FC<WorkBreakdownStructureViewProps> = ({ projectId }) => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (projectId) {
      setIsLoading(true);
      fetchApi<WorkItem[]>(`/work-items?projectId=${projectId}`)
        .then((data) => {
          setWorkItems(data);
          // Expand all by default
          const exp: Record<string, boolean> = {};
          data.forEach((d) => (exp[d.id] = true));
          setExpandedNodes(exp);
        })
        .catch((err) => console.error('Failed to load WBS items:', err))
        .finally(() => setIsLoading(false));
    }
  }, [projectId]);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build tree from workItems
  const buildTree = (): WBSNode[] => {
    const itemMap = new Map<string, WBSNode>();
    workItems.forEach((item) => {
      const est = item.estimatedHours || 0;
      const act = item.actualHours || 0;
      const rem = Math.max(0, est - act);

      itemMap.set(item.id, {
        item,
        children: [],
        totalEstimated: est,
        totalActual: act,
        totalRemaining: rem,
      });
    });

    const rootNodes: WBSNode[] = [];

    workItems.forEach((item) => {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Post-order traversal to roll up totals to parent
    const rollup = (node: WBSNode): void => {
      for (const child of node.children) {
        rollup(child);
        node.totalEstimated += child.totalEstimated;
        node.totalActual += child.totalActual;
        node.totalRemaining += child.totalRemaining;
      }
    };

    rootNodes.forEach(rollup);
    return rootNodes;
  };

  const renderNode = (node: WBSNode, depth: number = 0) => {
    const isExpanded = expandedNodes[node.item.id] ?? true;
    const hasChildren = node.children.length > 0;
    const isDone = node.item.status === 'DONE';
    const progress = node.totalEstimated > 0 ? Math.min(100, Math.round((node.totalActual / node.totalEstimated) * 100)) : 0;

    return (
      <React.Fragment key={node.item.id}>
        <div
          className={`flex items-center justify-between p-2.5 hover:bg-slate-900/60 border-b border-slate-800 transition-colors text-xs ${
            depth === 0 ? 'bg-slate-950/70 font-semibold' : ''
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* Left Item Details */}
          <div className="flex items-center space-x-2 min-w-0 pr-4">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.item.id)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-5.5" />
            )}

            <span className="font-mono text-[10px] font-bold text-blue-400 shrink-0">
              {node.item.humanId}
            </span>

            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-400 shrink-0">
              {node.item.type}
            </span>

            <span className={`truncate text-slate-200 ${depth === 0 ? 'font-bold' : 'font-medium'}`}>
              {node.item.title}
            </span>
          </div>

          {/* Right Metrics Rollup */}
          <div className="flex items-center space-x-6 text-[11px] font-mono shrink-0">
            <div className="w-20 text-right">
              <span className="text-slate-400 text-[10px] block">Est</span>
              <span className="font-bold text-slate-200">{node.totalEstimated}h</span>
            </div>

            <div className="w-20 text-right">
              <span className="text-slate-400 text-[10px] block">Actual</span>
              <span className="font-bold text-emerald-400">{node.totalActual}h</span>
            </div>

            <div className="w-20 text-right">
              <span className="text-slate-400 text-[10px] block">Rem</span>
              <span className="font-bold text-amber-400">{node.totalRemaining}h</span>
            </div>

            <div className="w-24">
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Burn</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    progress > 100 ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>

            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                isDone
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {node.item.status}
            </span>
          </div>
        </div>

        {/* Render child nodes recursively */}
        {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  const tree = buildTree();

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Work Breakdown Structure (WBS)</h2>
            <p className="text-[11px] text-slate-400">
              Aggregated effort rollup across Epics, Features, User Stories, and Tasks
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>Hierarchy items: <strong className="text-slate-200">{workItems.length}</strong></span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading WBS hierarchy...</div>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">No hierarchy items available.</div>
        ) : (
          <div className="divide-y divide-slate-800">{tree.map((root) => renderNode(root, 0))}</div>
        )}
      </div>
    </div>
  );
};

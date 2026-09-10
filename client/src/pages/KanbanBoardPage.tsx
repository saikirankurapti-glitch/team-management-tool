import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Search,
  Plus,
  AlertTriangle,
  Kanban,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { WorkItem, WorkItemStatus, Project, User } from '../types';
import { WorkItemSideDrawer } from '../components/common/WorkItemSideDrawer';
import { CreateWorkItemModal } from '../components/common/CreateWorkItemModal';
import { useSocket } from '../context/SocketContext';

const COLUMNS: { id: WorkItemStatus; label: string; wipLimit?: number }[] = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'TO_DO', label: 'To Do', wipLimit: 10 },
  { id: 'IN_PROGRESS', label: 'In Progress', wipLimit: 5 },
  { id: 'CODE_REVIEW', label: 'Code Review', wipLimit: 4 },
  { id: 'TESTING', label: 'Testing', wipLimit: 4 },
  { id: 'BLOCKED', label: 'Blocked' },
  { id: 'DONE', label: 'Done' },
];

export const KanbanBoardPage: React.FC = () => {
  const { socket } = useSocket();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = () => {
    Promise.all([
      fetchApi<WorkItem[]>('/work-items'),
      fetchApi<Project[]>('/projects'),
      fetchApi<User[]>('/organization/members'),
    ])
      .then(([itemData, projData, memberData]) => {
        setItems(itemData);
        setProjects(projData);
        setMembers(memberData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('board_card_moved', (data: { workItemId: string; newStatus: WorkItemStatus }) => {
        setItems((prev) =>
          prev.map((i) => (i.id === data.workItemId ? { ...i, status: data.newStatus } : i))
        );
      });
    }
    return () => {
      if (socket) socket.off('board_card_moved');
    };
  }, [socket]);

  const filteredItems = items.filter((item) => {
    if (selectedProjectId && item.projectId !== selectedProjectId) return false;
    if (selectedAssigneeId && item.assigneeId !== selectedAssigneeId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.humanId.toLowerCase().includes(q);
    }
    return true;
  });

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as WorkItemStatus;
    const oldStatus = source.droppableId as WorkItemStatus;

    setItems((prev) =>
      prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i))
    );

    if (socket) {
      socket.emit('card_moved', { workItemId: draggableId, oldStatus, newStatus });
    }

    try {
      await fetchApi(`/work-items/${draggableId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update Kanban status', err);
      loadData();
    }
  };

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-ink-muted">Loading Kanban board...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-4 text-xs bg-canvas select-none">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-borderWarm pb-3 gap-3 shrink-0">
        <div className="space-y-1">
          <div className="editorial-eyebrow text-[9px]">
            BOARD
          </div>
          <h1 className="text-xl font-black text-ink tracking-tight">
            Delivery Flow
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="input-warm h-9 text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            className="input-warm h-9 text-xs"
          >
            <option value="">All Assignees</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter board..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-warm h-9 pl-8 w-44 text-xs"
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-pill-primary h-9 px-4 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Board Column Container */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex space-x-3.5 pb-2">
          {COLUMNS.map((col) => {
            const columnItems = filteredItems.filter((i) => i.status === col.id);
            const isWipExceeded = col.wipLimit ? columnItems.length > col.wipLimit : false;
            const totalPoints = columnItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

            return (
              <div
                key={col.id}
                className={`w-72 shrink-0 bg-canvas-secondary border rounded-card flex flex-col max-h-full ${
                  isWipExceeded ? 'border-status-error' : 'border-borderWarm'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-borderWarm flex items-center justify-between bg-canvas/40">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-ink">{col.label}</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-borderWarm text-ink-muted">
                      {columnItems.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-olive-dark font-bold">{totalPoints} pts</span>
                </div>

                {/* Column Drag Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[120px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-lime/10' : ''
                      }`}
                    >
                      {columnItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(providedDrag, snapshotDrag) => (
                            <div
                              ref={providedDrag.innerRef}
                              {...providedDrag.draggableProps}
                              {...providedDrag.dragHandleProps}
                              onClick={() => setSelectedItem(item)}
                              className={`card-cream p-3 cursor-pointer select-none space-y-2.5 ${
                                snapshotDrag.isDragging ? 'shadow-lg border-olive-dark' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-olive-dark">
                                  {item.humanId}
                                </span>
                                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-canvas-secondary text-ink-muted font-bold">
                                  {item.type}
                                </span>
                              </div>

                              <h3 className="text-xs font-semibold text-ink leading-snug line-clamp-2">
                                {item.title}
                              </h3>

                              {item.status === 'BLOCKED' && item.blockedReason && (
                                <div className="p-1.5 bg-status-error/10 border border-status-error/20 rounded-md text-[10px] text-status-error flex items-center space-x-1 font-medium">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{item.blockedReason}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1.5 border-t border-borderWarm/60 text-[10px] text-ink-muted font-mono">
                                <span className="font-bold text-olive-dark bg-lime/30 px-1.5 py-0.5 rounded-full">
                                  {item.storyPoints || 0} pts
                                </span>

                                {item.assignee ? (
                                  <div className="flex items-center space-x-1">
                                    <img
                                      src={item.assignee.avatarUrl || ''}
                                      alt={item.assignee.fullName}
                                      title={item.assignee.fullName}
                                      className="w-4 h-4 rounded-full object-cover ring-1 ring-borderWarm"
                                    />
                                    <span className="text-[10px] font-sans truncate max-w-[80px] text-ink-secondary">{item.assignee.fullName.split(' ')[0]}</span>
                                  </div>
                                ) : (
                                  <span className="text-ink-muted">Unassigned</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Side Drawer on Card Click */}
      {selectedItem && (
        <WorkItemSideDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onUpdated={loadData} />
      )}
      {isCreateOpen && (
        <CreateWorkItemModal onClose={() => setIsCreateOpen(false)} onCreated={loadData} />
      )}
    </div>
  );
};

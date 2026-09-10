import { fetchApi } from './api';

export interface QueuedMutation {
  idempotencyKey: string;
  action: 'UPDATE_WORK_ITEM_STATUS' | 'ADD_COMMENT';
  entityId: string;
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = 'startup_hub_offline_mutations';

export const getQueuedMutations = (): QueuedMutation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const queueOfflineMutation = (action: QueuedMutation['action'], entityId: string, payload: any) => {
  const mutations = getQueuedMutations();
  const newMut: QueuedMutation = {
    idempotencyKey: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    action,
    entityId,
    payload,
    timestamp: Date.now(),
  };

  mutations.push(newMut);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mutations));
  return newMut;
};

export const clearQueuedMutations = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const syncOfflineMutations = async () => {
  const mutations = getQueuedMutations();
  if (mutations.length === 0) return { processed: 0, applied: 0, conflicts: 0 };

  try {
    const res = await fetchApi<any>('/v1/offline/sync', {
      method: 'POST',
      body: JSON.stringify({ mutations }),
    });

    clearQueuedMutations();
    return res.summary;
  } catch (err) {
    console.error('Failed to sync offline mutations:', err);
    throw err;
  }
};

// Listen for network reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineMutations().catch((err) => console.error('Auto sync on reconnect failed:', err));
  });
}

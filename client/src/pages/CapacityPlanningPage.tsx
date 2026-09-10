import React from 'react';
import { CapacityPlanningView } from '../components/planning/CapacityPlanningView';

export const CapacityPlanningPage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <CapacityPlanningView />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Lock,
  Save,
  Check,
  TrendingUp,
  Percent,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectPricing } from '../../types';
import { canAccessFinancials } from '../../utils/rbac';

interface ProjectPricingViewProps {
  projectId: string;
}

export const ProjectPricingView: React.FC<ProjectPricingViewProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [pricing, setPricing] = useState<ProjectPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);

  // Form states
  const [pricingModel, setPricingModel] = useState<'FIXED_PRICE' | 'TIME_AND_MATERIAL' | 'MILESTONE_BASED' | 'RETAINER'>('FIXED_PRICE');
  const [contingencyPercentage, setContingencyPercentage] = useState(10);
  const [markupPercentage, setMarkupPercentage] = useState(25);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [taxPercentage, setTaxPercentage] = useState(18);
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');

  const canSeeFinancials = canAccessFinancials(user?.role);

  const loadPricing = () => {
    if (!canSeeFinancials) {
      setIsForbidden(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchApi<ProjectPricing>(`/projects/${projectId}/pricing`)
      .then((data) => {
        setPricing(data);
        setPricingModel(data.pricingModel as any);
        setContingencyPercentage(data.contingencyPercentage);
        setMarkupPercentage(data.markupPercentage);
        setDiscountPercentage(data.discountPercentage);
        setTaxPercentage(data.taxPercentage);
        setCurrency(data.currency || 'INR');
        setNotes(data.notes || '');
      })
      .catch((err) => {
        if (err.status === 403) setIsForbidden(true);
        console.error('Failed to load pricing:', err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadPricing();
  }, [projectId]);

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetchApi<{ pricing: ProjectPricing }>(`/projects/${projectId}/pricing`, {
        method: 'PUT',
        body: JSON.stringify({
          pricingModel,
          contingencyPercentage: Number(contingencyPercentage),
          markupPercentage: Number(markupPercentage),
          discountPercentage: Number(discountPercentage),
          taxPercentage: Number(taxPercentage),
          currency,
          notes,
        }),
      });

      setPricing(res.pricing);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to update pricing');
    } finally {
      setIsSaving(false);
    }
  };

  if (isForbidden) {
    return (
      <div className="p-8 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-3">
        <Lock className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-100">Restricted Commercial Access</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Internal cost rates, profit margins, and project pricing are restricted to Project Managers and Organization Administrators.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-slate-400">Loading commercial pricing models...</div>;
  }

  const internalCost = pricing?.estimatedInternalCost || 0;
  const contingencyAmt = Math.round(internalCost * (contingencyPercentage / 100));
  const costWithContingency = internalCost + contingencyAmt;
  const markupAmt = Math.round(costWithContingency * (markupPercentage / 100));
  const grossPrice = costWithContingency + markupAmt;
  const discountAmt = Math.round(grossPrice * (discountPercentage / 100));
  const subtotal = grossPrice - discountAmt;
  const taxAmt = Math.round(subtotal * (taxPercentage / 100));
  const finalPrice = subtotal + taxAmt;
  const grossMargin = subtotal - costWithContingency;
  const grossMarginPercent = subtotal > 0 ? Math.round((grossMargin / subtotal) * 1000) / 10 : 0;

  return (
    <div className="space-y-4 text-xs">
      {/* Top Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Estimated Internal Cost
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            ₹{internalCost.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Raw resource effort cost</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Proposed Client Price
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            ₹{finalPrice.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Subtotal + Tax ({taxPercentage}%)</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Gross Profit Margin
          </div>
          <div className="text-xl font-bold text-blue-400 font-mono">
            ₹{grossMargin.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Subtotal - Cost w/ Contingency</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Expected Margin %
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono flex items-center space-x-2">
            <span>{grossMarginPercent}%</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                grossMarginPercent >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {grossMarginPercent >= 20 ? 'HEALTHY' : 'MODERATE'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Target commercial profitability</div>
        </div>
      </div>

      {/* Main Pricing Form and Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Configuration Form */}
        <form onSubmit={handleSavePricing} className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-200">Commercial Pricing Model</h3>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center space-x-1.5 transition-colors"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Pricing'}</span>
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Pricing Model
            </label>
            <select
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="FIXED_PRICE">Fixed Price (Milestone deliveries against fixed quote)</option>
              <option value="TIME_AND_MATERIAL">Time & Material (Billed per actual hours worked)</option>
              <option value="MILESTONE_BASED">Milestone Based (Tranche payments upon sign-off)</option>
              <option value="RETAINER">Monthly Retainer (Fixed dedicated capacity)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Contingency Buffer (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={contingencyPercentage}
                onChange={(e) => setContingencyPercentage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Markup / Profit Margin (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={markupPercentage}
                onChange={(e) => setMarkupPercentage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Commercial Discount (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Tax / GST (%)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Pricing Assumptions & Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Rate card valid for Q3 2026. Includes 2 sprint warranty buffer."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs"
            />
          </div>
        </form>

        {/* Right: Commercial Ledger Breakdown */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-3 font-mono text-xs">
          <h3 className="font-bold text-slate-200 font-sans border-b border-slate-800 pb-2">
            Commercial Ledger Breakdown
          </h3>

          <div className="space-y-2 text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Internal Base Cost:</span>
              <span className="font-bold">₹{internalCost.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
              <span>+ Contingency ({contingencyPercentage}%):</span>
              <span>₹{contingencyAmt.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900 font-bold text-slate-200">
              <span>Cost with Contingency:</span>
              <span>₹{costWithContingency.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
              <span>+ Markup / Margin ({markupPercentage}%):</span>
              <span>₹{markupAmt.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900 font-bold text-slate-200">
              <span>Gross Price:</span>
              <span>₹{grossPrice.toLocaleString()}</span>
            </div>

            {discountPercentage > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-900 text-rose-400">
                <span>- Commercial Discount ({discountPercentage}%):</span>
                <span>-₹{discountAmt.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-800 text-blue-400 font-bold">
              <span>Subtotal:</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
              <span>+ Tax / GST ({taxPercentage}%):</span>
              <span>₹{taxAmt.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-slate-700 text-emerald-400 font-bold text-sm">
              <span>Final Proposal Price:</span>
              <span>₹{finalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

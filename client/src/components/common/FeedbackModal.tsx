import React, { useState } from 'react';
import { MessageSquare, X, Send, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface Props {
  onClose: () => void;
}

export const FeedbackModal: React.FC<Props> = ({ onClose }) => {
  const [category, setCategory] = useState<'BUG' | 'UX_ISSUE' | 'FEATURE_REQUEST' | 'GENERAL'>('UX_ISSUE');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await fetchApi('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          category,
          pageUrl: window.location.pathname,
          description,
        }),
      });

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-surface border border-borderWarm w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-xs space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-borderWarm pb-4">
          <div className="flex items-center space-x-2.5 font-bold text-ink text-sm">
            <div className="p-2 bg-lime/30 border border-borderWarm rounded-xl text-olive">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="editorial-eyebrow text-[9px] mb-0.5">[ FEEDBACK ]</div>
              <span className="font-black text-ink text-base">Submit Product Feedback</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink/60 hover:text-ink rounded-full hover:bg-canvas">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h4 className="font-black text-ink text-base">Thank You for Your Feedback!</h4>
            <p className="text-ink/70 text-xs">Your response has been recorded to improve the platform.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="editorial-eyebrow text-[9px] block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="input-warm w-full text-xs font-semibold py-2 px-3 rounded-xl"
              >
                <option value="UX_ISSUE">UX / Usability Issue</option>
                <option value="BUG">Bug Report</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="GENERAL">General Feedback</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="editorial-eyebrow text-[9px] block mb-1">Feedback Description</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, what felt confusing, or your suggestion..."
                className="input-warm w-full text-xs font-normal p-3 rounded-xl leading-relaxed"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-borderWarm">
              <button
                type="button"
                onClick={onClose}
                className="btn-pill-secondary py-2 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-primary flex items-center space-x-1.5 py-2 px-4 text-xs font-bold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

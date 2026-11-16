import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const REASONS = ['Spam or advertising', 'Harassment or hate', 'Inappropriate content', 'Scam or fraud', 'Other'];

export default function ReportDialog({
  targetType, targetId, onClose,
}: { targetType: 'post' | 'comment' | 'listing' | 'user' | 'car'; targetId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await api.post('/reports', { targetType, targetId, reason: details.trim() ? `${reason}: ${details.trim()}` : reason });
      toast('Thanks — a moderator will review it.', { title: 'Report sent', variant: 'success' });
      onClose();
    } catch (e) {
      toast((e as Error).message);
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Flag size={18} className="text-m-red" /> Report {targetType}</DialogTitle>
          <DialogDescription>Reports are private and go to the club moderators.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm has-[:checked]:border-bmw-blue has-[:checked]:bg-bmw-blue-light">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-bmw-blue" />
              {r}
            </label>
          ))}
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else we should know? (optional)" rows={3}
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-bmw-blue" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={sending} className="flex items-center gap-2 rounded-xl bg-m-red px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {sending && <Loader2 size={14} className="animate-spin" />} Send report
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

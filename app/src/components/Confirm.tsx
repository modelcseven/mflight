import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

/** Confirmation modal; awaits async onConfirm and closes when it resolves. */
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', tone = 'danger', onConfirm, children }: Props) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* caller reports the error; keep the dialog open */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {tone === 'danger' && <AlertTriangle size={18} className="text-danger" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy}
            className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60',
              tone === 'danger' ? 'bg-danger hover:bg-danger/90' : 'bg-bmw-blue hover:bg-bmw-blue-dark')}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

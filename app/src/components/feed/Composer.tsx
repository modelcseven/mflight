import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Car, ImagePlus, Loader2, SendHorizonal, X } from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export type ComposerMode = 'post' | 'car' | 'photo' | 'event';

const ACTIONS: { mode: Exclude<ComposerMode, 'post'>; label: string; icon: typeof Car }[] = [
  { mode: 'car', label: 'Add Car', icon: Car },
  { mode: 'photo', label: 'Photo', icon: ImagePlus },
  { mode: 'event', label: 'Event', icon: CalendarDays },
];

const MODE_PLACEHOLDER: Record<ComposerMode, string> = {
  post: 'Share with the club…',
  car: 'Tell the club about your new car…',
  photo: 'Say something about this photo…',
  event: 'Which event are you planning?',
};

/**
 * Post composer: avatar + input + quick-action buttons (Add Car / Photo / Event).
 * Submitting calls `onPost` which prepends to the feed.
 */
export default function Composer({ onPost, autoFocus = false }: { onPost: (text: string, mode: ComposerMode, image?: string) => Promise<void>; autoFocus?: boolean }) {
  const { member } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ComposerMode>('post');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Opened from the tab bar's + button: bring the composer into view and focus it.
  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      inputRef.current?.focus();
    }, 250);
    return () => window.clearTimeout(t);
  }, [autoFocus]);

  const onFile = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      setImage(await uploadImage(f));
      setMode('photo');
    } catch (e) {
      toast((e as Error).message, { title: 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pickMode = (m: Exclude<ComposerMode, 'post'>) => {
    if (m === 'car') {
      navigate('/garage?add=1');
      return;
    }
    if (m === 'photo') {
      fileRef.current?.click();
      return;
    }
    setMode((cur) => (cur === m ? 'post' : m));
    inputRef.current?.focus();
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || posting) return;
    setPosting(true);
    try {
      await onPost(value, mode, image ?? undefined);
      setText('');
      setMode('post');
      setImage(null);
    } catch (e) {
      toast((e as Error).message, { title: 'Could not post' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6"
      aria-label="Create a post"
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-950 font-display text-sm font-bold text-white ring-2 ring-gold/40">
          {member?.initials ?? '?'}
        </span>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={MODE_PLACEHOLDER[mode]}
            className="h-11 w-full rounded-xl border border-border bg-bg-app px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-bmw-blue focus:bg-white focus:ring-2 focus:ring-bmw-blue/15"
          />
          {mode !== 'post' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bmw-blue-light px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-bmw-blue"
            >
              {mode === 'photo' ? <ImagePlus size={12} /> : <CalendarDays size={12} />}
              {mode === 'photo' ? 'Photo post' : 'Event post'}
            </motion.span>
          )}
          {(image || uploading) && (
            <div className="relative mt-3 inline-block overflow-hidden rounded-xl border border-border">
              {uploading ? (
                <div className="flex h-28 w-44 items-center justify-center bg-bg-app"><Loader2 className="animate-spin text-ink-faint" /></div>
              ) : (
                <img src={image!} alt="Attached" className="h-28 w-44 object-cover" />
              )}
              {image && (
                <button type="button" onClick={() => { setImage(null); setMode('post'); }} aria-label="Remove photo"
                  className="absolute right-1.5 top-1.5 rounded-full bg-ink-dark/70 p-1 text-white hover:bg-ink-dark">
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {ACTIONS.map(({ mode: m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            onClick={() => pickMode(m)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150',
              mode === m
                ? 'bg-bmw-blue-light text-bmw-blue ring-1 ring-bmw-blue/30'
                : 'text-ink-muted hover:bg-bg-app hover:text-ink',
            )}
          >
            <Icon size={16} className={mode === m ? 'text-bmw-blue' : 'text-ink-faint'} />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || posting || uploading}
          className="ml-auto flex items-center gap-2 rounded-xl bg-bmw-blue px-5 py-2.5 font-display text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-[#165CAD] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizonal size={15} />
          Post
        </button>
      </div>
    </motion.section>
  );
}

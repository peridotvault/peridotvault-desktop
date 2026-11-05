import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { chat } from '@shared/api/ai.api';
import { EyeGlassesIcon } from '@shared/assets/icons/MainIcons';
import { getKvItem, setKvItem } from '@core/storage/kv-key';
import { chatKey } from '@shared/database/kv-keys';

/* ---------- sanitize utils (sama seperti web) ---------- */
function stripXmlBlocks(s: string) {
  return s.replace(/<think[\s\S]*?<\/think>/gi, '').replace(/<analysis[\s\S]*?<\/analysis>/gi, '');
}
function stripFencedBlocks(s: string) {
  return s.replace(/```[\s\S]*?```/g, '');
}
function unquote(s: string) {
  return s.replace(/^[\s"'`]+|[\s"'`]+$/g, '').trim();
}
function collapseWS(s: string) {
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function limitSentences(s: string, n: number) {
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, n).join(' ');
}
function extractText(raw: any) {
  if (typeof raw === 'string') return raw;
  return (
    (raw && (raw.response || raw.text || raw.message)) ||
    (raw && raw.data && (raw.data.response || raw.data.text)) ||
    ''
  );
}
function sanitizeReply(raw: any, opts?: { maxSentences?: number }) {
  const maxSentences = opts?.maxSentences ?? 3;
  let t = extractText(raw);
  t = stripXmlBlocks(t);
  t = stripFencedBlocks(t);
  t = unquote(t);
  t = collapseWS(t);
  if (maxSentences > 0) t = limitSentences(t, maxSentences);
  return t || '…';
}

/* ---------- autosize textarea ---------- */
function useAutosizeTextArea(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = el.scrollHeight + 'px';
  }, [ref, value]);
}

/* ---------- types ---------- */
type Message = { id: string; role: 'user' | 'assistant'; text: string };

type Props = {
  open: boolean;
  onClose: () => void;
  leftClassName?: string; // ex: "left-20"
  title?: string;
  storageKey?: string;
};

export default function AIChatbot({
  open,
  onClose,
  leftClassName = 'left-24',
  title = 'Peri Chat',
  storageKey = 'peri_chat_msgs',
}: Props) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useAutosizeTextArea(inputRef, input);
  const isEmpty = msgs.length === 0;

  // hydrate messages once
  useEffect(() => {
    let alive = true;
    setHydrated(false);
    (async () => {
      try {
        const saved = await getKvItem<Message[]>(chatKey(storageKey));
        if (alive) {
          setMsgs(saved ?? []);
        }
      } catch (error) {
        console.error('Failed to load chat history', error);
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [storageKey]);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    setKvItem(chatKey(storageKey), msgs).catch((error) =>
      console.error('Failed to persist chat history', error),
    );
  }, [msgs, storageKey, hydrated]);

  // autoscroll
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, loading]);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // lock scroll behind modal (opsional)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function send(text: string) {
    const trimmed = (text || '').trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    setMsgs((m) => [...m, userMsg]);
    setLoading(true);
    setInput('');

    try {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const raw = await chat(trimmed);
      const reply = sanitizeReply(raw, { maxSentences: 3 });

      const aiMsg: Message = { id: crypto.randomUUID(), role: 'assistant', text: reply };
      setMsgs((m) => [...m, aiMsg]);
    } catch (e) {
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Sorry, something went wrong. Please contact support.',
      };
      setMsgs((m) => [...m, aiMsg]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loading) send(input);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      send(input);
    }
  }

  const quick = [
    'What is PeridotVault?',
    'Tell me all PeridotVault roadmap!',
    'How to start as a developer?',
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel (slide from left) */}
          <motion.div
            className={[
              'fixed bottom-0 top-12 w-md bg-background border-x border-foreground/10 shadow-2xl',
              'flex flex-col z-40',
              leftClassName,
            ].join(' ')}
            role="dialog"
            aria-label={title}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 42, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-foreground/10">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold opacity-90">{title}</span>
                <button
                  onClick={onClose}
                  className="text-xs px-2 py-1 rounded-md border border-foreground/10 hover:bg-foreground/5"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
              {isEmpty ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-5 text-center">
                  <EyeGlassesIcon className="w-16 h-16 opacity-80" />
                  <div className="flex flex-col items-center gap-1">
                    <h2 className="text-2xl font-bold">How can I help you today?</h2>
                    <span className="text-text_disabled text-sm">Give Peri a task to work</span>
                  </div>

                  <ol className="w-full border border-foreground/10 rounded-lg divide-y divide-foreground/10 overflow-hidden text-left max-w-[368px]">
                    {quick.map((q, idx) => (
                      <li key={idx}>
                        <button
                          className="py-3 px-3 w-full text-start hover:bg-foreground/5 transition text-sm"
                          onClick={() => send(q)}
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <>
                  {msgs.map((m) => (
                    <div
                      key={m.id}
                      className={`w-full flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[85%]">
                        {m.role === 'assistant' && (
                          <div className="text-[10px] tracking-wider text-text_disabled/70 mb-1">
                            Peri
                          </div>
                        )}
                        <div
                          className={[
                            'rounded-xl px-3 py-2 leading-relaxed border border-foreground/10 whitespace-pre-wrap wrap-break-word',
                            m.role === 'user'
                              ? 'bg-foreground/10 text-foreground'
                              : 'bg-background/80 text-foreground/90',
                          ].join(' ')}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="w-full flex justify-start">
                      <div className="max-w-[85%]">
                        <div className="text-[10px] tracking-wider text-text_disabled/70 mb-1">
                          Peri
                        </div>
                        <div className="rounded-xl border border-foreground/10 px-3 py-2 bg-background/80 inline-flex items-center gap-1">
                          <span className="h-2 w-2 bg-background_disabled rounded-full inline-block animate-bounce" />
                          <span
                            className="h-2 w-2 bg-background_disabled rounded-full inline-block animate-bounce"
                            style={{ animationDelay: '120ms' }}
                          />
                          <span
                            className="h-2 w-2 bg-background_disabled rounded-full inline-block animate-bounce"
                            style={{ animationDelay: '240ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input (sticky bottom) */}
            <form
              onSubmit={onSubmit}
              className="sticky bottom-0 bg-background border-t border-foreground/10"
            >
              <div className="p-2">
                <div className="bg-background border border-foreground/10 rounded-lg p-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={loading ? 'Thinking...' : 'Give Peri a task...'}
                    rows={1}
                    className="w-full resize-none bg-transparent outline-none p-2 disabled:opacity-50 max-h-[40vh]"
                    disabled={loading}
                  />
                  <div className="flex justify-end px-2 pb-1 text-[10px] text-text_disabled">
                    <span>Enter to send • Shift+Enter for newline</span>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

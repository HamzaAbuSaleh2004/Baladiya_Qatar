import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { sendMessage } from '../api';

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AIAgentChat() {
  const navigate = useNavigate();
  const { token, report, setReport, addTicket } = useApp();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const composerRef = useRef(null);
  const [conversationStart] = useState(() => timeLabel());

  useEffect(() => {
    if (!report.sessionId) navigate('/capture', { replace: true });
  }, [report.sessionId, navigate]);

  // Auto-scroll: run after layout (so the new message is measured) and again
  // on the next frame to catch any late image/font reflow. Triggered by every
  // change to message count, sending state, or the keyboard inset (mobile).
  useLayoutEffect(() => {
    const scrollToBottom = (smooth) => {
      const c = scrollRef.current;
      if (!c) return;
      c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      endRef.current?.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' });
    };
    scrollToBottom(true);
    const r1 = requestAnimationFrame(() => scrollToBottom(true));
    const r2 = setTimeout(() => scrollToBottom(false), 220);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(r2);
    };
  }, [report.messages.length, sending, keyboardInset]);

  // Keep the composer above the on-screen keyboard on iOS Safari.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  async function onSend(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || sending || !report.sessionId) return;
    setError('');
    setSending(true);
    const userMsg = { role: 'user', text, time: timeLabel() };
    setReport((prev) => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setInput('');
    try {
      const res = await sendMessage({ token, sessionId: report.sessionId, message: text });
      const agentMsg = { role: 'agent', text: res.reply, time: timeLabel() };
      let createdTicket = null;
      setReport((prev) => {
        const next = { ...prev, messages: [...prev.messages, agentMsg] };
        if (res.ticket) {
          next.ticket = res.ticket;
          createdTicket = res.ticket;
        }
        return next;
      });
      if (createdTicket) {
        addTicket(createdTicket);
        navigate('/confirm', { replace: true });
      }
    } catch (err) {
      const expired = err.status === 404 || err.status === 401;
      setError(
        expired
          ? 'Your session expired. Tap “Start over” to begin a new report.'
          : (err.message || 'Network error.'),
      );
      setReport((prev) => ({
        ...prev,
        messages: prev.messages.map((m, i) =>
          i === prev.messages.length - 1 && m.role === 'user' ? { ...m, failed: true } : m,
        ),
        ...(expired ? { sessionId: null } : {}),
      }));
      if (expired) {
        // Give the user a moment to read the toast before redirecting.
        setTimeout(() => navigate('/capture', { replace: true }), 1500);
      }
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const messages = report.messages || [];

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="bg-surface-container-lowest border-b border-outline-variant fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16">
        <button
          onClick={() => navigate('/')}
          className="text-on-surface hover:bg-surface-container rounded-full w-11 h-11 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to dashboard"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-['Public_Sans'] font-semibold text-xl text-primary">Baladiya Assistant</h1>
        <div className="w-11" />
      </header>

      <main
        className="flex-1 mt-16 relative flex flex-col w-full max-w-container-max mx-auto"
        style={{ paddingBottom: `calc(112px + ${keyboardInset}px)` }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-gutter flex flex-col gap-6">
          <div className="flex justify-center w-full mt-2">
            <span className="font-label-sm text-label-sm text-secondary bg-surface-variant/50 px-3 py-1 rounded-full">
              Today, {conversationStart}
            </span>
          </div>

          {messages.map((m, idx) =>
            m.role === 'user' ? (
              <div key={idx} className="flex flex-col items-end w-full gap-1">
                <div className={`bg-primary text-on-primary rounded-xl rounded-tr-sm p-3 max-w-[85%] md:max-w-[70%] shadow-sm ${m.failed ? 'opacity-60 ring-2 ring-error' : ''}`}>
                  {m.image && (
                    <img src={m.image} alt="Reported issue" className="rounded-lg mb-2 w-full h-auto object-cover max-h-[240px]" />
                  )}
                  <p dir="auto" className="font-body-md text-body-md whitespace-pre-wrap">{m.text}</p>
                </div>
                <div className="flex items-center gap-1 mr-1">
                  {m.failed && (
                    <span className="text-[11px] text-error font-label-sm">Failed to send</span>
                  )}
                  {m.time && <span className="text-[11px] text-secondary">{m.time}</span>}
                </div>
              </div>
            ) : (
              <div key={idx} className="flex gap-3 w-full max-w-[95%] md:max-w-[80%] items-start">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <span className="material-symbols-outlined text-[18px] md:text-[22px]">smart_toy</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="bg-surface-container rounded-xl rounded-tl-sm p-4 shadow-sm border border-outline-variant/30">
                    <p dir="auto" className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{m.text}</p>
                  </div>
                  {m.time && <span className="text-[11px] text-secondary ml-1">{m.time}</span>}
                </div>
              </div>
            )
          )}

          {sending && (
            <div className="flex gap-3 w-full max-w-[80%] items-start">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm mt-1">
                <span className="material-symbols-outlined text-[18px] md:text-[22px]">smart_toy</span>
              </div>
              <div className="bg-surface-container rounded-xl rounded-tl-sm p-4 shadow-sm border border-outline-variant/30">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} aria-hidden className="h-px w-full" />
        </div>
      </main>

      {error && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[60] bg-error-container text-on-error-container px-4 py-2 rounded-full text-label-sm font-label-sm shadow-lg flex items-center gap-2 max-w-[90%]"
          style={{ bottom: `calc(120px + ${keyboardInset}px)` }}
          role="alert"
        >
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span className="truncate">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-1 text-on-error-container/70 hover:text-on-error-container"
            aria-label="Dismiss error"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <div
        ref={composerRef}
        className="fixed left-0 w-full bg-surface-container-lowest border-t border-outline-variant/40 px-margin-mobile py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] z-40"
        style={{ bottom: `${keyboardInset}px` }}
      >
        <div className="max-w-container-max mx-auto flex items-end gap-3">
          <div className="flex-1 bg-surface-container rounded-3xl border border-outline-variant/60 flex items-center px-4 py-1 min-h-[48px] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <textarea
              dir="auto"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              rows={1}
              placeholder="Type your reply…"
              className="w-full bg-transparent border-none focus:ring-0 resize-none font-body-md text-body-md text-on-surface py-2.5 max-h-[120px] outline-none placeholder:text-secondary-fixed-dim"
            />
          </div>
          <button
            onClick={() => onSend()}
            disabled={sending || !input.trim()}
            className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center shrink-0 hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Automatic sign-out after the idle time of the security policy (GET /api/auth/password-rules → idleTimeoutMinutes, 0 = off). Activity is
// a click, a key, the wheel, a touch or moving the mouse, shared by every tab of the browser (localStorage), so working in one tab keeps the
// others signed in. While the user works a heartbeat (POST /api/auth/activity, at most once a minute) keeps the session alive on the
// server too; the server refuses a session idle for longer, so a token left behind cannot be used. A warning shows one minute before.
import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { securityApi } from '../../services/securityApi';

const LAST_ACTIVITY_KEY = 'serp_last_activity';
const WARN_SECONDS = 60;
const HEARTBEAT_MS = 60_000;

const readLast = () => { try { return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0; } catch { return 0; } };
const writeLast = (time: number) => { try { localStorage.setItem(LAST_ACTIVITY_KEY, String(time)); } catch { /* the in-memory time still counts */ } };

export const IdleSignOut: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  const { t } = useLanguage();
  const [minutes, setMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const last = useRef(Date.now());
  const lastBeat = useRef(0);
  const signOut = useRef(onSignOut);
  signOut.current = onSignOut;

  useEffect(() => {
    let alive = true;
    void securityApi.passwordRules().then(rules => { if (alive) setMinutes(rules.idleTimeoutMinutes); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (minutes <= 0) return;
    const mark = () => {
      const now = Date.now();
      // Moving the mouse fires many events: one write every few seconds is enough.
      if (now - last.current < 5_000) return;
      last.current = now;
      writeLast(now);
      if (now - lastBeat.current >= HEARTBEAT_MS) {
        lastBeat.current = now;
        void securityApi.activity().catch(() => undefined);
      }
    };
    last.current = 0;
    mark();
    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'wheel', 'touchstart', 'mousemove'];
    events.forEach(name => window.addEventListener(name, mark, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = (Date.now() - Math.max(last.current, readLast())) / 1000;
      const limit = minutes * 60;
      if (idle >= limit) {
        window.clearInterval(timer);
        signOut.current();
      } else setSecondsLeft(idle >= limit - WARN_SECONDS ? Math.ceil(limit - idle) : null);
    }, 1_000);
    return () => {
      events.forEach(name => window.removeEventListener(name, mark));
      window.clearInterval(timer);
    };
  }, [minutes]);

  if (secondsLeft === null) return null;
  return (
    <Modal isOpen onClose={() => { last.current = 0; window.dispatchEvent(new Event('keydown')); }} title={t('app.idle.title')} maxWidth="md">
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <Clock className="h-4 w-4 text-amber-500" />{t('app.idle.message', { seconds: secondsLeft })}
        </p>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => { last.current = 0; window.dispatchEvent(new Event('keydown')); }}>{t('app.idle.stay')}</Button>
        </div>
      </div>
    </Modal>
  );
};

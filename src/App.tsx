import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { MCDesktop } from './components/MCDesktop';
import { LoginScreen } from './components/LoginScreen';
import { SecretaryDesktop } from './components/SecretaryDesktop';
import { ThemeProvider } from './context/ThemeContext';
import { PrecitaForm } from './components/PrecitaForm';

export const DEFAULT_TWEAKS = {
  showRedAlert: true,
  startScreen: 'dashboard',
  patientDefaultTab: 'resumen',
  darkModeCritical: true,
  brandColor: '#671E75',
};

type Role = 'doctor' | 'secretary' | null;

const ENABLE_DEMO_MAC_SHELL = import.meta.env.VITE_DEMO_MAC_SHELL === 'true';

async function detectRole(userId: string): Promise<Role> {
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
  if (doctor) return 'doctor';
  const { data: secretary } = await supabase.from('secretaries').select('id').eq('user_id', userId).maybeSingle();
  if (secretary) return 'secretary';
  return null;
}

export default function App() {
  // Check for public precita route BEFORE any auth hooks
  const precitaToken = (() => {
    const m = window.location.pathname.match(/^\/precita\/([^/?]+)/);
    return m ? m[1] : null;
  })();

  if (precitaToken) {
    return (
      <ThemeProvider>
        <PrecitaForm token={precitaToken} />
      </ThemeProvider>
    );
  }

  return <AuthApp />;
}

function AuthApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role | 'loading'>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setRole(null); return; }
    setRole('loading');
    detectRole(session.user.id).then(setRole);
  }, [session]);

  const isLoading = session === undefined || (!!session && role === 'loading');

  function renderContent() {
    if (!session) return <LoginScreen />;
    if (role === 'loading' || role === null) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F6F5F2', fontFamily: 'Franklin Gothic', color: '#8E8E93', fontSize: 14 }}>
        {role === null ? 'Usuario sin rol asignado. Contacta al administrador.' : 'Cargando...'}
      </div>
    );
    if (role === 'secretary') return <SecretaryDesktop />;
    return <MCDesktop tweaks={DEFAULT_TWEAKS} />;
  }

  const urlLabel = session
    ? `connect.christusmuguerza.com.mx - ${session.user.email}`
    : 'connect.christusmuguerza.com.mx - Iniciar sesion';

  function renderShell(content: ReactNode, title = urlLabel) {
    if (!ENABLE_DEMO_MAC_SHELL) {
      return <main className="mc-app">{content}</main>;
    }

    return (
      <div className="mc-shell mc-shell--demo">
        <div className="mc-window">
          <div className="mc-titlebar">
            <div className="lights"><span className="r"/><span className="y"/><span className="g"/></div>
            <div className="url">{title}</div>
          </div>
          <div className="mc-window-body">
            {content}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && session === undefined) {
    return (
      <ThemeProvider>
        {renderShell(
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F6F5F2', fontFamily: 'Franklin Gothic', color: '#8E8E93', fontSize: 14 }}>
            Cargando...
          </div>,
          'connect.christusmuguerza.com.mx'
        )}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {renderShell(renderContent())}
    </ThemeProvider>
  );
}

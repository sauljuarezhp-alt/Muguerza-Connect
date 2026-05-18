import { useState } from 'react';
import { supabase } from '../lib/supabase';

const BRAND = '#671E75';

export function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) { setError('Ingresa tu correo y contraseña.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError('Correo o contraseña incorrectos.');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #E5E5EA', borderRadius: 10,
    padding: '11px 14px', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', background: '#FAFAFA', color: '#1C1C1E',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#F6F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: '#fff', borderRadius: 18, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', padding: '36px 32px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Logo + título */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1px #E5E5EA', marginBottom: 14 }}>
            <img src="/reach2030-logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ fontFamily: 'Franklin Gothic, Libre Franklin, sans-serif', fontWeight: 500, fontSize: 20, lineHeight: 1 }}>
            Muguerza <span style={{ color: BRAND }}>Connect</span>
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 5, letterSpacing: 0.3 }}>Portal médico · Inicia sesión</div>
        </div>

        {/* Campos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#3C3C43', marginBottom: 6, fontFamily: 'Franklin Gothic', fontWeight: 500 }}>Correo electrónico</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="doctor@hospital.com"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = BRAND)}
              onBlur={e => (e.target.style.borderColor = '#E5E5EA')}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="email"
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#3C3C43', marginBottom: 6, fontFamily: 'Franklin Gothic', fontWeight: 500 }}>Contraseña</div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 42 }}
                onFocus={e => (e.target.style.borderColor = BRAND)}
                onBlur={e => (e.target.style.borderColor = '#E5E5EA')}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
              <span
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 11.5, color: '#8E8E93', userSelect: 'none', fontFamily: 'Franklin Gothic' }}>
                {showPw ? 'Ocultar' : 'Ver'}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: '9px 12px', background: '#FDECEC', border: '1px solid #F5C6C6', borderRadius: 8, fontSize: 12.5, color: '#D93A3A' }}>
            {error}
          </div>
        )}

        {/* Botón */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ marginTop: 20, width: '100%', background: loading ? '#B07ABB' : BRAND, color: '#fff', border: 0, padding: '12px 0', borderRadius: 10, fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
          {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11.5, color: '#8E8E93' }}>
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </div>
      </div>
    </div>
  );
}

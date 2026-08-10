import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BRAND_LOGO_PATH, BRAND_NAME, BRAND_TAGLINE } from '@/config/brand';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const from = location.state?.from?.pathname || '/dashboard/pdv';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    if (!password.trim()) {
      setAuthError('Digite a senha de acesso.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await login(password.trim());
      if (error) {
        setAuthError(error.message || 'Nao foi possivel entrar.');
        return;
      }

      navigate(from, { replace: true });
    } catch {
      setAuthError('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-bg ag-speedlines relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--layout-bg)] p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(130deg, color-mix(in srgb, var(--layout-bg) 42%, transparent), color-mix(in srgb, var(--layout-surface) 38%, transparent)), url('/telainicialdelogin.png')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Helmet>
        <title>Acesso - {BRAND_NAME}</title>
        <meta name="description" content="Sistema de gestao comercial e ponto de venda" />
      </Helmet>

      <div className="ag-enter relative z-[2] w-full max-w-[40rem] max-h-[calc(100dvh-2rem)] overflow-y-auto ag-cut ag-panel p-1 sm:max-h-[calc(100dvh-3rem)]">
        <div className="ag-cut bg-[var(--layout-surface)]/94 p-6 sm:p-8">
          <div className="mb-8 text-center">
            <div className="ag-cut-sm mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center border border-[var(--layout-border)] bg-[var(--layout-elevated)] shadow-[0_20px_30px_-22px_var(--layout-accent)]">
              <img src={BRAND_LOGO_PATH} alt={BRAND_NAME} className="h-16 w-16 object-cover" />
            </div>
            <h1 className="ag-heading text-4xl leading-none text-[var(--layout-text)] sm:text-5xl">{BRAND_NAME}</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--layout-text-muted)]">
              {BRAND_TAGLINE}
            </p>
          </div>

          <div className="ag-cut ag-panel p-5 sm:p-6">
            <h2 className="ag-heading mb-3 text-3xl leading-none text-[var(--layout-text)]">
              Acesso ao sistema
            </h2>

            {authError ? (
              <div className="ag-cut-sm mb-5 flex items-start gap-3 border border-red-500/45 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm leading-relaxed text-red-300">{authError}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em] text-[var(--layout-text-muted)]">
                  Senha de acesso
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--layout-text-muted)]" />
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (authError) setAuthError('');
                    }}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-none ag-cut-sm pl-10 pr-4 py-3 text-[var(--layout-text)] placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center py-3">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--layout-text-muted)]">
            {'(c)'} 2026 {BRAND_NAME}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

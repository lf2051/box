import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Erro da aplicação:', error, info) }

  render() {
    if (this.state.error) return <div className="login-screen"><div className="login-card"><div className="eyebrow">ERRO DE CARREGAMENTO</div><h1>Não foi possível abrir o sistema</h1><p>Atualize a página. Se continuar, envie esta mensagem: {this.state.error.message}</p><button className="primary full" onClick={() => window.location.reload()}>Atualizar página</button></div></div>
    return this.props.children
  }
}

import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

// Aísla fallas de render a la sección donde ocurren en vez de dejar toda la
// app en blanco — los error boundaries de React solo existen como clase.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.handleReset);
      return (
        <div className="flex flex-col items-center gap-2.5 px-5 py-10 text-center text-faint text-[12.5px]">
          <AlertTriangle size={20} color={TOKENS.expense} />
          <div>Esta sección tuvo un problema y no se pudo mostrar.</div>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 rounded-lg border border-border bg-transparent text-muted text-xs cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

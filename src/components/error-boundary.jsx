import React from "react";
import { Button } from "./ui";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("UI crash caught by ErrorBoundary", error, info);
    this.setState({ info });
  }
  reset = () => {
    this.setState({ hasError: false, error: null, info: null });
    this.props.onReset && this.props.onReset();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50 px-4">
          <div className="max-w-xl w-full p-5 rounded-2xl border border-rose-200 bg-white shadow">
            <div className="text-lg font-semibold text-rose-700 mb-2">Unerwarteter Fehler</div>
            <p className="text-sm text-zinc-700">
              Die Oberfläche ist auf einen Fehler gestoßen. Du kannst zur Übersicht zurückkehren oder neu versuchen.
            </p>
            {this.state.error && (
              <pre className="mt-3 p-2 rounded-xl bg-zinc-100 text-xs text-zinc-700 overflow-auto">
                {String(this.state.error)}
              </pre>
            )}
            <div className="flex gap-2 mt-4">
              <Button onClick={this.reset} variant="primary">Neu versuchen</Button>
              <Button onClick={() => window.location.reload()} variant="secondary">Seite neu laden</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

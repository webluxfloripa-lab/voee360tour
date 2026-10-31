import { Link } from "@tanstack/react-router";

export function TourUnavailable() {
  return (
    <main className="center-screen" role="status">
      <div className="empty">
        <h1>Este tour não está disponível.</h1>
        <p>A publicação foi retirada. Se voltar ao ar, ela será exibida aqui.</p>
        <Link to="/">Voltar ao início</Link>
      </div>
    </main>
  );
}

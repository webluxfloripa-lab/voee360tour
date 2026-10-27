import {
  HeadContent,
  Scripts,
  Outlet,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
import styles from "../styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "voee360tour · Mundos que conectam" },
      { name: "theme-color", content: "#10141c" },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.svg" },
    ],
  }),
  component: () => (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <main className="center-screen">
      <div className="empty">
        <h1>Este endereço não está disponível.</h1>
        <p>O tour pode estar em rascunho ou arquivado.</p>
        <Link to="/">Voltar ao início</Link>
      </div>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="center-screen">
      <div className="empty">
        <h1>Não foi possível carregar.</h1>
        <p>Confira sua conexão e tente novamente.</p>
        <button onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  ),
});

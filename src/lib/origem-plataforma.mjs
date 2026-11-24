const ORIGEM_PADRAO = "https://vps-16302377.tail7dc411.ts.net:10000";

export function origemDaPlataforma() {
  const configurada = (process.env.PLATFORM_ORIGIN ?? ORIGEM_PADRAO).trim();
  if (!configurada) return null;
  try {
    const url = new URL(configurada);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.origin;
  } catch {
    // Uma origem inválida deixa a integração indisponível neste ambiente.
  }
  return null;
}

export function schedulingClientName(original: string, cnpj: string | null, clients: { cnpj: string; apelido: string }[]) {
  const digits = (s: string) => s.replace(/\D/g, "");
  return clients.find(c => digits(c.cnpj) === digits(cnpj ?? ""))?.apelido.trim() || original;
}
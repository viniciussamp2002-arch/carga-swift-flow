export const normalizeCpf = (value: string) => value.replace(/\D/g, "");
export function validCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    const sum = [...cpf.slice(0, size)].reduce((n, digit, i) => n + Number(digit) * (size + 1 - i), 0);
    const digit = (sum * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(cpf[size])) return false;
  }
  return true;
}
export const maskCpf = (value: string | null) => value ? `***.***.${normalizeCpf(value).slice(6, 9)}-**` : "—";
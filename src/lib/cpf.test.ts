import { describe, expect, it } from "vitest";
import { normalizeCpf, validCpf } from "./cpf";
describe("CPF para acesso", () => {
  it("aceita pontuação e normaliza", () => { expect(normalizeCpf("529.982.247-25")).toBe("52998224725"); expect(validCpf("529.982.247-25")).toBe(true); });
  it("rejeita dígitos verificadores incorretos", () => expect(validCpf("52998224724")).toBe(false));
  it("rejeita sequência repetida", () => expect(validCpf("11111111111")).toBe(false));
});
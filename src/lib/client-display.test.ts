import { expect, it } from "vitest";
import { schedulingClientName } from "./client-display";
it("uses a nickname linked by CNPJ without changing the fiscal name", () => { expect(schedulingClientName("Cliente Empresarial", "12.345.678/0001-90", [{ cnpj: "12345678000190", apelido: "Cliente Curto" }])).toBe("Cliente Curto"); });
it("retains the original name when no nickname is registered", () => { expect(schedulingClientName("Cliente Empresarial", "12345678000190", [{ cnpj: "12345678000190", apelido: " " }])).toBe("Cliente Empresarial"); });
it("does not apply another client's nickname", () => { expect(schedulingClientName("Cliente Empresarial", "12345678000190", [{ cnpj: "99999999000199", apelido: "Outro" }])).toBe("Cliente Empresarial"); });
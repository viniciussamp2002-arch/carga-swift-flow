import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { emptyFreightRule } from "./freight";
const url = process.env["TEST_DB_URL"], key = process.env["TEST_DB_KEY"], token = process.env["TEST_DB_TOKEN"];
const live = url && key && token ? createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } }) : null;
describe.skipIf(!live)("live financial engine", () => {
  async function simulate(rule: unknown, weight: number, value: number, km?: number) {
    if (!live) throw new Error("Live test session required");
    const r = await live.rpc("simular_frete", { _regras: rule, _peso: weight, _valor: value, ...(km === undefined ? {} : { _km: km }) });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  it("ad valorem 0.3% uses NF value × 0.003", async () => {
    const r = await simulate({ ...emptyFreightRule(), metodo: "fixo", tarifa: 530, operacoes: [{ nome: "Ad valorem", tipo: "percentual", base: "nf", valor: 0.3 }] }, 500, 10000);
    expect(r.ad_valorem).toBe(30); expect(r.total).toBe(560);
  });
  it("gross-up 530 at 22.5% returns 683.87 with 153.87 embedded tax", async () => {
    const r = await simulate({ ...emptyFreightRule(), metodo: "fixo", tarifa: 530, operacoes: [{ nome: "ICMS contratual", tipo: "icms", base: "frete", valor: 22.5, por_dentro: true }] }, 500, 10000);
    expect(r.total).toBe(683.87); expect(r.tributos).toBe(153.87);
  });
  it("distance boundaries include 80 in the first band and 150 in the second", async () => {
    const rule = { ...emptyFreightRule(), metodo: "faixas", faixas: [{ inicio: 0, fim: 80, unidade: "fixo", tarifa: 50 }, { inicio: 80, fim: 150, unidade: "fixo", tarifa: 65 }] };
    expect((await simulate(rule, 500, 10000, 80)).total).toBe(50);
    expect((await simulate(rule, 500, 10000, 150)).total).toBe(65);
    expect((await simulate(rule, 500, 10000, 80.001)).total).toBe(65);
  });
  it("missing distance returns a pending calculation, not an invented amount", async () => {
    expect((await simulate({ ...emptyFreightRule(), metodo: "faixas", faixas: [{ inicio: 0, fim: 80, unidade: "fixo", tarifa: 50 }] }, 500, 10000)).total).toBeNull();
  });
  it("city fixed tariffs replace or add to base and disabled charges do not apply", async () => {
    if (!live) throw new Error("Live test session required");
    const cities = await live.from("distancias").select("id,cidade,uf").limit(1);
    const city = cities.data?.[0]; if (!city) throw new Error("A validated city is required");
    const op = { nome: "Tarifa cidade", tipo: "fixo", base: "acumulado", valor: 50, cidade: city.cidade, uf: city.uf, substitui_base: true };
    const rule = { ...emptyFreightRule(), metodo: "fixo", tarifa: 530, operacoes: [op, { nome: "Não habilitado", tipo: "fixo", base: "acumulado", valor: 99, habilitado: false }] };
    const a = await live.rpc("simular_frete_cidade", { _regras: rule, _cidade: city.id, _peso: 500, _valor: 10000 });
    expect(a.error).toBeNull(); expect(a.data.total).toBe(50);
    const b = await live.rpc("simular_frete_cidade", { _regras: { ...rule, operacoes: [{ ...op, substitui_base: false }] }, _cidade: city.id, _peso: 500, _valor: 10000 });
    expect(b.error).toBeNull(); expect(b.data.total).toBe(580);
  });
});
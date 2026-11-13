// Browser-side NF-e XML parser (basic, robust to namespace prefixes)
export interface ParsedNFe {
  chave_nfe: string;
  numero: string;
  serie: string;
  data_emissao: string | null;
  cnpj_emissor: string;
  fornecedor: string;
  cnpj_destinatario: string;
  cliente: string;
  cidade: string;
  uf: string;
  peso: number;
  volumes: number;
  valor: number;
  cfops: string[];
}

const txt = (el: Element | null | undefined, tag: string) => {
  if (!el) return "";
  const n = el.getElementsByTagName(tag)[0];
  return n?.textContent?.trim() ?? "";
};
const num = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function parseNFeXml(xmlString: string): ParsedNFe | { error: string } {
  const dom = new DOMParser().parseFromString(xmlString, "text/xml");
  if (dom.getElementsByTagName("parsererror").length > 0) return { error: "XML inválido" };

  const infNFe = dom.getElementsByTagName("infNFe")[0];
  if (!infNFe) return { error: "Não é um XML de NF-e válido (sem <infNFe>)" };

  const chave = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");
  if (!/^\d{44}$/.test(chave)) return { error: "Chave de acesso inválida: são necessários 44 dígitos" };
  const ide = infNFe.getElementsByTagName("ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0];
  const dest = infNFe.getElementsByTagName("dest")[0];
  const enderDest = dest?.getElementsByTagName("enderDest")[0];
  const transp = infNFe.getElementsByTagName("transp")[0];
  const vols = Array.from(transp?.getElementsByTagName("vol") ?? []);
  const total = infNFe.getElementsByTagName("total")[0];
  const icmsTot = total?.getElementsByTagName("ICMSTot")[0];

  return {
    chave_nfe: chave,
    numero: txt(ide, "nNF"),
    serie: txt(ide, "serie"),
    data_emissao: txt(ide, "dhEmi").slice(0, 10) || txt(ide, "dEmi") || null,
    cnpj_emissor: txt(emit, "CNPJ"),
    fornecedor: txt(emit, "xNome"),
    cnpj_destinatario: txt(dest, "CNPJ") || txt(dest, "CPF"),
    cliente: txt(dest, "xNome"),
    cidade: txt(enderDest, "xMun"),
    uf: txt(enderDest, "UF"),
    peso: vols.reduce((s, vol) => s + num(txt(vol, "pesoB") || txt(vol, "pesoL") || "0"), 0),
    volumes: vols.reduce((s, vol) => s + (parseInt(txt(vol, "qVol") || "0", 10) || 0), 0),
    valor: num(txt(icmsTot, "vNF") || "0"),
    cfops: Array.from(new Set(Array.from(infNFe.getElementsByTagName("CFOP")).map((e) => e.textContent?.trim() ?? "").filter(Boolean))),
  };
}

import { CHECK_QUESTIONS, type ReceivingData } from "./receiving-rules";
import { OC_STATUS_LABEL, OC_TIPO_LABEL } from "./occurrence-rules";
import { fmtBRL, fmtNum, fmtDateTime } from "./format";
export async function receivingPdf(data: ReceivingData, kind: "checklist" | "recibo", version: number, responsible: string, issued: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  function line(text: string, bold = false, size = 10) {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text,174);
    for (const row of lines) {
      if (y > 269) { doc.addPage(); y = 20; }
      doc.text(row,18,y); y += size * 0.48 + 1;
    }
  }
  line(data.empresa.nome,true,13);line(`${data.empresa.apresentacao} | CNPJ ${data.empresa.cnpj}`,true);
  line(data.empresa.endereco,false,9);y += 5;
  line(kind === "recibo" ? "RECIBO DE DESCARGA" : "CHECKLIST DE RECEBIMENTO",true,14);
  line(`Transporte ${data.transporte || "—"} | Versão ${version}`,true);y += 3;
  line(`Transportadora: ${data.transportadora || "—"}`);line(`Motorista: ${data.motorista || "—"}`);
  line(`Placa: ${data.placa || "—"} | Reboque: ${data.reboque || "—"}`);
  line(`Recebimento / conferência: ${data.data ? fmtDateTime(data.data) : "—"}`);
  line(`Conferente: ${data.conferente || "—"}`);line(`Fornecedores: ${data.fornecedores.join("; ") || "—"}`);
  line(`NFs: ${data.notas.length} | Peso: ${fmtNum(data.peso_kg,3)} kg | Volumes previstos: ${fmtNum(data.volumes_previstos)}`);
  y += 4;
  if (kind === "recibo") {
    line(`Peso em toneladas: ${fmtNum(data.toneladas,3)} t`);line(`Tarifa por tonelada: ${fmtBRL(data.tarifa)}`);
    line(`VALOR TOTAL DA DESCARGA: ${fmtBRL(data.valor_total)}`,true,13);y += 7;
    line(`Declaramos a prestação do serviço de descarga das mercadorias do transporte ${data.transporte || "—"}, no valor de ${fmtBRL(data.valor_total)}.`);
    if(data.observacoes) line(`Observações: ${data.observacoes}`);
  } else {
    line("Condições do veículo e mercadoria",true,12);
    for(const [key,label] of Object.entries(CHECK_QUESTIONS)) line(`${label} ${ {sim:"Sim",nao:"Não",na:"Não se aplica","":"Não informado"}[data.respostas[key] || ""] }`);
    line(`Número do lacre: ${data.numero_lacre || "—"}`);line(`Condições gerais do veículo: ${data.condicoes_veiculo || "—"}`);
    line(`Volumes recebidos: ${data.volumes_recebidos == null ? "—" : fmtNum(data.volumes_recebidos)}`);
    if(data.observacoes) line(`Observações: ${data.observacoes}`);y += 3;
    line("Notas fiscais e fornecedores",true,12);
    for(const n of data.notas) line(`NF ${n.numero} | ${n.fornecedor} | ${fmtNum(n.peso,3)} kg | ${n.volumes} volumes`,false,9);
    y += 3;line("Ocorrências por nota fiscal",true,12);
    if(!data.ocorrencias.length) line("Nenhuma ocorrência registrada.");
    for(const o of data.ocorrencias) line(`NF ${o.numero} | ${OC_TIPO_LABEL[o.tipo] || o.tipo} | ${OC_STATUS_LABEL[o.status] || o.status}${o.quantidade == null ? "" : ` | ${o.quantidade} ${o.unidade || ""}`} — ${o.descricao}`,false,9);
  }
  if(y > 218) {doc.addPage(); y = 25;} else y = Math.max(y+14,205);
  line(`Teresina – PI, ${data.data ? new Date(data.data).toLocaleDateString("pt-BR") : "________________"}.`);
  y += 18;line("____________________________________________________");line(`Motorista: ${data.motorista || ""}`);
  y += 12;line("____________________________________________________");line(`Conferente: ${data.conferente || ""}`);
  const pages = doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text(`Emitido por ${responsible || "—"} em ${fmtDateTime(issued)} | Página ${p}/${pages}`,18,287);}
  return doc.output("blob");
}
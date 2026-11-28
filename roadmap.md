- [x] Atualização recebimento 19/11: menu único de visualização; PDFs individuais/consolidados de ocorrências e anexos versionados; recibos assinados; central com filtros, totais e exportações.
  - Validado como administrador: alternância individual/agrupada, emissão individual/consolidada, foto e PDF anexados, substituição preservando versões, leitura após recarga, consulta e download na central, exportações PDF/Excel, novembro/dezembro, cancelamento e reimpressão sem duplicação; 42 testes passaram, PDF longo de 12 páginas sem corte final. Motorista não lê nem envia anexos administrativos. Corrigida ambiguidade de variável UF que impedia cadastro de NF.
  - Carga exclusiva VALIDACAO-ASSINADOS-191126 e NF/produto de teste com peso/valor zero mantidos para rastreabilidade; recibo de teste cancelado, anexos marcados sem assinatura real. Documentos originais preservados; recibos existentes somam R$300,00. Sem publicação.
- [ ] Validação externa recebimento 19/11: fotografia por câmera e impressão física — depende de aparelho/impressora; seleção de imagem/PDF, impressão em PDF e apresentação móvel já conferidas no navegador.
- [x] Etapa 1 Transmerida: visual do print, início com cartões, menu recolhível, páginas dos módulos
- [x] Notas estilo Excel: edição na célula, colunas (ocultar/arrastar/largura), visualização salva, busca geral, totais, importar planilha, adicionar à carga
- [x] Cargas de entrada + confirmação de chegada → depósito
- [x] Clientes com agendamento obrigatório (CNPJ) + aba Agendamentos integrada
- [x] Atualização login/cadastros/financeiro: CPF seguro, solicitações pendentes, aprovação e perfis de acesso
  - Solicitação VALIDACAO CPF 141126 persistida pendente, sem autorização operacional. Contas antigas de motorista habilitam CPF pela ação de recuperação em Usuários, após validar CPF e vínculo.
- [x] Atualização login/cadastros/financeiro: documentos complementares e fila offline compartilhada
  - Classificação, triagem, vínculos e pedido de nova foto implementados; fila aguarda confirmação de transação local e registro remoto. Não validado com câmera física nem nova classificação de foto real.
- [x] Atualização login/cadastros/financeiro: menu superior e cadastros
  - Menu, fornecedor, ativação de motorista e vínculo veículo–motorista–carga de entrada disponíveis; telas administrativas verificadas.
- [x] Atualização login/cadastros/financeiro: tabelas versionadas, distâncias, simulação e memória por NF
  - Regras configuráveis sem ativar exemplos; contrato explícito quando houver ambiguidade, destino efetivo e peso operacional separados dos dados fiscais.
- [x] Atualização login/cadastros/financeiro: automação, conferência financeira e Excel
  - Aprovação alimenta financeiro; fechamento exige canhoto aprovado e cálculos completos; fechamento bloqueia recálculo. Exportação Excel verificada.
- [ ] Validação externa: câmera e reabertura offline em Android/iPhone reais — depende de aparelho e acesso de motorista.
- [ ] Validação externa: contrato real, distância e tributos aplicáveis — depende de parâmetros comerciais confirmados.
  - 54 testes passaram; seis simulações reais conferiram faixa R$240, percentual R$30, adicional R$270, tonelada R$297,50, tributo por dentro R$125 e distância pendente. Cadastro de CPF persistido pendente; telas, parâmetros e Excel verificados. Aprovação completa de foto nova e faturamento não exercitados; sem publicação.
- [x] Revisão Cargas de Entrada: itens XML, ocorrências por produto e fotos múltiplas, destaque das linhas
- [x] Revisão Cargas de Entrada: remover acesso redundante de checklist; recibo multimodal, Pix configurável, NFs completas e PDF
- [x] Revisão Cargas de Entrada: 50 testes de cálculo e preservação; conta administrativa verificou 15 NFs, expansão, ausência do Checklist, recibo misto R$370 e PDF A4 com Pix, NFs e assinaturas; tela de 625px sem excesso horizontal.
- [ ] Validação de ocorrência por produto e fotos reais — depende dos XMLs originais: as 15 NFs existentes não possuíam produtos armazenados. Recuperação segura disponível; nenhum produto fiscal ou cobrança fictícia foi inserido. Emissão de nova versão e impressão física não exercitadas nesta revisão.
- [ ] Estoque (saldos por fornecedor)
- [ ] Montagem de cargas: adicionar à carga pela tabela, sequência, romaneio A4, conferência, saída
- [ ] Agendamentos com histórico
- [ ] Entregas e ocorrências (comprovantes, replanejamento)
- [ ] Financeiro: tabelas de cobrança por cliente com memória de cálculo
- [ ] Relatórios e revisão geral
- [x] Atualização do módulo Cargas de Entrada (agrupamento + ocorrências de recebimento)
- [x] Atualização consolidada 03–08: integridade e proteção contra XMLs duplicados
- [x] Atualização consolidada 03–08: importação individual/agrupada sem fusão fiscal
- [x] Atualização consolidada 03–08: ocorrências permanentes e rastreáveis em todos os módulos
  - Validado: 14 testes; criação, observação, resolução, recarga, filtro, carga agrupada, saída, entregas e consulta geral como administrador; tela de celular conferida.
  - Registro de validação VALIDACAO-OC-131126 mantido, com peso/valor zero e histórico permanente; quatro ocorrências preexistentes preservadas. Anexos e propagação em agendamento específico ainda não exercitados nesta etapa.
- [x] Atualização consolidada 03–08: checklist e recibo de descarga em PDF
  - Validado: 25 testes de regras; checklist salvo/reaberto, fornecedores múltiplos, ocorrência específica incluída no PDF, versões e histórico, recibo A4 de uma página (8.500 kg × R$35/t = R$297,50), documento longo de cinco páginas sem cortes e recebimento parcial/definitivo com ciência das divergências.
  - Preservadas 49 notas, oito cargas e cinco ocorrências anteriores; carga exclusiva VALIDACAO-DOCUMENTOS-131126 e duas notas de peso/valor fiscal zero mantidas para rastreabilidade. Emissão não criou financeiro.
  - Impressão: PDF conferido e chamada de impressão verificada; impressora física não testada. PDFs regenerados de versões imutáveis salvas. Sem publicação; demais etapas não iniciadas.
- [x] Atualização consolidada 03–08: exclusão segura, cancelamento e arquivamento de cargas
  - Validado: 41 testes de regras; exclusão sem movimento, bloqueio com recebimento/documentos/ocorrência, cancelamento e arquivamento na interface, justificativa obrigatória, bloqueios contra exclusão direta de carga e NF documentada, filtros e histórico persistente; confirmação no celular.
  - Exclusão é não destrutiva: carga sai da operação e continua consultável em Excluídas, com todas as notas e histórico. Cancelamento/arquivamento não desfaz recebimento; entrada recebida arquivada mantém a NF no depósito e suas operações posteriores.
  - Preservados 51 registros fiscais, nove entradas, seis saídas, seis ocorrências, uma entrega e um financeiro anteriores. Fixtures VALIDACAO identificáveis mantidas com peso/valor zero e histórico; não apagadas. Checklist completo de teste continuou gerando prévia após cancelamento; visualização do PDF na impressora não retestada.
  - Sem publicação. Próxima melhoria: portal do motorista e aprovação de comprovantes.
- [x] Atualização consolidada 03–08: portal do motorista, fotos offline e aprovação de comprovantes
  - Feito: perfil motorista vinculado em Usuários, tela de celular com fila de fotos no aparelho, leitura automática, conferência/aprovação/rejeição em Entregas.
  - Não testado ponta a ponta com conta real de motorista nem em Android/iPhone; instalação como aplicativo (PWA) ainda não feita.
- [ ] Atualização consolidada 03–08: testes integrados e conferência da publicação

- [x] Revisão 02: Clientes com Agendamento em Cadastros, colunas simplificadas, lembretes (amanhã/vencido/aguardando), pendências até entrega aprovada, desfazer/refazer em Agendamentos
- [x] Corrigir visibilidade de fotos de todos os tipos em Entregas: quatro fotos reais abertas como administrador, classificação manual disponível, aprovação preserva vínculo ao motorista; 13 testes passaram. Nenhum envio foi alterado/aprovado e nada foi publicado.

## Atualização consolidada 21/11/2026
- [x] 01/07 Portal: fotos ampliadas por carga em andamento, acesso seguro e quatro situações visuais.
- [x] 02 Transportadora de origem na segunda coluna do depósito e filtros.
- [x] 03 Apelidos no cadastro/agendamentos; retirar observação da tabela.
- [x] 04 Dispensa persistente individual de notificações.
- [x] 05 Devoluções por produto, recebimento físico, pallets, etiquetas, prestação de contas e estoque com saídas/reservas seguras.
- [x] 06 Conferir e completar financeiro, distâncias, tabelas por fornecedor e simulação.
- [x] Verificar regras e fluxos administrativos/motorista; não publicar.

  - Executados: 44 testes locais e 5 testes no cálculo financeiro real (ad valorem, ICMS por dentro, limites das faixas, distância pendente, substituição/adicional por cidade e componente desativado).
  - Navegador: depósito com transportadora, 26 produtos de XML existente carregados, devolução de teste por produto com falta sem estoque, recebimento 5 UN, pallets 3+2, retirada 2 UN, saldo 3 UN após recarga, reserva/liberação e repetição de retirada idempotente; saída acima do saldo bloqueada. Etiqueta PDF conferida com apenas saldo 1 UN no pallet 01/02.
  - Fotos reais do motorista ampliadas a 150%; carga de teste finalizada bloqueia consulta de documento e função de foto, administração mantém o arquivo; motorista não consulta devoluções. Notificação dispensada permanece ausente após recarga. Telas sem erros de execução.
  - Registros de teste identificados VALIDACAO-211126-SEM-VALOR e carga 92126 preservados para rastreabilidade; não representam recebimento ou retirada real. Documentos e valores reais não alterados.
- [ ] Validação externa 21/11: câmera/impressora físicas e contratos comerciais reais — depende de aparelhos e parâmetros do escritório; nada publicado.

## Atualização consolidada 25/11/2026
- [x] 01 Pedidos Rancheiro: importação (Excel/CSV/colar) com mapeamento e prévia, manual, lead time, filtros, totais, impressão, faturamento por XML direto ao Depósito
- [x] 02 Impressão de cargas de entrada selecionadas
- [x] 03 Filtros por coluna em Cargas de Entrada, Agendamentos e Pedidos Rancheiro (tabelas internas da carga não alteradas)
- [x] 04 Estoque genérico fora do menu
- [x] 05 Nova devolução manual sem gerar estoque
- [x] 06 Ações → Adicionar à rota de entrega; cargas em montagem visíveis em Entregas
- [ ] Teste pela tela com XML real do Rancheiro e planilha real — depende dos arquivos do escritório

## Ajustes 26/11/2026
- [x] Transporte no Depósito: número manual da carga de entrada ao lado de Transportadora, filtro com contagem e uso na impressão/Excel; conferido na conta do escritório com transporte 1 retornando 4 notas. 4 testes de contagem passaram; build OK; sem publicação.
- [x] Contagem de notas em cada opção do filtro de coluna no Depósito (Fornecedor, Cidade, Transportadora, Status, Agendamento, Motorista): nome + número entre parênteses, sem a palavra "notas"
  - Validado como escritório: Fornecedor com 12 opções somando 92 (ITAMBE 15, Laticinios Bela Vista 57); ao filtrar Itambé a tabela mostra 15 e o filtro de Cidade passa a listar Todos (15) com TERESINA 8, PICOS 3, PARNAIBA 2, PEDRO II 2; "Limpar" devolve 92. 8 testes de contagem/filtro passaram, typecheck limpo, build OK. Nada publicado.

## Ajustes 28/11/2026
- [x] Cargas de saída: editar motorista, veículo, data e observações em cargas ativas; remover notas individualmente durante montagem.
- [x] Excluir/desfazer carga em montagem devolvendo notas ao Depósito, sem apagar recebimento, agendamento ou histórico; bloquear cargas em rota/finalizadas e movimentações reais, inclusive reversão de status para contornar a trava.
- [x] Carga #15 excluída da operação pela tela administrativa; NFs 20786, 250406 e 249692 voltaram como disponíveis e sem carga, com recebimento, agendamentos e financeiro preservados. Histórico e carga tombstone mantidos.
- [x] Depósito: coluna Carga com número da viagem, filtro em cascata, ordenação, Excel e impressão.
  - Validado como escritório: 20 testes passaram; edição da carga em rota #14 abriu com JOSIMAR e RSR2J71, exclusão em rota desabilitada, janela de remoção individual com motivo, edição e remoção temporárias no banco revertidas sem persistir testes. Bloqueios de reversão e retirada direta em rota confirmados. Build OK e navegação sem erros. Nada publicado.
- [x] Ordem das colunas no Depósito: Transporte logo após Recebimento e Carga ao lado de Status; preferência salva no navegador migra sozinha.

## Atualização 28/11/2026 — montar carga pelo menu Ações
- [x] Depósito: menu Ações ganha "Montar carga" (criar carga nova ou adicionar a uma carga em separação/carregamento, com contagem de notas na opção) e "Retirar da carga" (devolve notas selecionadas ao Depósito com motivo).
  - Validado como administrador com NF 13184: adicionada à Carga #17 (carga_id e status separacao confirmados no banco), depois retirada (carga_id nulo e status disponivel confirmados); menu bloqueia as duas ações quando a seleção não permite. 25 testes de load-lifecycle passaram, build OK. Nada publicado.

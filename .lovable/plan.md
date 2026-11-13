# Atualização consolidada Transmerida — alterações 03 a 08

## Estrutura atual e impactos
- O sistema já conecta Cargas de Entrada, Notas / Depósito, Agendamentos, Cargas de Saída, Entregas e Motoristas no mesmo banco.
- O recebimento utiliza `confirmar_chegada`; os agendamentos são criados por um gatilho, e as ocorrências já são compartilhadas entre módulos. Esses caminhos serão preservados.
- Cargas de Entrada já possui visualização individual e agrupada, mas apenas um botão de importação. A validação atual interrompe o lote quando encontra duplicadas; precisa aceitar as válidas e explicar cada rejeição.
- O cadastro de usuários possui administrador, operacional e consulta. Ainda não existe vínculo entre login e motorista, fila de canhotos, checklist ou recibos de descarga.
- A tela atual de Entregas registra resultados diretamente. A aprovação de comprovantes precisará de um procedimento transacional autorizado, separado do reconhecimento automático e da data efetiva da entrega.

## Preservação e execução
Manter dados reais, tabelas operacionais, filtros, edição, cartões da página inicial e menu recolhível. Não refazer o sistema nem alterar achados de segurança não relacionados.

Antes da primeira mudança de banco, conferir restrições e registros existentes, disponibilidade de recuperação do código e backup do banco. Não declarar backup disponível sem confirmação; se não for possível confirmar, informar a limitação antes de qualquer operação que remova registros. Usar alterações aditivas e executar uma etapa por vez.

## Etapa 1 — Integridade e importação de XMLs
- Conferir chaves já cadastradas, inclusive nas notas agrupadas antigas, sem apagar ou reescrever registros para eliminar conflitos.
- Proteger contra duplicidade também no banco e validar a chave de 44 dígitos.
- Rejeitar individualmente arquivos inválidos ou repetidos, informar arquivo, motivo e carga vinculada quando disponível, permitindo importar os válidos.
- Adicionar **Importar Agrupado** e **Importar Individual** dentro da carga. Cada XML continua como uma NF separada no banco.
- Organizar grupos por CNPJ/CPF do destinatário na mesma carga; destinatários diferentes formam grupos separados, nunca uma linha combinada.
- Preservar a alternância entre visualizações, expansão, consulta e ocorrência por NF. Somar peso, volumes e valor sem dupla contagem.

## Etapa 2 — Ocorrências permanentes
- Ampliar tipos e etapas operacionais solicitadas reutilizando o cadastro existente.
- Permitir resolução e observações posteriores com usuário e horário registrados.
- Mostrar o indicador mesmo após resolução em entrada, depósito, agendamentos, saída e entregas; alertar também a linha agrupada.
- Acrescentar coluna filtrável **Ocorrências** no depósito e consulta do histórico completo da NF.

## Etapa 3 — Checklist e recibo de descarga
Organizar o detalhe da carga em **Notas Fiscais | Checklist | Ocorrências | Recibo de Descarga | Histórico**.

- Salvar checklist com condições do veículo, lacre, limpeza, volumes previstos e recebidos, divergências, observações, conferente e data/hora. Usar Sim, Não e Não se aplica quando adequado.
- Mostrar todos os fornecedores e vincular as divergências às NFs específicas pelo mesmo cadastro de ocorrências.
- Preservar recebimento parcial e definitivo pelo procedimento existente; solicitar confirmação adequada quando houver divergências, sem bloquear toda ocorrência automaticamente.
- Preencher recibo com dados da carga, motorista, placas e totais; permitir ajustes operacionais e tarifa própria por documento.
- Calcular toneladas = kg ÷ 1.000 e descarga = toneladas × tarifa, com arredondamento monetário. Teste concreto: 8.500 kg × R$ 35/t = **R$ 297,50**.
- Gerar, visualizar e imprimir PDFs A4 com dados oficiais da empresa e espaços para assinatura. Checklist pode ter páginas adicionais.
- Guardar checklist e versões emitidas dos recibos com responsável e histórico, sem criar cobrança financeira automaticamente.

## Etapa 4 — Exclusão, cancelamento e arquivamento
- Incluir ações com número da carga, quantidade de notas, situação e consequências antes da confirmação.
- Excluir somente cargas sem movimentação nem vínculos operacionais relevantes; tratar notas exclusivas de forma segura, sem cascatas indiscriminadas.
- Para cargas com recebimento, entrega, ocorrência, comprovante ou documento, impedir exclusão destrutiva e oferecer cancelamento/arquivamento com justificativa e histórico.
- Aplicar a verificação no banco em uma operação transacional, não apenas esconder o botão. Oferecer filtros de ativas, canceladas e arquivadas.

## Etapa 5 — Portal do Motorista
- Criar perfil motorista com vínculo individual ao cadastro existente. Permissões no banco e no servidor limitam acesso às suas cargas, NFs atribuídas e comprovantes, sem financeiro ou administração.
- Criar tela própria para celular com nome, entregas pendentes, fotos pendentes de envio, comprovantes em análise e entregas concluídas.
- Capturar foto pela câmera ou arquivo, mostrar prévia e permitir fotografar consecutivamente sem digitar previamente a NF.
- Preparar instalação PWA e fila persistente local de fotos, isolada por conta, com identificador único, sincronização manual e automática enquanto aberto, aviso de armazenamento e remoção local somente após confirmação do servidor.
- Armazenar imagens privadamente, validar arquivos e evitar duplicidade no envio.
- Reconhecer chave, número, série e partes identificáveis por OCR/IA; cruzar somente com notas atribuídas ao motorista. Priorizar chave e combinações fiscais, encaminhando resultados duvidosos ou não identificados para conferência.
- Integrar **Comprovantes Pendentes** à tela de Entregas: foto, motorista, carga, identificação, correção da associação, aprovação e rejeição com motivo obrigatório.
- Aprovação autorizada atualiza o registro de entrega correspondente sem duplicá-lo, com histórico e datas de entrega e aprovação distintas. IA e motorista não podem aprovar.

## Detalhes técnicos
- Reutilizar o cliente e as permissões existentes; novas tabelas terão concessões explícitas e acesso restrito. Não duplicar notas, ocorrências ou entregas em cadastros paralelos.
- Usar procedimentos transacionais de banco para integridade e ações críticas; funções autenticadas do aplicativo para processamento e serviços externos.
- Armazenamento privado para comprovantes e documentos; leitura por acesso temporário autorizado. Reutilizar identidade oficial da empresa em um ponto central.
- Fila offline em IndexedDB; cache PWA somente do necessário, sem compartilhar dados privados entre contas. Validar limites reais de Android/iPhone, sem depender de sincronização em segundo plano.
- OCR/IA por Lovable AI no servidor, sem chaves no navegador. Informar custos antes de ativar o processamento: consumo de IA e armazenamento conforme uso; não há valor fixo confirmado nesta análise.

## Testes e publicação
- Criar testes das regras de duplicidade, agrupamento, totais, cálculo de descarga, exclusão com vínculos, isolamento do motorista, aprovação autorizada e motivo de rejeição.
- Testar na interface importação de três XMLs, lote misto, expansão, ocorrência específica e resolvida, propagação entre módulos, checklist salvo, PDFs e exclusão/cancelamento.
- Testar captura, reabertura offline, retorno da conexão, envio idempotente, reconhecimento e revisão pelo escritório. Simulação no navegador não substitui validação em Android/iPhone reais.
- Usar dados de teste identificáveis e não alterar dados reais para simular situações. Não declarar testes ausentes como executados.
- Ao final de cada etapa, informar resultado, preservação, mudanças, testes, dependências e custos. A publicação será tratada separadamente; não afirmar que o link público foi atualizado sem confirmação.

**Primeira entrega após aprovação:** Etapa 1, seguida de validação antes de avançar para as demais.
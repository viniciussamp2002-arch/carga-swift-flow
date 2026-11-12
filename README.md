# CrossDock Flow

SISTEMA DE GESTÃO DE TRANSPORTADORA CROSS-DOCKING

Desenvolva um sistema web completo para gestão de uma transportadora de cargas que opera no modelo Cross-Docking.

O sistema deve possuir interface moderna, rápida, intuitiva e responsiva, com foco em produtividade operacional.

OBJETIVO DO SISTEMA

Controlar toda a operação da transportadora, desde a entrada das notas fiscais até a entrega final ao cliente.

O sistema deve permitir:

Importação de notas fiscais por XML.

Cadastro manual de notas.

Formação de cargas (carradas).

Controle de veículos.

Controle de motoristas.

Controle de entregas.

Controle de devoluções.

Rastreamento interno das notas.

Gestão operacional completa.

DASHBOARD INICIAL

Ao entrar no sistema, exibir:

Indicadores

Total de notas disponíveis para carregamento.

Total de notas em rota.

Total de notas entregues hoje.

Total de notas pendentes.

Total de notas devolvidas.

Quantidade de veículos disponíveis.

Quantidade de veículos em rota.

Quantidade de veículos em manutenção.

Quantidade de cargas em separação.

Quantidade de cargas em carregamento.

Quantidade de cargas em rota.

Gráficos

Entregas por cidade.

Entregas por fornecedor.

Entregas por período.

Peso transportado por período.

MÓDULO DE NOTAS FISCAIS

Importação XML

Permitir importar XML de NF-e.

Ao importar:

Extrair automaticamente:

Número da nota

Série

Chave da NF-e

Data de emissão

Cliente destinatário

Cidade

Estado

Peso

Quantidade de volumes

Valor da nota

Fornecedor/Emissor

CNPJ emissor

CNPJ destinatário

Regra importante

Não permitir importar a mesma nota mais de uma vez.

A validação deve ocorrer pela chave da NF-e.

Se a nota já existir:

"Esta nota já foi importada anteriormente."

Cadastro Manual

Caso não exista XML.

Campos:

Número da nota

Cliente

Cidade

Região

Peso

Quantidade de volumes

Fornecedor

Agendamento (Sim ou Não)

Observações

Status da Nota

Cada nota deve possuir um status:

Disponível para carregamento

Separação

Carregamento

Em rota

Entregue

Entrega não realizada

Devolvida

Tela de Notas

Exibir tabela com:

Número NF

Fornecedor

Cliente

Cidade

Região

Peso

Volumes

Agendamento

Status

Filtros:

Cidade

Fornecedor

Região

Status

Cliente

Data

Ordenação:

Cidade (alfabética)

Fornecedor

Peso

Data

Busca rápida.

FORMAÇÃO DE CARGAS

Esta é a principal funcionalidade do sistema.

O operador deverá:

Abrir a tela de notas.

Filtrar por cidade ou região.

Selecionar várias notas.

À medida que as notas forem selecionadas:

Exibir painel lateral dinâmico mostrando:

Quantidade de notas selecionadas

Peso total

Quantidade total de volumes

Quantidade de clientes

Botão:

"GERAR CARGA"

Ao gerar carga

Solicitar:

Motorista

Veículo

Data prevista de saída

Observações

Criar automaticamente uma carga.

As notas selecionadas saem da lista de notas disponíveis.

Passam para status:

"Separação"

MÓDULO DE CARGAS

Cada carga deve possuir:

Número da carga

Data de criação

Motorista

Veículo

Peso total

Quantidade de notas

Quantidade de volumes

Status:

Separação

Carregamento

Em rota

Finalizada

Tela de Cargas

Exibir:

Número da carga

Motorista

Veículo

Peso

Status

Data

Ao abrir a carga:

Mostrar todas as notas vinculadas.

MÓDULO DE VEÍCULOS

Cadastro completo.

Campos:

Placa

Modelo

Marca

Tipo

Capacidade de peso

Ano

Situação

Situações:

Disponível

Em rota

Manutenção

Inativo

Importante:

Quando um veículo estiver vinculado a uma carga em rota, automaticamente seu status deve mudar para:

"EM ROTA"

Ele não pode aparecer como disponível.

MÓDULO DE MOTORISTAS

Cadastro completo.

Campos:

Nome

CPF

CNH

Categoria

Validade CNH

Telefone

Observações

Situações:

Disponível

Em viagem

Férias

Afastado

Ao vincular um motorista a uma carga:

Alterar automaticamente para:

"EM VIAGEM"

MÓDULO DE ENTREGAS

Quando a carga estiver em rota:

Exibir todas as notas da carga.

Para cada nota:

Botões:

Entregue

Não entregue

Devolvida

Ao marcar como entregue

Solicitar:

Data

Hora

Observação

Alterar status para:

"ENTREGUE"

Ao marcar como não entregue

Solicitar motivo:

Cliente ausente

Endereço incorreto

Recusa

Sem agendamento

Outros

A nota retorna para:

"Disponível para nova entrega"

Ao marcar como devolvida

Solicitar:

Motivo

Observação

Status:

"DEVOLVIDA"

CONSULTA RÁPIDA DE NOTAS

Criar uma pesquisa global.

Ao digitar:

Número da nota

Cliente

Cidade

O sistema deve informar imediatamente:

Status atual

Qual carga pertence

Qual veículo transporta

Qual motorista está responsável

BANCO DE DADOS

Utilizar banco de dados robusto para armazenar:

Notas fiscais

Motoristas

Veículos

Cargas

Entregas

Histórico de movimentações

Todas as alterações devem ficar registradas.

HISTÓRICO OPERACIONAL

Cada movimentação deve gerar log:

Exemplo:

03/06/2026 08:15

Nota 123456

Movida para carga 00015

Motorista João Silva

Veículo ABC-1234

PERMISSÕES

Criar níveis de acesso:

Administrador
Operacional
Consulta

Cada perfil visualiza apenas o que for permitido.

TECNOLOGIA

Desenvolver sistema moderno, escalável e preparado para milhares de notas fiscais, múltiplos usuários simultâneos e crescimento futuro da transportadora.

Priorizar velocidade na formação de cargas e facilidade operacional.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://carga-swift-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/16fad9b6-6b6b-47c0-85e9-8fb8468d6edc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

- Notes with `recebida=false` belong to an inbound load (`cargas_entrada`) and are hidden from the depot; only the `confirmar_chegada` RPC flips them, so receipt is idempotent.
- Scheduling links (`agendamentos`, unique per nota) are created by a DB trigger matching `cnpj_destinatario` against `clientes_agendamento`; never insert them from the client.
- Ocorrências live in one `ocorrencias` table (origem recebimento|entrega) linked by nota_id; every module shows them via `OcorrenciaBadge` from src/components/Ocorrencias.tsx — never copy them per module. Grouping by client in Cargas de Entrada is UI-only.
- All XML entry points use the shared import validator and persist one row per fiscal note; import-group IDs and recipient/load keys organize presentation without merging fiscal records, while the database trigger protects current and legacy access keys under concurrent writes.

- Occurrence identity, resolution timestamps and append-only audit events are recorded by database triggers; browser updates cannot omit or spoof operational history.
- Parent content routes render Outlet for nested detail paths so child screens remain reachable.
- Receiving checklists and issued documents use restricted, append-only version snapshots; database triggers assign authors and serialize versions, while PDFs are generated lazily in the browser from saved snapshots without creating finance entries.
- Load lifecycle is independent of transport status; deletion is a retained tombstone, and database triggers serialize relationship writes against load locks to prevent operational history from being erased or newly attached to excluded loads.
- Archiving or cancelling an already received inbound load preserves downstream depot operations; lock its inbound link and receipt identity without freezing unrelated delivery fields.

- Driver receipt photos queue in IndexedDB per account and are removed locally only after the server row exists; only office RPCs (aprovar/rejeitar_comprovante) finalize proofs and create deliveries, so AI and drivers can never approve.

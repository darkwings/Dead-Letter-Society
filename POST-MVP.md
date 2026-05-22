# POST-MVP — Feature rinviate

Feature escluse dal MVP, da pianificare in iterazioni successive.

---

## Object Store per payload messaggi

**Contesto:** Attualmente i messaggi DLQ vengono copiati integralmente nel DB relazionale.

**Feature futura:** Spostare il payload raw (e decoded) su object store (S3-compatible: MinIO, AWS S3, GCS). Il DB mantiene solo la chiave/riferimento al payload + tutti i metadati (offset, topic, partition, headers, timestamp, status, note, replay history).

**Benefici:** Riduzione storage DB, payload illimitato, lifecycle policy native sull'object store.

**Impatto:** Richiede refactor del port `MessageRepository` e introduzione di un port `PayloadStore`. Nessun impatto sul domain model (il messaggio ha già un'identità separata dal payload).

---

## Schema Registry aggiuntivi

**MVP:** Solo Confluent Schema Registry.

**Feature future:**
- Apicurio Schema Registry (adapter separato, stesso port `SchemaRegistryClient`)
- AWS Glue Schema Registry (idem)

**Formati supportati fin dal MVP:** Avro, Protobuf, JSON Schema (tutti e tre per Confluent).

---

## Pulsante "Fetch Now" dinamico

**MVP:** Se uno Scheduled Fetch è in corso, "Fetch Now" ritorna errore toast. L'utente riprova manualmente.

**Feature future:**
- Il pulsante "Fetch Now" si disabilita automaticamente mentre lo Scheduled Fetch è in esecuzione (stato via SSE)
- Si riattiva automaticamente via SSE al completamento del fetch schedulato

---

## Errori inline nell'editor payload (Replay Wizard)

**MVP:** Pulsante "Conferma" disabilitato + messaggio testuale con il campo schema violato.

**Feature future:**
- Errori inline nell'editor JSON (highlight riga/campo con errore direttamente nell'editor)
- Suggerimenti di correzione inline

---

## Full-text search sui payload

**MVP:** Filtri per stato, timestamp, partition, offset range.

**Feature future:**
- Full-text search sul payload decodificato (PostgreSQL `tsvector` / `GIN` index)
- Ricerca per valore di header Kafka
- Ricerca per chiave messaggio

---

## Helm Chart (deployment Kubernetes)

**MVP:** Solo Docker Compose production-ready.

**Feature future:**
- Helm chart per deployment su Kubernetes
- Values configurabili per OIDC, DB, Kafka connections
- HPA (Horizontal Pod Autoscaler) per il backend

---

## Notifiche email

**MVP:** Solo notifiche in-app via SSE (Server-Sent Events).

**Feature future:**
- Notifica email agli utenti con accesso alla DLQ config al momento dell'arrivo di nuovi messaggi
- Configurabile per utente (opt-in/opt-out)
- Template email personalizzabile

---

## Team / Gruppi utenti

**MVP:** Nessun concetto di team. Permessi assegnati direttamente per-utente × per-DLQ-config.

**Feature future:**
- Entità `Team` come gruppo organizzativo
- Bulk assignment: assegna team a DLQ config → tutti i membri ottengono accesso
- Utile per contesti enterprise con decine di utenti

---

## Integrazione ticket esterni

**MVP:** Riferimento manuale a ticket esterno (campo libero tipo "JIRA-1234" nel thread note).

**Feature future:**
- Integrazione Jira (create/link issue)
- Integrazione ServiceNow
- Integrazione Linear

---

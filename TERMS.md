# TERMS.md — Glossario Dead Letter Society

Terminologia canonica del progetto. Tutti i documenti, il codice, i test e le comunicazioni DEVONO usare questi termini senza drift.

---

## A

**All Messages**
Vista cross-DLQ che mostra tutti i `DlqMessage` accessibili all'utente corrente, indipendentemente dalla DLQ Config di appartenenza. Supporta filtro per status. Accessibile da tutti gli utenti autenticati. Navigabile dal link globale "All Messages" nella sidebar.

**ADMIN**
Ruolo globale. Utente con pieno accesso all'applicazione: gestisce cluster, DLQ config, utenti. Ha accesso implicito in lettura e replay a tutte le DLQ config. Possono esistere più ADMIN. Il primo utente registrato in modalità standalone diventa automaticamente ADMIN.

**Audit Record** → vedi *Replay Audit Record*

---

## B

**Badge Count**
Indicatore numerico visualizzato nella Sidebar accanto al nome di ogni DLQ Config. Mostra il numero di messaggi con status `NEW` nella DLQ Config. Assente (zero o muted dot) se non ci sono messaggi NEW.

**Batch Size**
Numero massimo di messaggi scaricati da Kafka in un singolo Fetch. Configurabile per DLQ Config. Default: 500.

**Bootstrap Servers**
Lista di broker Kafka nel formato `host:port,...` usata per la connessione al cluster.

---

## C

**Cluster** → vedi *Kafka Cluster*

**Committed Offset**
L'ultimo offset consumato con successo e persistito nel DB dell'applicazione per una specifica coppia (DLQ Config × Partizione). Non viene committato sul broker Kafka.

**Confluent Schema Registry**
Implementazione di Schema Registry supportata nel MVP. Espone API REST per registrazione e recupero degli schema (Avro, Protobuf, JSON Schema).

**Cron Expression**
Stringa in formato cron (es. `0 */15 * * * ?`) che definisce la frequenza del Fetch schedulato. Configurabile per DLQ Config con preset predefiniti come shortcut.

---

## D

**Dashboard**
Schermata home per gli utenti ADMIN. Mostra Summary Cards (conteggi per status), DLQ Status Table (stato per DLQ Config) e Replay Rate Sparkline (grafico replay rate ultimi 7 giorni). Accessibile esclusivamente agli ADMIN; gli altri utenti vengono reindirizzati alla lista cluster.

**Dead Letter Queue (DLQ)**
Topic Kafka su cui i messaggi vengono instradati automaticamente quando il consumer non riesce a processarli. I messaggi in DLQ sono candidati all'ispezione e all'eventuale Replay.

**Decoded Payload**
La rappresentazione leggibile del payload di un messaggio, ottenuta decodificando i byte raw tramite lo Schema Registry. Formato: JSON. Può essere `null` se lo schema non è disponibile o il payload è malformato.

**DLQ Config (Dead Letter Queue Configuration)**
Configurazione che rappresenta il contratto di monitoraggio tra l'applicazione e un topic DLQ su un Kafka Cluster. Contiene: topic name, fetch config, retention policy, assegnazioni utenti, partition offsets. È l'unità di accesso su cui vengono assegnati i ruoli VIEWER/OPERATOR.

**DLQ Message** → vedi *Message*

**DLQ Role** → vedi *Role*

**Download** → vedi *Fetch*

**Download Mode** → vedi *Fetch Mode*

---

## E

**Encryption Key**
Chiave AES-256 usata per cifrare le credenziali sensibili (es. password Kafka, certificati) nel DB. Letta da una variabile d'ambiente al runtime dell'applicazione.

---

## F

**Fetch**
Operazione di download dei messaggi da un topic DLQ Kafka verso il DB dell'applicazione. Può essere Scheduled Fetch o On-Demand Fetch. Ogni Fetch parte dal Committed Offset + 1 della partizione interessata.

**Fetch Config**
Parte della DLQ Config che definisce le modalità di fetch: Fetch Mode, Cron Expression (se schedulato), Batch Size.

**Fetch Mode**
Modalità di esecuzione del Fetch per una DLQ Config. Valori:
- `SCHEDULED` — solo fetch automatico a intervalli cron
- `ON_DEMAND` — solo fetch manuale avviato da un utente
- `BOTH` — entrambi coesistono

---

## G

**Gap (di offset)**
Situazione in cui messaggi tra il Committed Offset e l'earliest offset disponibile su Kafka sono stati eliminati (per compattazione o retention Kafka). Il sistema logga il gap e riparte dall'earliest disponibile.

**Global Role** → vedi *Role*

---

## H

**Headers**
Metadati chiave-valore associati a un messaggio Kafka. Includono informazioni tecniche come `x-original-topic`, `x-exception-message`, ecc. Preservati integralmente durante il Replay; aggiunto `x-dls-replayed-at` e `x-dls-replayed-by`.

---

## I

**Ingestion** → vedi *Fetch*

---

## K

**Kafka Cluster**
Insieme di broker Kafka identificato da Bootstrap Servers, configurazione di sicurezza e Schema Registry. Unità di registrazione nell'applicazione. A ogni Kafka Cluster è associato un solo Schema Registry.

**Kafka Security Config**
Configurazione di autenticazione e crittografia per la connessione a un Kafka Cluster. Protocolli supportati: `PLAINTEXT`, `SASL_PLAIN`, `SASL_SCRAM_SHA_256`, `SASL_SCRAM_SHA_512`, `SSL`.

---

## M

**Message**
Un messaggio Kafka scaricato da una DLQ e persistito nel DB dell'applicazione. Contiene: partition, offset, timestamp, message key, raw payload, decoded payload, headers, status, note thread, replay audit record.

**Message Key**
La chiave opzionale di un messaggio Kafka (bytes). Memorizzata nel DB per riferimento.

**Message Status**
Stato del ciclo di vita di un Message nel sistema. Valori e transizioni:
```
NEW → UNDER_REVIEW → REPLAYED
                   ↘ DISCARDED
                   ↘ REPLAY_FAILED ⟳ retry → UNDER_REVIEW
```

---

## N

**Note**
Singolo commento testuale aggiunto da un utente a un Message. Può contenere un Ticket Reference opzionale. Le note sono immutabili dopo la creazione.

**Note Thread**
Sequenza ordinata di Note associate a un Message. Equivalente a un thread di commenti.

---

## O

**OIDC (OpenID Connect)**
Protocollo di autenticazione federata. In modalità OIDC, l'identità dell'utente è gestita da un Identity Provider esterno (Keycloak, Okta, ecc.). Il ruolo ADMIN può essere mappato da un claim nel JWT. I ruoli DLQ (VIEWER/OPERATOR) sono sempre gestiti dall'applicazione.

**On-Demand Fetch**
Fetch avviato manualmente da qualsiasi utente con accesso alla DLQ Config. Viene rifiutato se uno Scheduled Fetch è in esecuzione sulla stessa DLQ Config.

**OPERATOR**
DLQ Role. Può: leggere messaggi, aggiungere note, eseguire Replay, modificare il Decoded Payload prima del Replay (con validazione schema), fare override del Replay Topic. Assegnato per-utente su una specifica DLQ Config.

---

## P

**Partition**
Suddivisione di un topic Kafka. Ogni partizione ha il proprio Committed Offset nel DB dell'applicazione.

**Partition Offset**
Record nel DB che traccia il Committed Offset per una coppia (DLQ Config × Partizione). Stato: `ACTIVE` o `INACTIVE`.

**Partition Reconciliation**
Operazione eseguita all'inizio di ogni Fetch che confronta le partizioni note nel DB con quelle effettive sul broker Kafka. Nuove partizioni vengono aggiunte con offset `-1` (earliest). Partizioni rimosse vengono marcate `INACTIVE`.

**Payload** → vedi *Raw Payload* o *Decoded Payload*

---

## R

**Bulk Replay**
Operazione di Replay semplificata applicata a più messaggi selezionati contemporaneamente nella Message List. Il target è il Default Replay Topic della DLQ Config. Non include editing payload né wizard multi-step. Produce un Replay Audit Record per ogni messaggio. Solo OPERATOR e ADMIN.

**Raw Payload**
I byte originali del payload di un messaggio Kafka, conservati nel DB senza modifiche.

**Replay**
Operazione di ripubblicazione di un Message sul Replay Topic. Eseguita tramite il Replay Wizard. Solo OPERATOR (e ADMIN implicito). Il payload può essere modificato (con validazione schema) prima della conferma.

**Replay Audit Record**
Record immutabile che documenta l'esecuzione di un Replay: chi ha eseguito il replay, quando, su quale topic, se il payload è stato modificato, numero di tentativi, eventuale motivo di fallimento.

**Replay Failed**
Stato di un Message in cui il Replay è stato tentato ma la pubblicazione su Kafka è fallita. L'utente può ritentare il Replay (transizione → `UNDER_REVIEW`).

**Replay Topic**
Il topic Kafka su cui viene ripubblicato un Message durante il Replay. Determinato in ordine di priorità:
1. Override esplicito impostato da OPERATOR nella DLQ Config o durante il wizard
2. Valore dell'header `x-original-topic` (o equivalente) nel messaggio

**Replay Rate**
Metrica che esprime la percentuale di messaggi Replayed rispetto al totale dei messaggi in un dato periodo. Formula: `REPLAYED / (REPLAYED + DISCARDED + UNDER_REVIEW + REPLAY_FAILED + NEW)`. Visualizzata nel Dashboard come Sparkline Chart.

**Replay Wizard**
Interfaccia multi-step guidata per l'esecuzione del Replay di un singolo messaggio. Include: anteprima messaggio, selezione/conferma Replay Topic, editing opzionale del Decoded Payload, validazione schema, conferma finale. Per replay di massa usa → *Bulk Replay*.

**Retention Policy**
Politica di pulizia automatica dei messaggi nel DB. Configurabile per DLQ Config. Può essere basata su: numero di giorni (`maxAgeDays`) o numero massimo di messaggi (`maxCount`).

**Role**
Determinano i permessi nell'applicazione. Due livelli:
- **Global Role** (`ADMIN` / `USER`): definisce i permessi globali sull'applicazione
- **DLQ Role** (`VIEWER` / `OPERATOR`): definisce i permessi su una specifica DLQ Config

---

## S

**Settings**
Area dell'applicazione raggiungibile tramite `/settings`. Contiene: link alla gestione cluster, link alla gestione utenti (Members & Roles), toggle light/dark mode. Navigazione a sinistra con sezioni "Clusters" e "Members & Roles".

**Sidebar Badge** → vedi *Badge Count*

**Sparkline Chart**
Grafico ad area miniaturizzato nel Dashboard che visualizza la Replay Rate giornaliera degli ultimi 7 giorni. Backend: `GET /api/dashboard/sparkline?days=7`.

**Summary Cards**
Cinque card nel Dashboard che mostrano il conteggio totale dei messaggi per ciascuno status (NEW, UNDER_REVIEW, REPLAYED, DISCARDED, REPLAY_FAILED) su tutte le DLQ Config accessibili.

**Schema**
Definizione strutturata del formato di un payload. Registrata nel Schema Registry. Formati supportati: Avro, Protobuf, JSON Schema.

**Schema Registry**
Servizio esterno che gestisce gli schema dei messaggi Kafka. Utilizzato per Decode e validazione dei payload. Nel MVP: Confluent Schema Registry (uno per Kafka Cluster).

**Schema Validation**
Verifica che un payload (raw o modificato) sia conforme allo schema registrato nel Schema Registry. Eseguita prima della conferma nel Replay Wizard quando il payload è stato modificato.

**Scheduled Fetch**
Fetch eseguito automaticamente dal sistema secondo una Cron Expression configurata nella DLQ Config.

**SSE (Server-Sent Events)**
Meccanismo di notifica push server→client usato per le notifiche in-app. Il frontend si sottoscrive a un endpoint SSE per ricevere aggiornamenti in tempo reale (es. nuovo fetch completato, nuovi messaggi disponibili).

**Standalone Mode**
Modalità operativa dell'applicazione senza integrazione con un Identity Provider esterno. L'autenticazione usa username/password locali. Il primo utente registrato diventa ADMIN.

---

## T

**Ticket Reference**
Riferimento testuale opzionale a un ticket in un sistema esterno (es. `JIRA-1234`, `INC0012345`). Inserito manualmente dall'utente in una Nota.

**Topic**
Canale di messaggistica su un Kafka Cluster. Le DLQ sono topic Kafka dedicati ai messaggi falliti.

**Topic Browser**
Funzionalità che, data una configurazione di un Kafka Cluster, interroga il broker in tempo reale e restituisce la lista dei topic disponibili. Il Topic Browser esclude i topic interni del broker (quelli il cui nome inizia con `_`) e i topic già configurati come DLQ Config sullo stesso cluster. Usato per assistere l'ADMIN nella selezione del Topic Name durante la creazione di una DLQ Config.

**Topic Name**
Il nome esatto di un topic Kafka configurato come DLQ in una DLQ Config. Immutabile dopo la creazione della DLQ Config. Il Topic Browser suggerisce nomi validi durante la creazione.

**Problem Detail**
Formato standard di risposta per gli errori HTTP, definito da RFC 7807 (`application/problem+json`). Ogni risposta di errore dell'API include almeno: `type` (URI), `title`, `status`, `detail`. Le risposte con errori di validazione (HTTP 422) aggiungono un array `violations` con le violazioni per campo: `[{ "field": "...", "message": "..." }]`.

---

## U

**User**
Utente registrato nell'applicazione. Ha un Global Role e può avere DLQ Role su una o più DLQ Config. Autenticato via modalità standalone (LOCAL) o via OIDC.

**User Assignment**
Associazione tra un User e una DLQ Config con uno specifico DLQ Role (VIEWER/OPERATOR).

---

## V

**VIEWER**
DLQ Role. Può: leggere messaggi, aggiungere note. Non può eseguire Replay. Assegnato per-utente su una specifica DLQ Config.

---

## X

**`x-dls-replayed-at`**
Header Kafka aggiunto dal sistema durante il Replay. Valore: timestamp ISO-8601 dell'operazione di replay.

**`x-dls-replayed-by`**
Header Kafka aggiunto dal sistema durante il Replay. Valore: user ID o email dell'utente che ha eseguito il replay.

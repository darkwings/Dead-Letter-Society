## START PROMPT

/the-analyzer voglio un'applicazione web, la chiameremo "Dead Letter Society", che mi permetta di tenere sotto controllo le Dead Letter Queue di un cluster Kafka. Deve essere possibile accedere ai messaggi pubblicati in DLQ, con supporto dello schema registry, deve essere possibile l'esame dei messaggi, l'associazione di note per eventuale richiesta di supporto e apertura ticket e la eventuale reimmissione di messaggi sul topic originale.
L'applicazione deve supportare più cluster Kafka e deve essere possibile creare configurazioni diverse di accesso DLQ per ogni cluster. Deve essere possibile per un utente amministratore creare team di utenti e assegnare ad ogni team l'accesso ad una DLQ con differenti ruoli: all'interno di un team alcuni utenti possono solo leggere i messaggi, altri potranno anche ripubblicare.
Deve essere possibile e semplice un utilizzo standalone a titolo personale ma deve essere possibile integrare l'applicazione in un contesto enterprise, quindi con un IDP (Keycloak, Okta, etc) che gestisce l'autenticazione.
Per l'interazione con Kafka, non voglio consumer sempre attivi, piuttosto un download schedulato dei messaggi oppure on-demand richiesto da un utente del team. La scelta fra schedulazione e on-demand deve essere di pertinenza dell'amministratore quando configura la DLQ per il team. Possono essere possibile entrambe le opzioni, ma occorre gestire chiaramente l'offset.
Voglio due applicazioni separate:
1. frontend app: non ho preferenze, scegli tu la tecnologia più adeguata
2. per il backend preferisco Java, Quarkus 3.33.1 e Gradle 9 (almeno). Localmente ho l'ultima versione di Orbstack per cui utilizza la versione più recente di testcontainers. Architettura esagonale, DDD.

Ogni feature deve avere il suo unit test / integration test ove possibile.

La UI deve essere moderna e accattivante.

Deve essere possibile lo sviluppo locale. Per questo sfruttiamo i dev services di Quarkus.

A valle dell'intervista, prepara un piano e presentamelo.

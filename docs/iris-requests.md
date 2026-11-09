# Ingest: valore stimato

Questo file descrive solo i campi del valore stimato su `POST /api/crm/ingest`.
Il contratto delle richieste di ricerca e del webhook sta sulla PR 22 e non fa parte di questo branch.

La risposta resta `{ inserted, duplicates, ids }`.

## Campi opzionali, solo in creazione

| Campo | Tipo | Regola |
| --- | --- | --- |
| `estimatedValue` | intero, euro | da 0 a 100000. Si salva in `crm_contacts.estimated_value_cents` (euro × 100). |
| `estimatedValueNote` | stringa | facoltativa, al massimo 200 caratteri, in `crm_contacts.estimated_value_note`. |

Valgono solo quando il contatto viene creato. Un duplicato (stessa email, telefono o dominio) non viene aggiornato: il valore già presente resta com'è.

Un valore fuori intervallo, o una nota troppo lunga, rifiuta l'intero payload con 400. Nessuna riga nuova.

Il campo è visibile a tutto il team CRM e si può correggere a mano nel pannello Dettagli. Non crea un'opportunità. Sulla card, se esiste una trattativa aperta con un importo, si mostra quello. Altrimenti si mostra la stima con la scritta «stimato». Se manca, la card non mostra un importo.

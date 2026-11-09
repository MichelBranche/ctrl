# Richieste di ricerca a Iris

Contratto tra il CRM e la routine di Iris (Grok Bot). Nessun altro servizio: un POST in uscita e due URL che Iris richiama con il token già usato per l'ingest.

## Variabili su Vercel

| Nome | Uso |
| --- | --- |
| `CRM_IRIS_WEBHOOK_URL` | URL della routine. Senza questo, o senza la chiave, la richiesta resta in errore e il credito del giorno torna disponibile. |
| `CRM_IRIS_WEBHOOK_KEY` | Segreto inviato nell'header. Non va nel JSON. |
| `CRM_IRIS_WEBHOOK_HEADER` | Nome dell'header. Default `Authorization`. Se il nome è `Authorization`, il valore è `Bearer <chiave>`. Altrimenti la chiave va nuda. |
| `CRM_INGEST_SECRET` | Già in uso. Iris lo manda come `Authorization: Bearer <segreto>` sia sull'ingest sia sul callback di stato. Minimo 16 caratteri. |

Il CRM non ritenta il POST. Timeout 8 secondi. Un HTTP non 2xx, un timeout o un redirect contano come errore.

## 1. Webhook in uscita

`POST CRM_IRIS_WEBHOOK_URL`

Header: quello configurato, più `content-type: application/json`.

```json
{
  "requestId": "8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f",
  "requestedBy": { "id": "user-id", "name": "Caleb" },
  "zone": "Alba, Cuneo",
  "sectors": ["cantine", "ristoranti"],
  "count": 30,
  "siteCriteria": ["assente", "datato", "lento", "non mobile"],
  "notes": "Solo attività con sala, oppure null",
  "createdAt": "2026-11-09T09:42:00.000Z",
  "statusUrl": "https://www.ctrlagency.dev/api/crm/iris-requests/8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f/status",
  "ingestUrl": "https://www.ctrlagency.dev/api/crm/ingest"
}
```

- `count` è tra 10 e 50. Default del form: 30.
- `siteCriteria` è un sottoinsieme di `assente`, `datato`, `lento`, `non mobile`. Può essere vuoto.
- `notes` è una stringa oppure `null`. Massimo 1000 caratteri.
- `requestedBy.name` è il nome del founder nel CRM.

Risposta attesa: qualsiasi 2xx. Il CRM non legge il body. A quel punto la richiesta è `queued`.

## 2. Stato

`POST` o `PATCH` su `statusUrl`.

`Authorization: Bearer <CRM_INGEST_SECRET>`

```json
{ "status": "working" }
```

```json
{ "status": "ready", "inserted": 12, "duplicates": 4 }
```

```json
{ "status": "error", "error_message": "motivo breve" }
```

Transizioni valide, solo in avanti:

- `queued` → `working` | `ready` | `error`
- `working` → `ready` | `error`

Ripetere lo stato attuale è un successo e non sposta la richiesta. `inserted` e `duplicates`, se presenti, aggiornano i conteggi. Un passaggio all'indietro (`working` → `queued`, oppure qualsiasi cosa dopo `ready` o `error`) risponde `409`.

Risposte: `200` `{ "ok": true, "id" }`, `401` token errato, `503` segreto non configurato, `404` id sconosciuto, `400` JSON non valido.

Se Iris segnala `error`, il founder può rifare la richiesta lo stesso giorno.

Una richiesta lasciata in `queued` o `working` per più di 3 ore risulta scaduta nel CRM (lo stato in tabella non cambia) e non blocca più una nuova richiesta. A 3 ore esatte è ancora attiva. Il testo nel CRM dice «attendi almeno 60 minuti»: è l'avviso per i founder, il blocco tecnico dura 3 ore.

## 3. Ingest dei lead

`POST ingestUrl`, lo stesso contratto di prima, con un campo opzionale in cima:

```json
{
  "irisRequestId": "8c1a0c2e-7b3d-4e1a-9f20-6d5b4a3c2e1f",
  "contacts": [
    { "business_name": "Cantina Esempio", "email": "info@esempio.it", "city": "Alba", "score": 80, "score_reasons": ["Sito datato"] }
  ]
}
```

Senza `irisRequestId` il comportamento resta quello attuale. La risposta resta `{ "inserted", "duplicates", "ids" }`. Se l'id non esiste, la risposta è `404` `{ "error": "richiesta Iris sconosciuta" }` e non viene inserito nessun contatto.

I contatti nuovi vengono collegati alla richiesta e in Radar portano il badge «da richiesta Iris». Un duplicato, anche archiviato, non viene aggiornato e non riceve il collegamento. Nessuna email parte da sola e non si apre un'opportunità.

Il filtro del Radar per quella richiesta è `https://www.ctrlagency.dev/admin/crm/radar?iris=<requestId>`.

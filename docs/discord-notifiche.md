# Notifiche Discord per il team

Ogni evento registrato nell'audit dell'admin viene anche inviato a un canale testuale Discord, con un webhook in uscita. Non c'è un bot e non c'è un servizio a pagamento.

Se la variabile manca o non è un URL di webhook Discord, l'invio non parte: nessuna riga, nessuna chiamata, nessun errore sull'azione che l'ha provocato. Michel la imposta su Vercel, ambiente Production.

## Variabile

| Nome | Uso |
| --- | --- |
| `DISCORD_WEBHOOK_URL` | URL del webhook del canale. Solo server. Va trattata come un segreto e non va mai scritta nei log. |

Forma attesa: `https://discord.com/api/webhooks/<id>/<token>` (vale anche `discordapp.com`).

## Cosa arriva nel canale

Un messaggio può raggruppare fino a 10 embed, uno per evento. Ogni embed ha:

- il tipo dell'evento
- il nome dell'attività o del contatto, oppure un titolo breve (oggetto della mail, fase, stato)
- chi l'ha generato (il nome dell'utente admin, oppure Sito, Iris, Radar, Sistema)
- il link assoluto all'elemento, sempre su `https://www.ctrlagency.dev/...`
- un colore per tipo e l'orario dell'evento

`allowed_mentions` è vuoto (`parse` vuoto): `@everyone`, `@here` e le menzioni utente non scattano. I caratteri markdown nei nomi sono escapati.

Non escono il corpo della mail, il telefono, l'email del contatto, i documenti e le note. Un indirizzo finito per sbaglio in un titolo viene tolto prima dell'invio.

## Dove si aggancia

L'unico punto di invio è la coda `discord_outbox`, riempita subito dopo l'insert in `audit_log`. Un `logAction` nuovo entra da solo.

Alcuni eventi non nascevano come riga di audit e ora passano dallo stesso punto:

- il form contatti del sito (`requests.received`), con nome e oggetto
- il cambio stato di una richiesta Iris (`crm.iris_status`: in lavorazione, pronta, errore)
- la posta in arrivo non ancora vista, e la risposta di un lead se il mittente è un contatto (la prima apertura di cassetta, a tabella vuota, prepara l'archivio e non notifica lo storico)
- follow-up e attività in scadenza nel giorno di Roma in cui scadono, una volta sola

La coda è la tabella additiva `discord_outbox` (`db/020_discord_outbox.sql`, dopo le migrazioni 018 e 019 del CRM). Il flush è opportunistico, dopo la risposta (`after`), e il cron giornaliero già presente riprova ciò che è rimasto. Un invio non blocca e non fa fallire l'azione. Timeout 4 secondi. Su HTTP 429 c'è un solo nuovo tentativo, dopo `retry_after` (al massimo 5 secondi). La riga viene segnata prima della chiamata: la stessa notifica non parte due volte. Dopo quattro tentativi falliti resta in coda ma non blocca le successive.

## Esempio

Richiesta dal sito, embed blu, senza dati di contatto oltre al nome e all'oggetto:

```json
{
  "allowed_mentions": { "parse": [] },
  "embeds": [
    {
      "title": "Richiesta dal sito",
      "description": "Cantina Rossi · Disponibilità per un nuovo sito",
      "url": "https://www.ctrlagency.dev/admin/requests",
      "color": 3447003,
      "timestamp": "2026-11-09T09:42:00.000Z",
      "fields": [{ "name": "Chi", "value": "Sito", "inline": true }]
    }
  ]
}
```

Nel canale si legge: **Richiesta dal sito**, Cantina Rossi · Disponibilità per un nuovo sito, Chi: Sito, con il link alla pagina Richieste.

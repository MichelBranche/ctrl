import type { Locale } from "@/lib/i18n";

/**
 * Privacy and cookie policies, written against what the site actually does:
 * contact form and newsletter stored in Turso, cookieless Vercel Web Analytics,
 * one technical admin cookie, covers on Vercel Blob, FAQ assistant that stores nothing.
 * Update this file whenever a new processor, cookie or data flow is added.
 */
export const LEGAL_UPDATED: Record<Locale, string> = { it: "31 ottobre 2026", en: "31 October 2026" };

export const privacy: Record<Locale, { title: string; lead: string; body: string }> = {
  it: {
    title: "Privacy policy",
    lead: "Quali dati raccoglie questo sito, perché, per quanto tempo e quali diritti hai. In breve: pochi dati, nessun cookie di profilazione, nessuna vendita a terzi.",
    body: `## Titolare del trattamento

CTRL® di Michel Branche, Valle d'Aosta, Italia. Contatto per ogni richiesta sulla privacy: [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com).

## Quali dati trattiamo e perché

**Modulo contatti.** Nome, email, argomento e testo del messaggio che scrivi, più la lingua della pagina e data e ora di invio. Li usiamo solo per risponderti e gestire la tua richiesta. Base giuridica: misure precontrattuali su tua richiesta e nostro legittimo interesse a rispondere (art. 6.1 b e f GDPR).

**Newsletter del Journal.** Email, lingua e data di iscrizione, più un codice casuale che serve a disiscriverti. Base giuridica: il tuo consenso (art. 6.1 a GDPR), che puoi revocare in qualsiasi momento.

**Protezione da abusi.** Per limitare invii automatici, calcoliamo un'impronta dell'indirizzo IP (hash con un sale che cambia ogni giorno) e contiamo i tentativi per un'ora. Non salviamo l'indirizzo IP in chiaro. Base giuridica: legittimo interesse alla sicurezza del sito (art. 6.1 f GDPR).

**Statistiche di visita.** Usiamo Vercel Web Analytics, che non usa cookie e non ti segue tra siti diversi. Raccoglie dati aggregati come pagina visitata, sito di provenienza, paese, tipo di dispositivo e browser; il visitatore è riconosciuto solo tramite un hash della richiesta che si azzera ogni giorno. Non vediamo dati che identificano te. Base giuridica: legittimo interesse a capire come viene usato il sito (art. 6.1 f GDPR).

**Log tecnici.** Come ogni hosting, Vercel registra per breve tempo dati tecnici delle richieste (ad esempio indirizzo IP, data, pagina richiesta) per far funzionare e proteggere il servizio.

**Assistente del sito.** Le domande scritte nell'assistente sono elaborate al momento per scegliere una risposta tra le FAQ e non vengono salvate.

Non usiamo i tuoi dati per profilazione o decisioni automatizzate e non li vendiamo.

## Chi tratta i dati per nostro conto

- **Vercel Inc.** (USA): hosting del sito, statistiche di visita, archivio delle immagini (Vercel Blob).
- **Turso / ChiselStrike Inc.** (USA): database che contiene richieste di contatto e iscritti alla newsletter.

Sono responsabili del trattamento nominati con accordi conformi all'art. 28 GDPR. Alcuni dati possono essere trasferiti fuori dall'Unione europea; il trasferimento avviene con le garanzie previste dal GDPR (EU-U.S. Data Privacy Framework, dove il fornitore aderisce, o clausole contrattuali standard della Commissione europea).

## Per quanto tempo

- Richieste di contatto: fino a 24 mesi dall'ultimo scambio, poi cancellate. Se diventano un incarico, i dati necessari seguono i tempi previsti dalla legge fiscale e civile.
- Newsletter: finché resti iscritto. Dopo la disiscrizione cancelliamo l'indirizzo entro 30 giorni.
- Impronte IP anti-abuso: al massimo 48 ore.
- Statistiche di visita: dati aggregati, conservati da Vercel secondo il piano in uso (circa un mese).

## I tuoi diritti

Puoi chiedere in qualsiasi momento accesso, rettifica, cancellazione, limitazione, portabilità dei tuoi dati e opporti al trattamento basato sul legittimo interesse (artt. 15-22 GDPR). Puoi revocare il consenso alla newsletter senza conseguenze. Scrivi a [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com): rispondiamo entro 30 giorni.

Hai anche il diritto di presentare reclamo al Garante per la protezione dei dati personali ([garanteprivacy.it](https://www.garanteprivacy.it)).

## Cookie

Il sito pubblico non usa cookie. L'unico cookie è tecnico e riguarda l'area riservata di amministrazione. Dettagli nella [cookie policy](/cookie).

## Modifiche

Se cambiamo il modo in cui trattiamo i dati aggiorniamo questa pagina e la data in fondo.`,
  },
  en: {
    title: "Privacy policy",
    lead: "What data this site collects, why, for how long, and what your rights are. In short: very little data, no profiling cookies, nothing sold to anyone.",
    body: `## Data controller

CTRL® by Michel Branche, Valle d'Aosta, Italy. Contact for any privacy request: [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com).

## What we process and why

**Contact form.** Your name, email, topic and message, plus the page language and the date and time you sent it. We use them only to reply and handle your request. Legal basis: steps taken at your request before a contract, and our legitimate interest in replying (Art. 6(1)(b) and (f) GDPR).

**Journal newsletter.** Your email, language and sign-up date, plus a random code used to unsubscribe you. Legal basis: your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.

**Abuse protection.** To limit automated submissions we compute a fingerprint of your IP address (a hash with a salt that changes every day) and count attempts for one hour. We never store the plain IP address. Legal basis: legitimate interest in keeping the site secure (Art. 6(1)(f) GDPR).

**Visit statistics.** We use Vercel Web Analytics, which sets no cookies and does not track you across sites. It collects aggregated data such as the page visited, referring site, country, device type and browser; a visitor is recognised only by a hash of the request that resets every day. We see nothing that identifies you. Legal basis: legitimate interest in understanding how the site is used (Art. 6(1)(f) GDPR).

**Technical logs.** Like any host, Vercel briefly logs technical request data (for example IP address, time, page requested) to run and protect the service.

**Site assistant.** Questions typed into the assistant are processed on the spot to pick an answer from our FAQ and are not stored.

We do not use your data for profiling or automated decisions, and we do not sell it.

## Who processes data for us

- **Vercel Inc.** (USA): site hosting, visit statistics, image storage (Vercel Blob).
- **Turso / ChiselStrike Inc.** (USA): database holding contact requests and newsletter subscribers.

They act as processors under agreements that meet Art. 28 GDPR. Some data may be transferred outside the European Union; such transfers rely on the safeguards the GDPR provides (the EU-U.S. Data Privacy Framework where the provider is certified, or the European Commission's standard contractual clauses).

## How long we keep it

- Contact requests: up to 24 months after the last exchange, then deleted. If a request becomes a project, the data needed is kept for the periods required by Italian tax and civil law.
- Newsletter: while you are subscribed. After you unsubscribe we delete the address within 30 days.
- Abuse-protection IP fingerprints: 48 hours at most.
- Visit statistics: aggregated data kept by Vercel according to the plan in use (about one month).

## Your rights

You can ask at any time for access, correction, deletion, restriction or portability of your data, and object to processing based on legitimate interest (Arts. 15-22 GDPR). You can withdraw newsletter consent with no consequences. Write to [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com): we reply within 30 days.

You also have the right to lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali ([garanteprivacy.it](https://www.garanteprivacy.it)), or with the authority where you live.

## Cookies

The public site uses no cookies. The only cookie is a technical one for the private admin area. Details in the [cookie policy](/en/cookies).

## Changes

If we change how we handle data we update this page and the date below.`,
  },
};

export const cookies: Record<Locale, { title: string; lead: string; body: string }> = {
  it: {
    title: "Cookie policy",
    lead: "Questo sito non usa cookie di profilazione, pubblicitari o di terze parti. Per questo non trovi nessun banner.",
    body: `## Cookie usati

| Nome | Tipo | Dove | Durata | Scopo |
| --- | --- | --- | --- | --- |
| ctrl_admin | Tecnico, strettamente necessario | Solo area riservata /admin | 12 ore | Mantiene l'accesso dell'amministratore. È httpOnly e non è leggibile da script. |

I visitatori del sito pubblico non ricevono alcun cookie. Anche nell'area riservata, il browser salva in memoria locale una sola preferenza di interfaccia (barra laterale compressa o aperta), che non viene inviata a nessuno.

## Statistiche senza cookie

Le statistiche di visita sono raccolte con Vercel Web Analytics, che funziona senza cookie e senza identificatori persistenti. Dettagli nella [privacy policy](/privacy).

## Perché non c'è il banner

Secondo le Linee guida del Garante sui cookie (10 giugno 2021), i cookie tecnici non richiedono consenso e gli strumenti di statistica senza cookie non lo richiedono quando i dati sono aggregati e non permettono di identificarti. Se in futuro aggiungeremo cookie non tecnici, chiederemo il tuo consenso prima di attivarli.

## Come gestire i cookie

Puoi cancellare o bloccare i cookie dalle impostazioni del browser. Bloccare ctrl_admin impedisce solo l'accesso all'area riservata.

## Contatti

Titolare: CTRL® di Michel Branche, [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com).`,
  },
  en: {
    title: "Cookie policy",
    lead: "This site uses no profiling, advertising or third-party cookies. That is why there is no banner.",
    body: `## Cookies used

| Name | Type | Where | Duration | Purpose |
| --- | --- | --- | --- | --- |
| ctrl_admin | Technical, strictly necessary | Private /admin area only | 12 hours | Keeps the administrator signed in. It is httpOnly and cannot be read by scripts. |

Visitors to the public site receive no cookies at all. In the private area the browser also keeps one interface preference in local storage (sidebar collapsed or open), which is never sent anywhere.

## Cookieless statistics

Visit statistics come from Vercel Web Analytics, which works without cookies or persistent identifiers. Details in the [privacy policy](/en/privacy).

## Why there is no banner

Under the Italian data protection authority's cookie guidelines (10 June 2021) and the ePrivacy rules, technical cookies need no consent, and cookieless analytics need none when the data is aggregated and cannot identify you. If we ever add non-technical cookies we will ask for your consent before turning them on.

## Managing cookies

You can delete or block cookies in your browser settings. Blocking ctrl_admin only prevents signing in to the private area.

## Contact

Controller: CTRL® by Michel Branche, [ctrlragency@gmail.com](mailto:ctrlragency@gmail.com).`,
  },
};

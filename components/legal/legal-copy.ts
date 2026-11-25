import { ADMIN_EMAIL } from "@/lib/content";
import { withGermanFallback } from "@/lib/i18n";

/**
 * Privacy and cookie policies, written against what the site actually does:
 * contact form and newsletter stored in Turso, cookieless Vercel Web Analytics,
 * one technical admin cookie, covers on Vercel Blob, FAQ assistant that stores nothing.
 * Update this file whenever a new processor, cookie or data flow is added.
 */
export const LEGAL_UPDATED = withGermanFallback({ it: "24 novembre 2026", en: "24 November 2026", de: "24. November 2026" });

export const privacy = withGermanFallback({
  it: {
    title: "Privacy policy",
    lead: "Quali dati raccoglie questo sito, perché, per quanto tempo e quali diritti hai. In breve: pochi dati, nessun cookie di profilazione, nessuna vendita a terzi.",
    body: `## Titolare del trattamento

CTRL® di Michel Branche, Valle d'Aosta, Italia. Contatto per ogni richiesta sulla privacy: [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).

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

Puoi chiedere in qualsiasi momento accesso, rettifica, cancellazione, limitazione, portabilità dei tuoi dati e opporti al trattamento basato sul legittimo interesse (artt. 15-22 GDPR). Puoi revocare il consenso alla newsletter senza conseguenze. Scrivi a [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}): rispondiamo entro 30 giorni.

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

CTRL® by Michel Branche, Valle d'Aosta, Italy. Contact for any privacy request: [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).

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

You can ask at any time for access, correction, deletion, restriction or portability of your data, and object to processing based on legitimate interest (Arts. 15-22 GDPR). You can withdraw newsletter consent with no consequences. Write to [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}): we reply within 30 days.

You also have the right to lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali ([garanteprivacy.it](https://www.garanteprivacy.it)), or with the authority where you live.

## Cookies

The public site uses no cookies. The only cookie is a technical one for the private admin area. Details in the [cookie policy](/en/cookies).

## Changes

If we change how we handle data we update this page and the date below.`,
  },
  de: {
    title: "Datenschutzerklärung",
    lead: "Welche Daten diese Website erhebt, warum und wie lange – und welche Rechte Sie haben. Kurz gesagt: wenige Daten, keine Tracking-Cookies und kein Verkauf an Dritte.",
    body: `## Verantwortlicher

CTRL® di Michel Branche, Aostatal, Italien. Für Datenschutzanfragen: [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).

## Welche Daten wir verarbeiten und warum

**Kontaktformular.** Name, E-Mail-Adresse, Thema und Nachricht sowie Seitensprache und Zeitpunkt der Anfrage. Wir nutzen diese Angaben ausschließlich zur Beantwortung und Bearbeitung Ihres Anliegens. Rechtsgrundlage sind vorvertragliche Maßnahmen auf Ihre Anfrage und unser berechtigtes Interesse an der Beantwortung (Art. 6 Abs. 1 lit. b und f DSGVO).

**Journal-Newsletter.** E-Mail-Adresse, Sprache und Anmeldedatum sowie ein zufälliger Abmeldecode. Rechtsgrundlage ist Ihre jederzeit widerrufbare Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).

**Missbrauchsschutz.** Um automatisierte Einsendungen zu begrenzen, erstellen wir einen täglich neu gesalzenen Hash Ihrer IP-Adresse und zählen Versuche eine Stunde lang. Die IP-Adresse speichern wir nicht im Klartext. Rechtsgrundlage ist unser berechtigtes Interesse an der Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO).

**Besuchsstatistik.** Vercel Web Analytics arbeitet ohne Cookies und ohne websiteübergreifendes Tracking. Erfasst werden aggregierte Angaben wie besuchte Seite, Herkunft, Land, Gerät und Browser. Ein Besucher wird nur über einen täglich zurückgesetzten Hash erkannt. Wir erhalten keine Daten, die Sie identifizieren. Rechtsgrundlage ist unser berechtigtes Interesse, die Nutzung der Website zu verstehen (Art. 6 Abs. 1 lit. f DSGVO).

**Technische Protokolle.** Vercel protokolliert vorübergehend technische Anfragedaten, etwa IP-Adresse, Zeitpunkt und angeforderte Seite, um den Dienst bereitzustellen und zu schützen.

**Website-Assistent.** Fragen an den Assistenten werden unmittelbar verarbeitet, um eine passende FAQ-Antwort auszuwählen, und nicht gespeichert.

Wir verwenden Ihre Daten nicht für Profiling oder automatisierte Entscheidungen und verkaufen sie nicht.

## Dienstleister

- **Vercel Inc.** (USA): Hosting, Besuchsstatistik und Bildspeicherung (Vercel Blob).
- **Turso / ChiselStrike Inc.** (USA): Datenbank für Kontaktanfragen und Newsletter-Abonnements.

Die Anbieter sind durch Vereinbarungen gemäß Art. 28 DSGVO als Auftragsverarbeiter eingebunden. Daten können außerhalb der EU verarbeitet werden; dafür gelten die vorgesehenen Garantien, etwa das EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist, oder Standardvertragsklauseln der Europäischen Kommission.

## Speicherdauer

- Kontaktanfragen: bis zu 24 Monate nach dem letzten Austausch. Bei einem Auftrag gelten für erforderliche Daten die gesetzlichen Aufbewahrungsfristen.
- Newsletter: bis zur Abmeldung; danach löschen wir die Adresse innerhalb von 30 Tagen.
- IP-Hashes zum Missbrauchsschutz: höchstens 48 Stunden.
- Besuchsstatistiken: aggregierte Daten gemäß dem verwendeten Vercel-Tarif (etwa einen Monat).

## Ihre Rechte

Sie können Auskunft, Berichtigung, Löschung, Einschränkung und Übertragbarkeit Ihrer Daten verlangen sowie der Verarbeitung aufgrund berechtigter Interessen widersprechen (Art. 15–22 DSGVO). Ihre Newsletter-Einwilligung können Sie jederzeit widerrufen. Schreiben Sie an [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}); wir antworten innerhalb von 30 Tagen. Sie können sich außerdem bei Ihrer zuständigen Datenschutzaufsichtsbehörde beschweren.

## Cookies

Die öffentliche Website verwendet keine Cookies. Ein technisches Cookie wird ausschließlich im privaten Administrationsbereich verwendet. Einzelheiten finden Sie in der [Cookie-Richtlinie](/de/cookies).

## Änderungen

Wenn sich unsere Datenverarbeitung ändert, aktualisieren wir diese Seite und das Datum unten.`,
  },
});

export const cookies = withGermanFallback({
  it: {
    title: "Cookie policy",
    lead: "Questo sito non usa cookie di profilazione, pubblicitari o di terze parti. Per questo non trovi nessun banner.",
    body: `## Cookie usati

| Nome | Tipo | Dove | Durata | Scopo |
| --- | --- | --- | --- | --- |
| ctrl_admin | Tecnico, strettamente necessario | Solo area riservata /admin | 12 ore, oppure 3 giorni se all'accesso si sceglie «Resta collegato» | Mantiene l'accesso dell'amministratore. È httpOnly e non è leggibile da script. La scadenza è assoluta: non si rinnova da sola. |

I visitatori del sito pubblico non ricevono alcun cookie. Anche nell'area riservata, il browser salva in memoria locale una sola preferenza di interfaccia (barra laterale compressa o aperta), che non viene inviata a nessuno.

## Statistiche senza cookie

Le statistiche di visita sono raccolte con Vercel Web Analytics, che funziona senza cookie e senza identificatori persistenti. Dettagli nella [privacy policy](/privacy).

## Perché non c'è il banner

Secondo le Linee guida del Garante sui cookie (10 giugno 2021), i cookie tecnici non richiedono consenso e gli strumenti di statistica senza cookie non lo richiedono quando i dati sono aggregati e non permettono di identificarti. Se in futuro aggiungeremo cookie non tecnici, chiederemo il tuo consenso prima di attivarli.

## Come gestire i cookie

Puoi cancellare o bloccare i cookie dalle impostazioni del browser. Bloccare ctrl_admin impedisce solo l'accesso all'area riservata.

## Contatti

Titolare: CTRL® di Michel Branche, [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).`,
  },
  en: {
    title: "Cookie policy",
    lead: "This site uses no profiling, advertising or third-party cookies. That is why there is no banner.",
    body: `## Cookies used

| Name | Type | Where | Duration | Purpose |
| --- | --- | --- | --- | --- |
| ctrl_admin | Technical, strictly necessary | Private /admin area only | 12 hours, or 3 days if “Stay signed in” is chosen at sign-in | Keeps the administrator signed in. It is httpOnly and cannot be read by scripts. The deadline is absolute and does not renew itself. |

Visitors to the public site receive no cookies at all. In the private area the browser also keeps one interface preference in local storage (sidebar collapsed or open), which is never sent anywhere.

## Cookieless statistics

Visit statistics come from Vercel Web Analytics, which works without cookies or persistent identifiers. Details in the [privacy policy](/en/privacy).

## Why there is no banner

Under the Italian data protection authority's cookie guidelines (10 June 2021) and the ePrivacy rules, technical cookies need no consent, and cookieless analytics need none when the data is aggregated and cannot identify you. If we ever add non-technical cookies we will ask for your consent before turning them on.

## Managing cookies

You can delete or block cookies in your browser settings. Blocking ctrl_admin only prevents signing in to the private area.

## Contact

Controller: CTRL® by Michel Branche, [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).`,
  },
  de: {
    title: "Cookie-Richtlinie",
    lead: "Diese Website verwendet keine Tracking-, Werbe- oder Drittanbieter-Cookies. Deshalb gibt es kein Cookie-Banner.",
    body: `## Verwendete Cookies

| Name | Typ | Bereich | Dauer | Zweck |
| --- | --- | --- | --- | --- |
| ctrl_admin | Technisch, unbedingt erforderlich | Nur privater Bereich /admin | 12 Stunden oder 3 Tage bei Auswahl von „Angemeldet bleiben“ | Hält die Administrationssitzung aufrecht. HttpOnly und nicht durch Skripte lesbar. Die Frist ist fest und wird nicht automatisch verlängert. |

Besucherinnen und Besucher der öffentlichen Website erhalten keine Cookies. Im privaten Bereich speichert der Browser zusätzlich eine Oberflächeneinstellung (eingeklappte oder geöffnete Seitenleiste) lokal; sie wird nicht übermittelt.

## Statistik ohne Cookies

Besuchsstatistiken werden mit Vercel Web Analytics ohne Cookies oder dauerhafte Kennungen erhoben. Einzelheiten stehen in der [Datenschutzerklärung](/de/privacy).

## Warum es kein Banner gibt

Technisch notwendige Cookies erfordern nach den geltenden Datenschutzregeln keine Einwilligung. Auch unsere cookielose Statistik verlangt keine Einwilligung, wenn die Daten aggregiert sind und keine Identifizierung ermöglichen. Sollten wir künftig nicht notwendige Cookies einsetzen, bitten wir vorher um Ihre Einwilligung.

## Cookies verwalten

Sie können Cookies in den Browsereinstellungen löschen oder blockieren. Das Blockieren von ctrl_admin verhindert nur den Zugang zum privaten Administrationsbereich.

## Kontakt

Verantwortlicher: CTRL® di Michel Branche, [${ADMIN_EMAIL}](mailto:${ADMIN_EMAIL}).`,
  },
});

# CTRL® design system

Il linguaggio visivo delle pagine nuove (home, /team, /ctrl-quotes). Ogni pagina rifatta parte da qui.

## Dove sta

| Cosa | File |
| --- | --- |
| Token (colori, spazi, raggi, ombre, tipo, livelli, motion) | `app/tokens.css` (importato da `app/globals.css`) |
| Navbar a pillola | `components/home/home-header.tsx` + `home-header.css` |
| Molle per le animazioni JS | `components/home/springs.ts` |
| Freccia CTA | `components/ds/arrow-up-right.tsx` |
| Superfici admin (telaio dashboard, card metrica, tabella, stato vuoto, barre) | `components/ds/metric-card.tsx`, `data-table.tsx`, `empty-state.tsx`, `metric-bars.tsx` + `admin-ui.css` (`.ds-page`, `.ds-head`, `.ds-card`, `.ds-*`) |
| Panoramica admin (v2: KPI a riquadri con variazione verde/rossa, imbuto delle fasi, attività colorate per tipo) | `components/ds/overview.css` (prefisso `.ov`, insieme a `.rb`); imbuto in `lib/command-funnel.ts` |
| Desk admin | `components/ds/desk.css` (prefisso `.dk`, v2 su `.rb`: barra della Rubrica con segmenti, ricerca e filtri, righe dense, barra di selezione) |
| Cornice CRM condivisa (tab, Le mie/Team, check fatto, tip, cifre che rullano) | `components/ds/crm.css` (prefisso `.cr`) |
| Rubrica CRM (v2: header compatto, fasi, lista densa) e primitive v2 condivise (`.rb-head`, `.rb-btn`, `.rb-cta`, `.rb-pop`, `.rb-stages`, `.rb-chip`, `.rb-cb`, `.rb-floatbar`) | `components/ds/rubrica.css` (prefisso `.rb`, insieme a `.cr`) |
| CRM Oggi (v2: striscia scadenze, lista follow-up con Fatto e Rimanda, KPI a riquadri) | `components/ds/oggi.css` (prefisso `.og`, insieme a `.cr .rb`) |
| Stato dei dati (fase, punteggio, scadenza, avatar per categoria) | `components/ds/status.tsx` + `status.css` (`.ds-stage`, `.ds-score`, `.ds-due`, `.ds-avatar`) |
| Cornice admin (sidebar, header, palette, drawer, campanella) | `components/ds/admin-shell.css` (classi `.adm-*` del telaio, token `--ds-*`) |
| Badge team | `components/team-badge.tsx` + `components/pages/team-badge.css` |
| Testi | `lib/i18n.ts` (o il file `*-copy.ts` della pagina), mai stringhe IT/EN nei componenti |

## Regole

1. **Solo token.** Nei CSS nuovi usa `var(--ds-*)`. Niente esadecimali, `999px`, `cubic-bezier(...)` o `z-index` numerici scritti a mano. Se manca un valore, aggiungilo a `tokens.css` con un commento d'uso.
2. **Scope per pagina.** Ogni pagina ha un prefisso (`.hv-` home, `.qx-` Quotes, `.tb-` badge, `.t-` team, `.eco` Ecosistema admin). I pezzi riusabili dell'admin usano `.ds-`. Gli alias locali (`--hv-accent: var(--ds-accent)`) sono ammessi, i valori nuovi no.
3. **Telaio.** Pagina `--ds-page`, card a tutta larghezza con margine laterale `--ds-frame` (10px) e spazio tra card `--ds-gap` (uguale al margine). Raggio card `--ds-r-card` (22px), padding interno `--ds-pad`.
4. **Colore.** Fondo scuro, card `--ds-card` o `--ds-paper`. Un solo accento per vista: arancione `--ds-accent`, per CTA, focus, selezione e tab attiva. Le palette prodotto (`--ds-q-*` per Quotes) vivono solo dentro le card di quel prodotto.
   **Colori di stato** (`--ds-stage-*`, `--ds-ok`, `--ds-warn`, `--ds-danger`, `--ds-info`, `--ds-tone-1..8`): solo sui dati, mai sulla cornice. Fasi pipeline sempre con lo stesso colore in ogni vista (Nuovo ardesia, Contattato blu, Call viola, Preventivo ambra, Vinto verde, Perso rosso); punteggio verde ≥70, ambra 40–69, ardesia sotto; scadenza rossa se passata, ambra se oggi. Tinte di sfondo al 14–20% su `--ds-card` con `color-mix`, testo nel colore pieno. Gli avatar prendono il tono dalla categoria (`toneOf`).
5. **Pulito.** Colori pieni. Niente gradienti decorativi, glow o ombre colorate. Le ombre sono quelle dei token (`--ds-shadow-*`).
6. **Tipo.** Titoli in Satoshi (`--ds-font-display`), testo in Geist (`--ds-font-body`). Scala: `--ds-text-h1`, `--ds-text-h2`, `--ds-text-h3`, `--ds-text-kicker`; tracking titoli `--ds-track-display`.
7. **Bottoni e pillole.** Raggio `--ds-r-pill`. CTA piena nell'accento con `ArrowUpRight` che si sposta di 2px in hover; secondaria a contorno. `:active` a `scale(0.97)`.
8. **Movimento.** CSS con `--ds-ease` e `--ds-dur*`; animazioni JS con le molle di `springs.ts`. Sempre un fallback `prefers-reduced-motion` e contenuto visibile senza JS.
9. **Livelli.** Header 60, progress 70, back-to-top 90, cursore 140, assistente 150, carrello 180, transizione 190, command menu 200 (`--ds-z-*`).
10. **Accessibilità.** Focus visibile (outline 2px accento), target touch di almeno 44px (`--ds-control` è 40px col mouse e 44px su touch), nome accessibile su ogni icona-link.
11. **Liste admin.** Una card per la lista con toolbar in testa (segmenti + vista, poi ricerca, Filtri in popover, ordinamento), filtri attivi come chip rimovibili, tabella densa (`--ds-row`) con colonne che spariscono in base alla larghezza della lista (container query), righe con ingresso sfalsato. Le animazioni d'ingresso dei contenitori usano `backwards`, non `both`: una transform trattenuta renderebbe il contenitore il riferimento dei figli `position: fixed`.
12. **Viste v2.** Una vista v2 mette sul `main` le classi `.rb` (primitive condivise) più il suo prefisso, e riusa `rb-head` con le tab, i riquadri a tessera (`rb-stages`: barra proporzionale + tessere con pallino colorato, numero grande e quota, cliccabili come filtro) e i popover `details.rb-pop` chiusi da `PopDismiss`. Scadenze: rosso in ritardo, ambra oggi, blu domani. Le azioni rapide usano solo le server action esistenti. I tooltip chiusi non occupano spazio (`display: none`), così non allargano la pagina sul telefono. Variazioni: verde se sale, rosso se scende, neutro se invariata. Priorità (Desk): non esiste una colonna, si ricava dalla scadenza (alta se scaduta o di oggi, rosso; media entro 3 giorni, ambra; bassa, neutra) e il badge lo dice nel tooltip. I segmenti `rb-segs` accettano link o pulsanti. I grafici condivisi (`components/admin/charts.tsx`) hanno riempimenti a gradiente: nelle viste v2 si sovrascrivono in CSS con una tinta piena del colore del dato.

## Per una pagina nuova

Copia il telaio della home (`hv-block` > `hv-card`), prendi i testi da `lib/i18n.ts`, usa solo token, verifica a 1440 e 390 px in IT ed EN.

## Admin, conversione

La cornice (sidebar, header, ricerca, menu account) è già sui token `--ds-*` tramite `components/ds/admin-shell.css`. Le viste interne convertite importano `components/ds/admin-ui.css` e i componenti `.ds-*`, e hanno un prefisso di pagina: `.eco` Ecosistema, `.ov` Panoramica (`overview.css`), `.dk` Desk (`desk.css`), `.cr` CRM (`crm.css`), `.rb` Rubrica (`rubrica.css`, il modello per le prossime viste), `.og` CRM Oggi (`oggi.css`). Le altre sezioni interne usano ancora gli stili `--adm-*` finché non vengono convertite.

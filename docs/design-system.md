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
| Panoramica admin | `components/ds/overview.css` (prefisso `.ov`) |
| Cornice admin (sidebar, header, palette, drawer, campanella) | `components/ds/admin-shell.css` (classi `.adm-*` del telaio, token `--ds-*`) |
| Badge team | `components/team-badge.tsx` + `components/pages/team-badge.css` |
| Testi | `lib/i18n.ts` (o il file `*-copy.ts` della pagina), mai stringhe IT/EN nei componenti |

## Regole

1. **Solo token.** Nei CSS nuovi usa `var(--ds-*)`. Niente esadecimali, `999px`, `cubic-bezier(...)` o `z-index` numerici scritti a mano. Se manca un valore, aggiungilo a `tokens.css` con un commento d'uso.
2. **Scope per pagina.** Ogni pagina ha un prefisso (`.hv-` home, `.qx-` Quotes, `.tb-` badge, `.t-` team, `.eco` Ecosistema admin). I pezzi riusabili dell'admin usano `.ds-`. Gli alias locali (`--hv-accent: var(--ds-accent)`) sono ammessi, i valori nuovi no.
3. **Telaio.** Pagina `--ds-page`, card a tutta larghezza con margine laterale `--ds-frame` (10px) e spazio tra card `--ds-gap` (uguale al margine). Raggio card `--ds-r-card` (22px), padding interno `--ds-pad`.
4. **Colore.** Fondo scuro, card `--ds-card` o `--ds-paper`. Un solo accento per vista: arancione `--ds-accent`. Le palette prodotto (`--ds-q-*` per Quotes) vivono solo dentro le card di quel prodotto.
5. **Pulito.** Colori pieni. Niente gradienti decorativi, glow o ombre colorate. Le ombre sono quelle dei token (`--ds-shadow-*`).
6. **Tipo.** Titoli in Satoshi (`--ds-font-display`), testo in Geist (`--ds-font-body`). Scala: `--ds-text-h1`, `--ds-text-h2`, `--ds-text-h3`, `--ds-text-kicker`; tracking titoli `--ds-track-display`.
7. **Bottoni e pillole.** Raggio `--ds-r-pill`. CTA piena nell'accento con `ArrowUpRight` che si sposta di 2px in hover; secondaria a contorno. `:active` a `scale(0.97)`.
8. **Movimento.** CSS con `--ds-ease` e `--ds-dur*`; animazioni JS con le molle di `springs.ts`. Sempre un fallback `prefers-reduced-motion` e contenuto visibile senza JS.
9. **Livelli.** Header 60, progress 70, back-to-top 90, cursore 140, assistente 150, carrello 180, transizione 190, command menu 200 (`--ds-z-*`).
10. **Accessibilità.** Focus visibile (outline 2px accento), target touch di almeno 44px, nome accessibile su ogni icona-link.

## Per una pagina nuova

Copia il telaio della home (`hv-block` > `hv-card`), prendi i testi da `lib/i18n.ts`, usa solo token, verifica a 1440 e 390 px in IT ed EN.

## Admin, conversione

La cornice (sidebar, header, ricerca, menu account) è già sui token `--ds-*` tramite `components/ds/admin-shell.css`. Le viste interne convertite importano `components/ds/admin-ui.css` e i componenti `.ds-*`, e hanno un prefisso di pagina: `.eco` Ecosistema, `.ov` Panoramica (`overview.css`). Le altre sezioni interne usano ancora gli stili `--adm-*` finché non vengono convertite.

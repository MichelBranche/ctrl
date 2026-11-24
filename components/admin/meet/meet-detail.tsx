import type { ReactNode } from "react";
import { CancelMeeting } from "@/components/admin/meet/meet-detail-actions";
import { CopyLink } from "@/components/admin/meet/meet-forms";
import { Icon, MI } from "@/components/admin/meet/meet-icons";
import { DateTile, whenOf, WhenPill } from "@/components/admin/meet/meet-row";
import { addDays, durationLabel, longDay } from "@/lib/meet-dates";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Meeting detail, in fixed sections: Quando, Partecipanti, Collegamento, Note, Azioni. */
export function MeetDetail({ kind, id, title, start, end, minutes, now, meetUrl, calendarUrl, people, notesLabel, notes, linkNote, allDay }: {
  kind: "team" | "google" | "cliente"; allDay?: boolean; id: string; title: string; start: string; end: string; minutes: number; now: string;
  meetUrl: string | null; calendarUrl?: string | null; people: ReactNode; notesLabel: string; notes: string | null; linkNote?: string;
}) {
  const when = whenOf({ start, end }, now);
  const over = when === "past";
  return (
    <main className="ds-page rb mt mt-narrow">
      <nav className="mt-crumbs" aria-label="Percorso"><a href="/admin/riunioni"><Icon d={MI.back} size={14} />Riunioni</a></nav>
      <header className="mt-card mt-dhead" data-kind={kind}>
        <DateTile day={start.slice(0, 10)} kind={kind} />
        <div>
          <p className="rb-kicker">{kind === "team" ? "Riunione team" : kind === "google" ? "Evento Google Calendar" : "Riunione cliente"}</p>
          <h1>{title}</h1>
          <p className="mt-dhead-meta"><WhenPill when={when} /><span><Icon d={MI.clock} size={14} />{allDay ? "Tutto il giorno" : `${start.slice(11)}–${end.slice(11)} · ${durationLabel(minutes)}`}</span></p>
        </div>
        {meetUrl && !over ? <a className="rb-cta mt-dhead-cta" href={meetUrl} target="_blank" rel="noopener noreferrer"><Icon d={MI.video} />Entra</a> : null}
      </header>

      <div className="mt-dgrid">
        <section className="mt-card mt-dsec" aria-labelledby="mt-d-when">
          <h2 id="mt-d-when"><span className="mt-sec-icon" data-c="when"><Icon d={MI.clock} size={15} /></span>Quando</h2>
          <dl className="mt-dl">
            <div><dt>Giorno</dt><dd>{cap(longDay(start.slice(0, 10)))}</dd></div>
            {allDay ? <div><dt>Orario</dt><dd>Tutto il giorno{end.slice(0, 10) > addDays(start.slice(0, 10), 1) ? `, fino a ${longDay(addDays(end.slice(0, 10), -1))}` : ""}</dd></div> : (
              <>
                <div><dt>Orario</dt><dd>Dalle {start.slice(11)} alle {end.slice(11)} (ora italiana)</dd></div>
                <div><dt>Durata</dt><dd>{durationLabel(minutes)}</dd></div>
              </>
            )}
          </dl>
        </section>
        <section className="mt-card mt-dsec" aria-labelledby="mt-d-people">
          <h2 id="mt-d-people"><span className="mt-sec-icon" data-c={kind}><Icon d={kind === "cliente" ? MI.client : MI.users} size={15} /></span>{kind === "cliente" ? "Cliente" : "Partecipanti"}</h2>
          {people}
        </section>
        <section className="mt-card mt-dsec" aria-labelledby="mt-d-link">
          <h2 id="mt-d-link"><span className="mt-sec-icon" data-c="link"><Icon d={MI.link} size={15} /></span>Collegamento</h2>
          {meetUrl ? (
            <>
              <p className="mt-url"><code>{meetUrl.replace("https://", "")}</code></p>
              <div className="mt-actions mt-actions-start">
                <CopyLink url={meetUrl} />
                {calendarUrl ? <a className="rb-btn rb-btn-quiet mt-act" href={calendarUrl} target="_blank" rel="noopener noreferrer">Apri in Google Calendar<Icon d={MI.ext} size={13} /></a> : null}
              </div>
            </>
          ) : <p className="mt-dim">Nessun link Meet su questa riunione.</p>}
          {linkNote ? <p className="mt-hint">{linkNote}</p> : null}
        </section>
        <section className="mt-card mt-dsec" aria-labelledby="mt-d-notes">
          <h2 id="mt-d-notes"><span className="mt-sec-icon" data-c="note"><Icon d={MI.note} size={15} /></span>{notesLabel}</h2>
          {notes ? <p className="mt-notes">{notes}</p> : <p className="mt-dim">Niente da segnalare.</p>}
        </section>
      </div>

      {kind === "google" ? (
        <section className="mt-card mt-dsec mt-gnote" aria-labelledby="mt-d-g">
          <div>
            <h2 id="mt-d-g"><span className="mt-sec-icon" data-c="google"><Icon d={MI.cal} size={15} /></span>Aggiunto da Google Calendar</h2>
            <p className="mt-hint">Questo evento non è stato creato dal pannello: qui è in sola lettura. Modificalo o annullalo da Google Calendar.</p>
          </div>
          {calendarUrl ? <a className="rb-btn" href={calendarUrl} target="_blank" rel="noopener noreferrer">Apri in Google Calendar<Icon d={MI.ext} size={13} /></a> : null}
        </section>
      ) : !over ? (
        <section className="mt-card mt-dsec mt-danger-zone" aria-labelledby="mt-d-act">
          <div>
            <h2 id="mt-d-act"><span className="mt-sec-icon" data-c="danger"><Icon d={MI.trash} size={15} /></span>Annulla la riunione</h2>
            <p className="mt-hint">{kind === "team" ? "Google avvisa tutti gli invitati dell'annullamento." : "Puoi scegliere se avvisare il cliente con un'email di annullamento."}</p>
          </div>
          <CancelMeeting kind={kind === "cliente" ? "cliente" : "team"} id={id} />
        </section>
      ) : null}
    </main>
  );
}

export function DetailMissing({ text }: { text: string }) {
  return (
    <main className="ds-page rb mt mt-narrow">
      <nav className="mt-crumbs" aria-label="Percorso"><a href="/admin/riunioni"><Icon d={MI.back} size={14} />Riunioni</a></nav>
      <p className="mt-empty"><Icon d={MI.alert} />{text} <a href="/admin/riunioni">Torna al calendario</a>.</p>
    </main>
  );
}

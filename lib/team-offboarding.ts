/* Client-safe default text of the end-of-collaboration email (editable by the founder in the confirm dialog). */
export const OFFBOARDING_SUBJECT = "Cessazione del rapporto di collaborazione con Ctrl Agency";

export function offboardingText(name: string, now = new Date()) {
  const first = name.split(/\s+/)[0] || name;
  const date = now.toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" });
  return [
    `Gentile ${first},`,
    `ti comunichiamo che a partire dal ${date} il rapporto di collaborazione con Ctrl Agency si è concluso.`,
    "Ti ringraziamo sinceramente per il lavoro svolto e per il contributo dato ai progetti dello studio in questo periodo.",
    "Da oggi l'accesso all'area riservata del team è stato disattivato. Eventuali materiali o informazioni dei clienti restano riservati anche dopo la fine della collaborazione.",
    "Per qualsiasi domanda, per questioni amministrative o per eventuali compensi ancora in sospeso, puoi scriverci rispondendo a questa email o a info@ctrlagency.dev.",
    "Ti auguriamo il meglio per i prossimi progetti.",
  ].join("\n\n");
}

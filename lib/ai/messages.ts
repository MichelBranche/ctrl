/**
 * Italian copy the admin UI and the AI routes share.
 * No system prompt and no secrets: a client component may import this file.
 */

export const AI_MSG = {
  unconfigured: "AI non configurata",
  quotaUser: "Hai raggiunto il limite di richieste AI di oggi. Riprova domani.",
  quotaProvider: "Le quote gratuite dell'AI sono esaurite per oggi. Riprova domani.",
  down: "Il servizio AI non risponde in questo momento. Riprova tra poco.",
  badOutput: "Non è stato possibile preparare il testo. Riprova.",
  offTopic: "Posso aiutare solo sul lavoro del CRM: contatti, pipeline, attività e cose da fare oggi.",
  noCrm: "Questo account non ha accesso al CRM, quindi non posso leggere contatti o pipeline.",
  unauthorized: "Accedi per usare l'assistente AI.",
  forbidden: "Non hai il permesso per usare questa funzione.",
  notFound: "Contatto non trovato.",
  badRequest: "Richiesta non valida.",
  tooBig: "Richiesta troppo grande.",
  limitDb: "Impossibile verificare il limite giornaliero. Riprova tra poco.",
} as const;

export type AiCode =
  | "unconfigured"
  | "quota"
  | "down"
  | "bad_output"
  | "offtopic"
  | "no_crm"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "limit_db";

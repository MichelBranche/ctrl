import type { Locale } from "@/lib/i18n";

/** Managed security and SSL/TLS service: shared by the /projects section and /services/web-security. */
export const SECURITY_PATH = "/services/web-security";
export const SECURITY_IMAGE = "/images/services/web-security.webp";

export type SecurityIcon = "lock" | "globe" | "shield" | "mail";

export type SecurityPlan = {
  name: string;
  /** Yearly price in euro, VAT excluded. */
  price: number;
  fit: string;
  featured: boolean;
  checks: string[];
  /** Extra, quoted separately: shown with a "+" instead of a check. */
  onRequest?: string;
  cta: string;
};

export type SecurityCopy = {
  kicker: string;
  title: [string, string];
  lead: string;
  pillarsLabel: string;
  pillars: { icon: SecurityIcon; title: string; text: string }[];
  plansKicker: string;
  plansTitle: string;
  plansText: string;
  recommended: string;
  perYear: string;
  vat: string;
  plans: [SecurityPlan, SecurityPlan];
  footnote: string;
  compareKicker: string;
  compareTitle: string;
  compareTopic: string;
  compareDiy: string;
  compareManaged: string;
  compare: { topic: string; diy: string; managed: string }[];
  ctaKicker: string;
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
  more: string;
  imageAlt: string;
  page: {
    metaTitle: string;
    metaDescription: string;
    serviceType: string;
    crumbs: [string, string, string];
    tag: string;
    title: [string, string];
    lead: string;
    processKicker: string;
    processTitle: string;
    steps: { title: string; text: string }[];
    faqTitle: string;
    faqs: { q: string; a: string }[];
    back: string;
  };
};

export const securityCopy: Record<Locale, SecurityCopy> = {
  it: {
    kicker: "Sicurezza & Infrastruttura Managed",
    title: ["Sicuro, veloce,", "sempre online."],
    lead: "Ci occupiamo noi della messa in sicurezza, della crittografia e dell'affidabilità dell'infrastruttura cloud del tuo sito. Tu pensi al business, al resto pensiamo noi.",
    pillarsLabel: "Cosa gestiamo",
    pillars: [
      {
        icon: "lock",
        title: "Certificati SSL/TLS e HTTPS gestito",
        text: "Attivazione, configurazione DNS e monitoraggio costante dei rinnovi automatici. Connessioni sempre crittografate e nessun avviso «sito non sicuro» davanti ai tuoi clienti.",
      },
      {
        icon: "globe",
        title: "Cloud edge e protezione DDoS",
        text: "Il sito viene distribuito su una rete globale ad alte prestazioni: si carica in fretta ovunque e regge attacchi informatici e picchi di traffico anomali.",
      },
      {
        icon: "shield",
        title: "Hardening e security headers",
        text: "Regole di sicurezza lato server configurate e verificate, per proteggere i visitatori da clickjacking, XSS e furto di dati.",
      },
      {
        icon: "mail",
        title: "Dominio ed email autenticate",
        text: "Configuriamo SPF, DKIM e DMARC: le email aziendali arrivano in casella invece che in spam, e clonarle per il phishing diventa molto più difficile.",
      },
    ],
    plansKicker: "Piani annuali",
    plansTitle: "Prezzi chiari, un canone all'anno.",
    plansText: "Scegli il livello di protezione adatto al tuo sito. Nel canone c'è tutto quello che vedi in lista.",
    recommended: "Consigliato",
    perYear: "/ anno",
    vat: "+ IVA",
    plans: [
      {
        name: "Essential Care & SSL",
        price: 240,
        fit: "Ideale per siti vetrina, portfolio e landing page aziendali.",
        featured: false,
        checks: [
          "Certificato SSL/TLS con rinnovo automatico monitorato",
          "Hosting cloud edge ad alte prestazioni",
          "Security headers di base",
          "Monitoraggio uptime 24/7",
          "Supporto tecnico prioritario",
        ],
        cta: "Attiva Essential",
      },
      {
        name: "Business Shield & Pro",
        price: 450,
        fit: "Ideale per e-commerce, portali e aziende strutturate.",
        featured: true,
        checks: [
          "Tutto quello che c'è nel piano Essential",
          "Configurazione DNS email (SPF, DKIM, DMARC)",
          "Protezione WAF e DDoS avanzata",
          "Report annuale di sicurezza e performance",
        ],
        onRequest: "Certificati aziendali OV/EV su richiesta (costo del certificato a parte)",
        cta: "Attiva Business Shield",
      },
    ],
    footnote: "Servizio attivabile sia su nuovi progetti sviluppati dalla nostra agenzia sia su siti e infrastrutture già esistenti. Prezzi IVA esclusa, fatturazione annuale.",
    compareKicker: "Perché delegarlo a noi",
    compareTitle: "Fai da te o gestito.",
    compareTopic: "Aspetto",
    compareDiy: "Fai da te / hosting standard",
    compareManaged: "Infrastruttura gestita da CTRL®",
    compare: [
      {
        topic: "Certificati e continuità",
        diy: "Rinnovi da ricordare e avvisi «sito non sicuro» quando qualcosa salta.",
        managed: "Rinnovi automatici e monitorati: nessun certificato scaduto, nessun sito bloccato.",
      },
      {
        topic: "Velocità e SEO",
        diy: "Un server singolo, tempi di caricamento che cambiano da un giorno all'altro.",
        managed: "Rete edge globale: pagine veloci ovunque, un fattore che conta anche per Google.",
      },
      {
        topic: "Referente",
        diy: "Hosting, dominio, email e sviluppatore: un fornitore diverso per ogni problema.",
        managed: "Un unico referente tecnico dedicato, che conosce il tuo sito.",
      },
    ],
    ctaKicker: "Analisi gratuita",
    ctaTitle: "Metti al sicuro il tuo sito.",
    ctaText: "Controlliamo certificato, security headers, DNS ed email del tuo dominio e ti diciamo cosa va sistemato, senza impegno.",
    ctaButton: "Richiedi un'analisi gratuita",
    more: "Scopri il servizio",
    imageAlt: "Scudo di vetro davanti a un globo di punti attraversato da connessioni luminose",
    page: {
      metaTitle: "Sicurezza web e certificati SSL gestiti ad Aosta | CTRL®",
      metaDescription:
        "Certificati SSL/TLS, hosting edge, protezione DDoS, security headers ed email del dominio. Piani da 240 € + IVA, anche per siti già online. In Italia.",
      serviceType: "Managed website security and SSL/TLS certificate management",
      crumbs: ["Servizi", "Crescita e supporto", "Sicurezza web"],
      tag: "Crescita e supporto",
      title: ["Sicurezza web", "e SSL gestiti."],
      lead: "Certificati, infrastruttura, regole di sicurezza ed email del dominio, seguiti da un unico team. Il tuo sito resta protetto, veloce e raggiungibile, senza che tu debba pensarci.",
      processKicker: "Come si attiva",
      processTitle: "Dall'analisi al report.",
      steps: [
        { title: "Analisi", text: "Controlliamo certificato, header, DNS, email e velocità del sito attuale." },
        { title: "Configurazione", text: "Attiviamo HTTPS, regole di sicurezza e autenticazione email, pianificando ogni passaggio." },
        { title: "Monitoraggio", text: "Uptime e rinnovi sotto controllo tutto l'anno: se qualcosa non va, interveniamo noi." },
        { title: "Report", text: "Ogni anno un resoconto chiaro su sicurezza e performance, con le priorità per l'anno dopo." },
      ],
      faqTitle: "Domande frequenti",
      faqs: [
        {
          q: "Il certificato SSL non è già gratuito?",
          a: "Il certificato di base (DV) sì, ed è quello che usiamo nella maggior parte dei casi. Il valore del servizio sta nel configurarlo bene, nel monitorare i rinnovi e nel tenere in ordine tutto il resto: header di sicurezza, DNS, email e uptime.",
        },
        {
          q: "Potete gestire un sito che non avete sviluppato voi?",
          a: "Sì. Il servizio si attiva sia sui progetti nuovi sia su siti e infrastrutture già esistenti. Partiamo da un'analisi gratuita e ti diciamo cosa si può gestire così com'è e cosa conviene spostare.",
        },
        {
          q: "Cosa c'è nel report annuale del piano Business?",
          a: "Lo stato di certificati, uptime, security headers, configurazione DNS ed email, più le metriche di velocità del sito. Ogni punto ha una valutazione e, se serve, l'intervento consigliato.",
        },
        {
          q: "Servono i certificati OV o EV?",
          a: "Per la maggior parte dei siti no: i browser mostrano lo stesso lucchetto anche con un certificato DV. Se la tua azienda li richiede, per esempio per policy interne o gare, li gestiamo su richiesta. Il certificato si acquista da un'autorità di certificazione e il suo costo è a parte.",
        },
        {
          q: "Le email aziendali smetteranno di finire in spam?",
          a: "SPF, DKIM e DMARC configurati bene migliorano molto la consegna e rendono più difficile usare il tuo dominio per il phishing. Contano anche il contenuto e la reputazione di chi invia, per questo non promettiamo il 100%.",
        },
      ],
      back: "Tutti i servizi",
    },
  },
  en: {
    kicker: "Managed Security & Infrastructure",
    title: ["Secure, fast,", "always online."],
    lead: "We take care of the security, encryption and reliability of your website's cloud infrastructure. You focus on the business, we handle the rest.",
    pillarsLabel: "What we manage",
    pillars: [
      {
        icon: "lock",
        title: "Managed SSL/TLS certificates and HTTPS",
        text: "Activation, DNS setup and constant monitoring of automatic renewals. Connections stay encrypted and your customers never see a \"not secure\" warning.",
      },
      {
        icon: "globe",
        title: "Cloud edge and DDoS protection",
        text: "Your site is served from a high-performance global network: it loads fast everywhere and holds up against attacks and abnormal traffic spikes.",
      },
      {
        icon: "shield",
        title: "Hardening and security headers",
        text: "Server-side security rules, configured and verified, to protect visitors from clickjacking, XSS and data theft.",
      },
      {
        icon: "mail",
        title: "Authenticated domain and email",
        text: "We set up SPF, DKIM and DMARC: business email lands in the inbox instead of spam, and cloning it for phishing becomes much harder.",
      },
    ],
    plansKicker: "Yearly plans",
    plansTitle: "Clear pricing, one yearly fee.",
    plansText: "Pick the level of protection your site needs. The fee covers everything you see on the list.",
    recommended: "Recommended",
    perYear: "/ year",
    vat: "+ VAT",
    plans: [
      {
        name: "Essential Care & SSL",
        price: 240,
        fit: "Ideal for showcase sites, portfolios and business landing pages.",
        featured: false,
        checks: [
          "SSL/TLS certificate with monitored automatic renewal",
          "High-performance cloud edge hosting",
          "Baseline security headers",
          "24/7 uptime monitoring",
          "Priority technical support",
        ],
        cta: "Activate Essential",
      },
      {
        name: "Business Shield & Pro",
        price: 450,
        fit: "Ideal for e-commerce, portals and established companies.",
        featured: true,
        checks: [
          "Everything in the Essential plan",
          "Email DNS setup (SPF, DKIM, DMARC)",
          "Advanced WAF and DDoS protection",
          "Yearly security and performance report",
        ],
        onRequest: "OV/EV business certificates on request (certificate cost billed separately)",
        cta: "Activate Business Shield",
      },
    ],
    footnote: "Available both for new projects built by our studio and for existing websites and infrastructure. Prices exclude VAT, billed yearly.",
    compareKicker: "Why hand it to us",
    compareTitle: "Do it yourself, or managed.",
    compareTopic: "Topic",
    compareDiy: "DIY / standard hosting",
    compareManaged: "Infrastructure managed by CTRL®",
    compare: [
      {
        topic: "Certificates and uptime",
        diy: "Renewals to remember, and \"not secure\" warnings when something slips.",
        managed: "Automatic, monitored renewals: no expired certificates, no blocked site.",
      },
      {
        topic: "Speed and SEO",
        diy: "A single server, with load times that change from day to day.",
        managed: "Global edge network: fast pages everywhere, a factor Google counts too.",
      },
      {
        topic: "Point of contact",
        diy: "Hosting, domain, email and developer: a different vendor for every problem.",
        managed: "One dedicated technical contact who knows your site.",
      },
    ],
    ctaKicker: "Free review",
    ctaTitle: "Secure your website.",
    ctaText: "We check your domain's certificate, security headers, DNS and email, and tell you what needs fixing, with no commitment.",
    ctaButton: "Request a free review",
    more: "Explore the service",
    imageAlt: "Glass shield in front of a dotted globe crossed by glowing connections",
    page: {
      metaTitle: "Managed web security and SSL certificates, Aosta | CTRL®",
      metaDescription:
        "SSL/TLS certificates, edge hosting, DDoS protection, security headers and domain email. Yearly plans from €240 + VAT, including sites already online.",
      serviceType: "Managed website security and SSL/TLS certificate management",
      crumbs: ["Services", "Growth & Support", "Web security"],
      tag: "Growth & Support",
      title: ["Managed web", "security and SSL."],
      lead: "Certificates, infrastructure, security rules and domain email, handled by one team. Your site stays protected, fast and reachable, without you having to think about it.",
      processKicker: "How it starts",
      processTitle: "From review to report.",
      steps: [
        { title: "Review", text: "We check the certificate, headers, DNS, email and speed of your current site." },
        { title: "Setup", text: "We switch on HTTPS, security rules and email authentication, planning every step." },
        { title: "Monitoring", text: "Uptime and renewals watched all year: if something goes wrong, we step in." },
        { title: "Report", text: "Every year, a clear summary of security and performance, with priorities for the next one." },
      ],
      faqTitle: "Frequently asked questions",
      faqs: [
        {
          q: "Isn't an SSL certificate free already?",
          a: "The basic (DV) certificate is, and it is what we use in most cases. The value of the service is configuring it properly, monitoring renewals and keeping everything else in order: security headers, DNS, email and uptime.",
        },
        {
          q: "Can you manage a site you did not build?",
          a: "Yes. The service works for new projects and for existing websites and infrastructure. We start with a free review and tell you what can be managed as it is and what is worth moving.",
        },
        {
          q: "What is in the Business plan's yearly report?",
          a: "The status of certificates, uptime, security headers, DNS and email setup, plus the site's speed metrics. Each point gets a rating and, where needed, the recommended fix.",
        },
        {
          q: "Do I need OV or EV certificates?",
          a: "For most sites, no: browsers show the same padlock with a DV certificate. If your company requires them, for internal policies or tenders, we handle them on request. The certificate is bought from a certificate authority and its cost is billed separately.",
        },
        {
          q: "Will business email stop landing in spam?",
          a: "Properly configured SPF, DKIM and DMARC improve delivery a lot and make it harder to use your domain for phishing. Content and sender reputation matter too, so we do not promise 100%.",
        },
      ],
      back: "All services",
    },
  },
};

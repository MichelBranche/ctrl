import type { Locale } from "@/lib/i18n";

export type ServiceDetail = {
  metaTitle: string;
  metaDescription: string;
  serviceType: string;
  tag: string;
  title: string;
  lead: string;
  image: string;
  imageAlt: string;
  whatTitle: string;
  what: string[];
  forTitle: string;
  forWhom: string[];
  includedTitle: string;
  included: { title: string; text: string }[];
  processKicker: string;
  processTitle: string;
  steps: { title: string; text: string }[];
  timingTitle: string;
  timing: string;
  faqTitle: string;
  faqs: { q: string; a: string }[];
  cta: string;
  related: { href: string; label: string }[];
};

const brandIt: ServiceDetail = {
  metaTitle: "Grafica e brand identity ad Aosta",
  metaDescription: "Logo, colori, tipografia e linee guida per attività e hotel in Valle d'Aosta e nel Nord Italia. CTRL® costruisce un'identità che regge su sito, social e stampa.",
  serviceType: "Brand identity",
  tag: "01",
  title: "Brand e identità",
  lead: "Un sistema visivo che si riconosce prima del sito: segno, colore, tipografia e tono di voce, costruito per durare oltre la prima campagna.",
  image: "/images/projects/brand-identity.webp",
  imageAlt: "Tavole di identità visiva, segno e palette",
  whatTitle: "Cos'è",
  what: [
    "Il brand non è un logo isolato. È il modo in cui un'attività viene riconosciuta, dal menu di un hotel alla pagina di prenotazione, dalla mail al cartello in reception.",
    "Partiamo da come parli ai clienti e da cosa ti distingue davvero. Poi fissiamo un sistema che il team può usare senza reinventarlo ogni volta.",
  ],
  forTitle: "Per chi è",
  forWhom: [
    "Attività che stanno aprendo e non hanno ancora un segno.",
    "Hotel, residence e brand con un logo datato e materiali che non si parlano tra loro.",
    "Chi sta rifacendo il sito e vuole che l'identità tenga insieme le pagine nuove.",
  ],
  includedTitle: "Cosa è incluso",
  included: [
    { title: "Direzione", text: "A chi parli, cosa prometti, e cosa non sei. Poche frasi, scritte per decidere, non per decorare una presentazione." },
    { title: "Segno", text: "Il marchio e le varianti che servono davvero: orizzontale, compatta, su fondo scuro e a un colore." },
    { title: "Sistema", text: "Colori, tipografia e gerarchie, provate su un sito, su un social e su un pezzo stampato." },
    { title: "Linee guida", text: "Un documento che puoi dare a chi stampa, pubblica o sviluppa, con gli usi giusti e quelli da evitare." },
  ],
  processKicker: "Come si svolge",
  processTitle: "Dal nome al sistema.",
  steps: [
    { title: "Ascolto", text: "Materiali esistenti, clienti veri, e i segni dei concorrenti che ti stanno intorno." },
    { title: "Direzione", text: "Una proposta chiara. Non dieci varianti quasi uguali tra cui scegliere a caso." },
    { title: "Sistema", text: "Segno, colore, tipo e due o tre applicazioni concrete." },
    { title: "Consegna", text: "File pronti e linee guida. Il sito, se serve, è il passo successivo." },
  ],
  timingTitle: "Tempi",
  timing: "Un'identità essenziale, quando il posizionamento è già chiaro, sta di solito in due o quattro settimane. Se nome, pubblico o offerta sono ancora aperti, il tempo si allunga e lo scriviamo nel preventivo. Non pubblichiamo un listino: il costo dipende da quante applicazioni servono.",
  faqTitle: "Domande frequenti",
  faqs: [
    { q: "Fate solo il logo?", a: "Il logo da solo si perde nel giro di un mese. Se hai una scadenza stretta e ti serve il segno, lo diciamo, e lo consegniamo comunque con una mini guida d'uso." },
    { q: "Lavorate su un marchio che esiste già?", a: "Sì. A volte basta ripulirlo e fissare le regole. A volte conviene rifarlo. Lo decidiamo dopo aver visto dove si rompe, non prima." },
    { q: "Il brand include il sito?", a: "L'identità è il sistema. Il sito è un servizio a parte, e ha senso farlo subito dopo, o insieme se la scadenza è una sola." },
    { q: "Lavorate solo in Valle d'Aosta?", a: "La sede è ad Aosta. L'identità la facciamo per attività della valle, del Nord Italia e, quando il progetto lo chiede, del resto d'Italia." },
  ],
  cta: "Parliamo dell'identità",
  related: [
    { href: "/services/visual-communication", label: "Siti web su misura" },
    { href: "/agenzia-web-valle-d-aosta", label: "Agenzia web in Valle d'Aosta" },
  ],
};

const brandEn: ServiceDetail = {
  metaTitle: "Brand identity and graphic design in Aosta",
  metaDescription: "Logo, colour, type and guidelines for businesses and hotels in Valle d'Aosta and Northern Italy. CTRL® builds an identity that holds on the site, social and print.",
  serviceType: "Brand identity",
  tag: "01",
  title: "Brand & identity",
  lead: "A visual system people recognise before they reach the website: mark, colour, type and tone of voice, built to outlast the first campaign.",
  image: "/images/projects/brand-identity.webp",
  imageAlt: "Identity boards with a mark and a colour palette",
  whatTitle: "What it is",
  what: [
    "A brand is not a logo on its own. It is how a business is recognised, from a hotel menu to the booking page, from an email to the sign at reception.",
    "We start from how you talk to customers and from what actually sets you apart. Then we lock a system the team can use without reinventing it each time.",
  ],
  forTitle: "Who it is for",
  forWhom: [
    "Businesses opening now, with no mark yet.",
    "Hotels, residences and product brands with a dated logo and materials that do not match.",
    "Anyone rebuilding a website who wants the identity to hold the new pages together.",
  ],
  includedTitle: "What is included",
  included: [
    { title: "Direction", text: "Who you speak to, what you promise, and what you are not. A few sentences written to decide, not to decorate a deck." },
    { title: "Mark", text: "The logo and the versions you actually need: horizontal, compact, on a dark ground, and in one colour." },
    { title: "System", text: "Colour, type and hierarchy, tried on a website, a social post and a printed piece." },
    { title: "Guidelines", text: "A document you can hand to whoever prints, publishes or builds, with the right uses and the ones to avoid." },
  ],
  processKicker: "How it runs",
  processTitle: "From the name to the system.",
  steps: [
    { title: "Listen", text: "Existing materials, real customers, and the marks of the competitors around you." },
    { title: "Direction", text: "One clear proposal. Not ten near-identical options to pick from at random." },
    { title: "System", text: "Mark, colour, type and two or three concrete applications." },
    { title: "Handover", text: "Ready files and guidelines. The website, if you need one, is the next step." },
  ],
  timingTitle: "Timing",
  timing: "A focused identity, once the positioning is already clear, usually takes two to four weeks. If the name, the audience or the offer is still open, it takes longer and we write that into the proposal. We do not publish a rate card: the cost depends on how many applications you need.",
  faqTitle: "Common questions",
  faqs: [
    { q: "Do you only design the logo?", a: "A logo on its own fades within a month. If a deadline is tight and you need the mark, we say so, and we still deliver it with a short usage guide." },
    { q: "Can you work with a brand that already exists?", a: "Yes. Sometimes it needs a cleanup and a set of rules. Sometimes it should be redone. We decide after seeing where it breaks, not before." },
    { q: "Does the brand include the website?", a: "Identity is the system. The website is a separate service, and it makes sense right after, or together when there is a single deadline." },
    { q: "Do you only work in Valle d'Aosta?", a: "The studio is in Aosta. We build identities for businesses in the valley, in Northern Italy, and elsewhere in Italy when the project calls for it." },
  ],
  cta: "Talk about the identity",
  related: [
    { href: "/services/visual-communication", label: "Custom websites" },
    { href: "/agenzia-web-valle-d-aosta", label: "Web studio in Valle d'Aosta" },
  ],
};

const productIt: ServiceDetail = {
  metaTitle: "Web app e prodotti digitali su misura",
  metaDescription: "Web app, aree riservate e prodotti digitali su misura ad Aosta. CTRL® progetta e sviluppa senza template, per team in Valle d'Aosta e nel Nord Italia.",
  serviceType: "Web application development",
  tag: "02",
  title: "Sviluppo prodotto",
  lead: "Web app e prodotti digitali costruiti intorno a un flusso vero: aree clienti, strumenti del team, operazioni che oggi vivono su fogli e messaggi.",
  image: "/images/projects/webapps.webp",
  imageAlt: "Interfaccia di una web app su uno schermo",
  whatTitle: "Cos'è",
  what: [
    "Una web app è un prodotto che fa un lavoro: mostra una dashboard, fa entrare un cliente nella sua area, segue un'operazione dall'inizio alla fine. La progettiamo e la sviluppiamo su misura, con interfaccia e codice nello stesso percorso.",
    "Se ti serve un sito vetrina, un e-commerce o il sito di un hotel, quello sta in Comunicazione visiva. Qui entriamo quando ci sono ruoli, dati e un flusso che un tema non regge.",
  ],
  forTitle: "Per chi è",
  forWhom: [
    "Team che gestiscono il lavoro su fogli condivisi e chat.",
    "Attività che vogliono un'area riservata per clienti o per lo staff.",
    "Prodotti che devono crescere senza essere riscritti tra un anno.",
  ],
  includedTitle: "Cosa è incluso",
  included: [
    { title: "Flussi e ruoli", text: "Chi fa cosa, cosa vede, e dove il processo si inceppa oggi." },
    { title: "Interfaccia", text: "Un prototipo navigabile, prima di scrivere il codice che resta." },
    { title: "Sviluppo", text: "Web app, e mobile solo quando il telefono è davvero il posto giusto." },
    { title: "Consegna", text: "Performance, stati vuoti, errori chiari, e il repository che resta tuo." },
  ],
  processKicker: "Come si svolge",
  processTitle: "Una fetta utilizzabile alla volta.",
  steps: [
    { title: "Flussi", text: "Seduti sul lavoro vero, non su una lista di funzioni copiata da un software famoso." },
    { title: "Prototipo", text: "Si clicca prima di costruire. Le cose sbagliate costano meno su un prototipo." },
    { title: "Costruzione", text: "La prima versione fa un lavoro completo, non dieci lavori a metà." },
    { title: "Rilascio", text: "Online, misurata, con un passaggio di consegne a chi la userà." },
  ],
  timingTitle: "Tempi",
  timing: "Una prima versione utilizzabile, con un flusso solo, sta spesso tra le sei e le dodici settimane. Più ruoli e più integrazioni allungano il percorso. Tempi e costo li fissiamo dopo aver visto i flussi, non da un listino.",
  faqTitle: "Domande frequenti",
  faqs: [
    { q: "Fate anche app per telefono?", a: "Sì, quando il telefono è il posto giusto. Spesso una web app ben fatta basta, e si aggiorna senza passare dagli store." },
    { q: "Usate template?", a: "No. Il codice è del progetto, scritto per quel prodotto. Non adattiamo un tema fino a farlo sembrare su misura." },
    { q: "Di chi è il codice?", a: "Resta tuo. Consegniamo il repository e spieghiamo come si pubblica una modifica." },
    { q: "Che differenza c'è con Software e AI?", a: "Qui il prodotto è l'interfaccia che le persone usano ogni giorno. Software e AI copre gestionali, automazioni e modelli, anche in abbonamento." },
  ],
  cta: "Parliamo del prodotto",
  related: [
    { href: "/services/webapp", label: "Webapp scalabili" },
    { href: "/services/software-ai", label: "Software e gestionali" },
  ],
};

const productEn: ServiceDetail = {
  metaTitle: "Custom web apps and digital products",
  metaDescription: "Custom web apps, private areas and digital products from Aosta. CTRL® designs and builds without templates, for teams in Valle d'Aosta and Northern Italy.",
  serviceType: "Web application development",
  tag: "02",
  title: "Product development",
  lead: "Web apps and digital products built around a real workflow: client areas, team tools, operations that currently live in spreadsheets and chats.",
  image: "/images/projects/webapps.webp",
  imageAlt: "A web app interface on a screen",
  whatTitle: "What it is",
  what: [
    "A web app is a product that does a job: it shows a dashboard, lets a client into their area, or follows an operation from start to finish. We design and build it to measure, with interface and code on the same path.",
    "A brochure site, an online shop or a hotel website lives under Visual communication. We start here when there are roles, data and a flow a theme cannot hold.",
  ],
  forTitle: "Who it is for",
  forWhom: [
    "Teams running the work from shared spreadsheets and chat.",
    "Businesses that need a private area for clients or staff.",
    "Products that have to grow without a rewrite next year.",
  ],
  includedTitle: "What is included",
  included: [
    { title: "Flows and roles", text: "Who does what, what they see, and where the process sticks today." },
    { title: "Interface", text: "A clickable prototype, before we write the code that stays." },
    { title: "Build", text: "A web app, and mobile only when the phone is genuinely the right place." },
    { title: "Handover", text: "Performance, empty states, clear errors, and a repository that stays yours." },
  ],
  processKicker: "How it runs",
  processTitle: "One usable slice at a time.",
  steps: [
    { title: "Flows", text: "Sat on the real work, not on a feature list copied from a famous product." },
    { title: "Prototype", text: "People click before we build. Wrong ideas are cheaper on a prototype." },
    { title: "Build", text: "The first version does one job completely, not ten jobs halfway." },
    { title: "Release", text: "Live, measured, with a handover to the people who will use it." },
  ],
  timingTitle: "Timing",
  timing: "A first usable version, with a single flow, often takes six to twelve weeks. More roles and more integrations stretch the path. We set time and cost after seeing the flows, not from a rate card.",
  faqTitle: "Common questions",
  faqs: [
    { q: "Do you also build phone apps?", a: "Yes, when the phone is the right place. A well-built web app is often enough, and it updates without the app stores." },
    { q: "Do you use templates?", a: "No. The code belongs to the project and is written for that product. We do not stretch a theme until it looks custom." },
    { q: "Who owns the code?", a: "You do. We hand over the repository and explain how a change gets published." },
    { q: "How is this different from Software & AI?", a: "Here the product is the interface people use every day. Software & AI covers internal tools, automations and models, including subscription products." },
  ],
  cta: "Talk about the product",
  related: [
    { href: "/services/webapp", label: "Scalable web apps" },
    { href: "/services/software-ai", label: "Software and internal tools" },
  ],
};

const visualIt: ServiceDetail = {
  metaTitle: "Siti web su misura ad Aosta",
  metaDescription: "Realizzazione siti web su misura ad Aosta: vetrine, rifacimenti, e-commerce e siti per hotel con prenotazione diretta. Studio CTRL® in Valle d'Aosta, per il Nord Italia.",
  serviceType: "Web design and development",
  tag: "03",
  title: "Comunicazione visiva",
  lead: "Siti web su misura per raccontare un'attività e portarla a un contatto, a una prenotazione o a un acquisto. Nessun tema comprato, nessuna griglia uguale per tutti.",
  image: "/images/projects/websites.webp",
  imageAlt: "Pagine di un sito web su misura",
  whatTitle: "Cos'è",
  what: [
    "Realizziamo il sito da zero: struttura, impianto dei testi, interfaccia e codice. Si parte da quello che offri e da chi deve capirlo in pochi secondi.",
    "Le richieste che arrivano più spesso sono tre. Un sito nuovo per un'attività che non ne ha uno. Il rifacimento di un sito lento, illeggibile da telefono o impossibile da aggiornare. Un e-commerce con un catalogo vero e un pagamento chiaro.",
    "Per hotel, residence e altre strutture ricettive il sito ha un lavoro in più: far prenotare in modo diretto. La persona vede camere, date e prezzo, e chiude sul tuo sito. Residence Le Vele, nel primo mese online, ha raccolto 14 prenotazioni e 11.947 euro, con 0 euro di advertising.",
  ],
  forTitle: "Per chi è",
  forWhom: [
    "Attività che vivono di passaparola e vogliono un sito all'altezza del lavoro.",
    "Hotel, residence, B&B e case vacanza che vogliono prenotazioni dirette sul proprio sito.",
    "Brand con un catalogo, che vogliono vendere senza sembrare un marketplace.",
    "Chi ha un sito che non porta contatti e va rifatto, non rattoppato.",
  ],
  includedTitle: "Cosa è incluso",
  included: [
    { title: "Pagine e percorsi", text: "Cosa viene prima, cosa merita una pagina, e dove la persona deve arrivare." },
    { title: "Interfaccia", text: "Disegno su misura per desktop e telefono, con la stessa gerarchia del brand." },
    { title: "Sviluppo", text: "Codice veloce, titoli e testi impostati, base tecnica pronta per Google." },
    { title: "Contatto o vendita", text: "Modulo, richiesta, prenotazione diretta o carrello, in base a cosa deve succedere." },
    { title: "Hotel", text: "Pagine camera, richiesta o disponibilità, mappa, e le lingue se il pubblico arriva da fuori." },
    { title: "Aggiornamenti", text: "Un modo semplice per cambiare testi e immagini dopo la messa online, senza richiamarci per una virgola." },
  ],
  processKicker: "Come si svolge",
  processTitle: "Dal brief alla messa online.",
  steps: [
    { title: "Brief", text: "Offerta, pubblico, siti che ti piacciono e siti che non funzionano." },
    { title: "Direzione", text: "Mappa delle pagine e una proposta di interfaccia, prima del codice." },
    { title: "Costruzione", text: "Sviluppo, testi di impianto, prove sul telefono." },
    { title: "Online", text: "Dominio, misura di base, e un giro insieme sulle cose che aggiornerai tu." },
  ],
  timingTitle: "Tempi",
  timing: "Un sito con poche pagine sta di solito in quattro o otto settimane. Un sito per hotel, con più lingue e prenotazione, o un e-commerce, chiede di più. Lo scriviamo nel preventivo dopo aver visto contenuti, lingue e integrazioni. Non abbiamo un prezzo a pagina.",
  faqTitle: "Domande frequenti",
  faqs: [
    { q: "Usate WordPress o un tema già fatto?", a: "No. Il sito è sviluppato su misura. Resta veloce e non dipende da un tema che si rompe a ogni aggiornamento." },
    { q: "Si può rifare solo la grafica e tenere il vecchio sito?", a: "Quasi mai conviene. Se il problema è la struttura o la velocità, un rifacimento è più corto di un restauro sul sistema vecchio." },
    { q: "La prenotazione diretta sostituisce i portali?", a: "I portali possono restare. Il sito diretto è il canale tuo: chi ti ha già scelto prenota senza un intermediario, e su quella prenotazione non paghi una commissione." },
    { q: "Fate anche i testi?", a: "Impostiamo la struttura e una prima stesura. Se l'identità non c'è ancora, conviene partire dal brand, così il tono del sito non è generico." },
    { q: "Lavorate solo in Valle d'Aosta?", a: "La sede è ad Aosta. I siti, in particolare per hotel e strutture ricettive, li facciamo in valle, nel Nord Italia e nel resto d'Italia." },
  ],
  cta: "Parliamo del sito",
  related: [
    { href: "/projects/websites/residence-le-vele", label: "Caso Residence Le Vele" },
    { href: "/services/brand-identity", label: "Brand e identità" },
    { href: "/agenzia-web-valle-d-aosta", label: "Agenzia web in Valle d'Aosta" },
  ],
};

const visualEn: ServiceDetail = {
  metaTitle: "Custom websites in Aosta",
  metaDescription: "Custom websites in Aosta: new sites, rebuilds, online shops and hotel sites with direct booking. CTRL® is based in Valle d'Aosta and works across Northern Italy.",
  serviceType: "Web design and development",
  tag: "03",
  title: "Visual communication",
  lead: "Custom websites that explain a business and lead to a conversation, a booking or a sale. No bought theme, no layout repeated for everyone.",
  image: "/images/projects/websites.webp",
  imageAlt: "Pages from a custom website",
  whatTitle: "What it is",
  what: [
    "We build the site from scratch: structure, a first pass at the words, interface and code. We start from what you offer and from who has to understand it in a few seconds.",
    "Three requests come up most. A first website for a business that does not have one. A rebuild of a site that is slow, unreadable on a phone, or impossible to update. An online shop with a real catalogue and a clear checkout.",
    "For hotels, residences and other stays, the site has one more job: direct booking. The guest sees rooms, dates and price, and finishes on your site. In its first month online, Residence Le Vele took 14 bookings and €11,947, with €0 spent on ads.",
  ],
  forTitle: "Who it is for",
  forWhom: [
    "Businesses that live on word of mouth and want a site that matches the work.",
    "Hotels, residences, B&Bs and holiday homes that want direct bookings on their own site.",
    "Brands with a catalogue that want to sell without looking like a marketplace.",
    "Anyone whose current site brings no enquiries and needs a rebuild, not a patch.",
  ],
  includedTitle: "What is included",
  included: [
    { title: "Pages and paths", text: "What comes first, what deserves its own page, and where the person should land." },
    { title: "Interface", text: "A custom design for desktop and phone, with the same hierarchy as the brand." },
    { title: "Build", text: "Fast code, titles and a first draft of the copy, with a technical base ready for Google." },
    { title: "Contact or sale", text: "A form, a request, a direct booking or a cart, depending on what has to happen." },
    { title: "Hotels", text: "Room pages, a request or availability, a map, and languages when guests come from abroad." },
    { title: "Updates", text: "A simple way to change words and images after launch, without calling us for a comma." },
  ],
  processKicker: "How it runs",
  processTitle: "From the brief to launch.",
  steps: [
    { title: "Brief", text: "The offer, the audience, sites you like and sites that fail." },
    { title: "Direction", text: "A map of the pages and an interface proposal, before the code." },
    { title: "Build", text: "Development, a first draft of the words, checks on a phone." },
    { title: "Launch", text: "Domain, a basic read of the numbers, and a walkthrough of what you will update." },
  ],
  timingTitle: "Timing",
  timing: "A site with a few pages usually takes four to eight weeks. A hotel site, with more languages and booking, or an online shop, takes longer. We write it into the proposal after seeing the content, the languages and the integrations. We do not price by the page.",
  faqTitle: "Common questions",
  faqs: [
    { q: "Do you use WordPress or a ready-made theme?", a: "No. The site is built to measure. It stays fast and does not depend on a theme that breaks on every update." },
    { q: "Can you reskin the old site and keep it?", a: "Almost never worth it. If the problem is structure or speed, a rebuild is shorter than restoring the old system." },
    { q: "Does direct booking replace the portals?", a: "The portals can stay. The direct site is your channel: someone who already chose you books without a middleman, and you pay no commission on that booking." },
    { q: "Do you write the copy?", a: "We set the structure and a first draft. If the identity does not exist yet, it is better to start from the brand, so the site does not sound generic." },
    { q: "Do you only work in Valle d'Aosta?", a: "The studio is in Aosta. We build sites, especially for hotels and stays, in the valley, across Northern Italy and in the rest of Italy." },
  ],
  cta: "Talk about the website",
  related: [
    { href: "/projects/websites/residence-le-vele", label: "Residence Le Vele case study" },
    { href: "/services/brand-identity", label: "Brand and identity" },
    { href: "/agenzia-web-valle-d-aosta", label: "Web studio in Valle d'Aosta" },
  ],
};

const growthIt: ServiceDetail = {
  metaTitle: "SEO e posizionamento Google ad Aosta",
  metaDescription: "SEO tecnica, contenuti e manutenzione per siti di attività e hotel. CTRL® segue il posizionamento su Google da Aosta, in Valle d'Aosta e nel Nord Italia.",
  serviceType: "Search engine optimization",
  tag: "04",
  title: "Crescita e supporto",
  lead: "Dopo la messa online il sito deve restare veloce, comprensibile e trovabile. Misuriamo, correggiamo e lo facciamo evolvere, senza promettere la prima posizione a data fissa.",
  image: "/images/home/perche.jpg",
  imageAlt: "Paesaggio di montagna in Valle d'Aosta",
  whatTitle: "Cos'è",
  what: [
    "La SEO, per noi, non è una lista di parole incollate in una pagina. È far capire a Google, e a una persona, di cosa ti occupi, dove lavori e perché quella pagina merita un clic.",
    "Partiamo dalla tecnica: titoli, descrizioni, velocità, dati strutturati, pagine che si possono indicizzare. Poi dai contenuti che rispondono a una domanda vera, per esempio come prenotare un hotel in modo diretto o quando conviene rifare un sito.",
    "Il posizionamento in Valle d'Aosta viene prima. Poi i settori in cui siamo forti nel Nord Italia, in particolare l'ospitalità. L'Italia intera è un orizzonte di lavoro, non una pagina diversa per ogni città.",
  ],
  forTitle: "Per chi è",
  forWhom: [
    "Chi ha pubblicato un sito e non compare per le ricerche che portano contatti.",
    "Hotel che vogliono visite sul sito diretto, non solo sulle schede dei portali.",
    "Attività che pubblicano ogni tanto e hanno bisogno di qualcuno che tenga il sito in salute.",
  ],
  includedTitle: "Cosa è incluso",
  included: [
    { title: "Audit", text: "Cosa è indicizzato, cosa è lento, quali pagine mancano e quali si fanno concorrenza da sole." },
    { title: "Tecnica", text: "Titoli, descrizioni, link interni, velocità e dati strutturati sui fatti veri." },
    { title: "Contenuti", text: "Pagine che rispondono a una ricerca, scritte per una persona, non per un contatore di keyword." },
    { title: "Manutenzione", text: "Aggiornamenti, controlli e piccole evoluzioni, con un ritmo concordato." },
  ],
  processKicker: "Come si svolge",
  processTitle: "Prima le pagine che possono portare un contatto.",
  steps: [
    { title: "Audit", text: "Una lettura onesta del sito, dell'indicizzazione e dei contenuti." },
    { title: "Priorità", text: "Poche pagine, in ordine. Quelle che possono portare una richiesta o una prenotazione." },
    { title: "Interventi", text: "Tecnica e testi, poi una misura semplice: visite, query, contatti." },
    { title: "Affiancamento", text: "Un ciclo continuo, con un canone se vuoi qualcuno sempre presente." },
  ],
  timingTitle: "Tempi",
  timing: "Un audit con le prime correzioni sta in poche settimane. Il posizionamento non ha una data di consegna: i movimenti si vedono nei mesi. Non vendiamo la prima posizione. Vendiamo un lavoro continuo, con un costo legato a pagine e lingue, scritto nel preventivo.",
  faqTitle: "Domande frequenti",
  faqs: [
    { q: "Garantite la prima pagina di Google?", a: "No. Chi la garantisce sta vendendo una cosa che non controlla. Garantiamo il lavoro: tecnica pulita, pagine chiare, e un modo per vedere se visite e contatti si muovono." },
    { q: "La SEO si può fare su un sito già online?", a: "Sì. Se il sito è lento o i testi sono sbagliati, spesso conviene rifarlo e impostare la SEO insieme, invece di ottimizzare una base che non regge." },
    { q: "Fate una pagina per ogni città?", a: "No. Non pubblichiamo pagine «siti web Milano» o «siti web Torino». Scriviamo della valle, dei servizi e dei casi veri." },
    { q: "Include la pubblicità su Google?", a: "No. Residence Le Vele, nel primo mese, ha preso prenotazioni con 0 euro di ads. La pubblicità, se serve, è un'altra conversazione." },
  ],
  cta: "Parliamo di posizionamento",
  related: [
    { href: "/services/visual-communication", label: "Siti web su misura" },
    { href: "/projects/websites/residence-le-vele", label: "Caso Residence Le Vele" },
  ],
};

const growthEn: ServiceDetail = {
  metaTitle: "SEO and Google rankings in Aosta",
  metaDescription: "Technical SEO, content and maintenance for business and hotel websites. CTRL® works on Google from Aosta, for Valle d'Aosta and Northern Italy.",
  serviceType: "Search engine optimization",
  tag: "04",
  title: "Growth & support",
  lead: "After launch the site has to stay fast, understandable and findable. We measure, correct and evolve it, without promising a number-one ranking on a fixed date.",
  image: "/images/home/perche.jpg",
  imageAlt: "Mountain landscape in Valle d'Aosta",
  whatTitle: "What it is",
  what: [
    "SEO, for us, is not a list of words pasted into a page. It is making it clear to Google, and to a person, what you do, where you work and why that page deserves a click.",
    "We start with the technical layer: titles, descriptions, speed, structured data, pages that can be indexed. Then with content that answers a real question, such as how to book a hotel directly or when a website should be rebuilt.",
    "Ranking in Valle d'Aosta comes first. Then the sectors we are strong in across Northern Italy, hospitality in particular. The rest of Italy is a horizon of work, not a different page for every city.",
  ],
  forTitle: "Who it is for",
  forWhom: [
    "Anyone who published a site and does not show up for the searches that bring enquiries.",
    "Hotels that want visits on the direct site, not only on portal listings.",
    "Businesses that publish now and then and need someone to keep the site healthy.",
  ],
  includedTitle: "What is included",
  included: [
    { title: "Audit", text: "What is indexed, what is slow, which pages are missing and which compete with each other." },
    { title: "Technical work", text: "Titles, descriptions, internal links, speed and structured data about real facts." },
    { title: "Content", text: "Pages that answer a search, written for a person, not for a keyword counter." },
    { title: "Maintenance", text: "Updates, checks and small evolutions, on an agreed rhythm." },
  ],
  processKicker: "How it runs",
  processTitle: "The pages that can bring an enquiry, first.",
  steps: [
    { title: "Audit", text: "An honest read of the site, the index and the content." },
    { title: "Priority", text: "A few pages, in order. The ones that can bring a request or a booking." },
    { title: "Changes", text: "Technical fixes and words, then a simple read: visits, queries, enquiries." },
    { title: "Support", text: "An ongoing cycle, with a retainer if you want someone always there." },
  ],
  timingTitle: "Timing",
  timing: "An audit with the first corrections takes a few weeks. Rankings do not have a delivery date: movement shows up over months. We do not sell the number-one spot. We sell ongoing work, with a cost tied to pages and languages, written into the proposal.",
  faqTitle: "Common questions",
  faqs: [
    { q: "Do you guarantee the first page of Google?", a: "No. Anyone who guarantees it is selling something they do not control. We guarantee the work: clean technical SEO, clear pages, and a way to see whether visits and enquiries move." },
    { q: "Can SEO be done on a site that is already live?", a: "Yes. If the site is slow or the words are wrong, it is often better to rebuild and set up SEO together, instead of optimising a base that cannot hold." },
    { q: "Do you make a page for every city?", a: "No. We do not publish pages such as “websites Milan” or “websites Turin”. We write about the valley, the services and real cases." },
    { q: "Does this include Google ads?", a: "No. Residence Le Vele took bookings in its first month with €0 of ads. Advertising, if you need it, is a separate conversation." },
  ],
  cta: "Talk about search",
  related: [
    { href: "/services/visual-communication", label: "Custom websites" },
    { href: "/projects/websites/residence-le-vele", label: "Residence Le Vele case study" },
  ],
};

const softwareIt: ServiceDetail = {
  metaTitle: "Software e gestionali su misura ad Aosta",
  metaDescription: "Gestionali, automazioni e software su misura, oppure in abbonamento, con l'AI dove toglie un lavoro ripetitivo. CTRL®, studio ad Aosta, per la Valle d'Aosta e il Nord Italia.",
  serviceType: "Custom software",
  tag: "05",
  title: "Software e AI",
  lead: "Software costruito sui processi della tua attività, oppure un prodotto già pronto in abbonamento. L'intelligenza artificiale entra solo dove toglie un lavoro ripetitivo.",
  image: "/images/projects/software.webp",
  imageAlt: "Schermata di un software su misura",
  whatTitle: "Cos'è",
  what: [
    "Un gestionale su misura nasce dai passaggi che il team fa già: preventivi, schede cliente, turni, magazzino, report. Lo disegniamo su quei passaggi, non su un menu generico di moduli.",
    "Quando il problema è comune, non ha senso ripartire da zero. Agenda Easy è la webapp CTRL® per appuntamenti, clienti e servizi, già pronta, da 9,90 euro al mese.",
    "L'AI la usiamo in modo concreto: rispondere a domande sui tuoi documenti, smistare richieste, preparare una bozza. Non come una scritta in homepage.",
  ],
  forTitle: "Per chi è",
  forWhom: [
    "Attività che hanno superato i fogli condivisi.",
    "Studi e team che vogliono un gestionale senza piegarsi a un software generico.",
    "Chi vuole provare un prodotto in abbonamento prima di commissionare uno sviluppo.",
  ],
  includedTitle: "Cosa è incluso",
  included: [
    { title: "Processo", text: "Lettura del lavoro e dei dati che hai già, prima di scegliere gli strumenti." },
    { title: "Su misura", text: "Software scritto per i tuoi flussi, ospitato e aggiornato." },
    { title: "In abbonamento", text: "Prodotti CTRL® già pronti, come Agenda Easy, con hosting e aggiornamenti inclusi." },
    { title: "AI", text: "Modelli sui documenti e sulle richieste, con un perimetro chiaro su cosa possono leggere." },
  ],
  processKicker: "Come si svolge",
  processTitle: "Prima il processo, poi lo strumento.",
  steps: [
    { title: "Lettura", text: "Come lavora il team oggi, e dove perde tempo ogni settimana." },
    { title: "Scelta", text: "Un prodotto in abbonamento se copre il lavoro. Uno sviluppo se i flussi sono solo tuoi." },
    { title: "Costruzione", text: "Lo strumento, le integrazioni che servono, e l'AI solo sul pezzo ripetitivo." },
    { title: "Uso", text: "Formazione breve a chi lo usa, e un modo per segnalare cosa non torna." },
  ],
  timingTitle: "Tempi",
  timing: "Un'automazione singola può stare in poche settimane. Un gestionale con più ruoli si misura sui flussi, e il preventivo arriva dopo averli visti. I prodotti in abbonamento si attivano senza un progetto su misura: il prezzo pubblico è quello scritto nella pagina del prodotto.",
  faqTitle: "Domande frequenti",
  faqs: [
    { q: "I miei dati finiscono in un modello pubblico?", a: "No. Definiamo cosa può essere letto e cosa resta solo tuo. Se un flusso non deve uscire dall'azienda, non esce." },
    { q: "Meglio su misura o in abbonamento?", a: "Se Agenda Easy copre il lavoro, parti da lì. Se i flussi sono tuoi e di nessun altro, lo costruiamo." },
    { q: "Fate anche il sito?", a: "Sì, è un altro servizio. Quando gestionale e sito devono parlarsi, li progettiamo perché non diventino due mondi separati." },
    { q: "Lavorate da remoto?", a: "La sede è ad Aosta. Il software lo seguiamo in Valle d'Aosta, nel Nord Italia e nel resto d'Italia." },
  ],
  cta: "Parliamo del software",
  related: [
    { href: "/projects/webapps/agenda-easy", label: "Agenda Easy, da 9,90 € al mese" },
    { href: "/services/product-development", label: "Web app su misura" },
  ],
};

const softwareEn: ServiceDetail = {
  metaTitle: "Custom software and internal tools in Aosta",
  metaDescription: "Custom internal tools, automations and subscription software, with AI where it removes repetitive work. CTRL®, the Aosta studio, for Valle d'Aosta and Northern Italy.",
  serviceType: "Custom software",
  tag: "05",
  title: "Software & AI",
  lead: "Software built on your business processes, or a product that is already ready on subscription. Artificial intelligence comes in only where it removes repetitive work.",
  image: "/images/projects/software.webp",
  imageAlt: "A screen from a custom piece of software",
  whatTitle: "What it is",
  what: [
    "A custom internal tool starts from the steps the team already takes: quotes, client records, shifts, stock, reports. We design it around those steps, not around a generic menu of modules.",
    "When the problem is a common one, there is no point starting from zero. Agenda Easy is the CTRL® web app for appointments, clients and services, ready now, from €9.90 a month.",
    "We use AI in a concrete way: answer questions about your documents, sort requests, prepare a draft. Not as a line on the homepage.",
  ],
  forTitle: "Who it is for",
  forWhom: [
    "Businesses that have outgrown shared spreadsheets.",
    "Studios and teams that want an internal tool without bending to generic software.",
    "Anyone who wants to try a subscription product before commissioning a build.",
  ],
  includedTitle: "What is included",
  included: [
    { title: "Process", text: "A read of the work and the data you already have, before choosing the tools." },
    { title: "Custom", text: "Software written for your flows, hosted and kept up to date." },
    { title: "Subscription", text: "CTRL® products that are already ready, such as Agenda Easy, with hosting and updates included." },
    { title: "AI", text: "Models on documents and requests, with a clear boundary around what they can read." },
  ],
  processKicker: "How it runs",
  processTitle: "The process first, then the tool.",
  steps: [
    { title: "Read", text: "How the team works today, and where time disappears every week." },
    { title: "Choose", text: "A subscription product if it covers the work. A build if the flows are yours alone." },
    { title: "Build", text: "The tool, the integrations that matter, and AI only on the repetitive part." },
    { title: "Use", text: "A short handover for the people who use it, and a way to flag what does not fit." },
  ],
  timingTitle: "Timing",
  timing: "A single automation can take a few weeks. An internal tool with several roles is measured on the flows, and the proposal comes after we have seen them. Subscription products switch on without a custom project: the public price is the one written on the product page.",
  faqTitle: "Common questions",
  faqs: [
    { q: "Do my data end up in a public model?", a: "No. We define what can be read and what stays yours alone. If a flow must not leave the company, it does not leave." },
    { q: "Is custom or subscription the better start?", a: "If Agenda Easy covers the work, start there. If the flows are yours and nobody else's, we build them." },
    { q: "Do you also build the website?", a: "Yes, that is another service. When the tool and the site need to talk, we design them so they do not become two separate worlds." },
    { q: "Do you work remotely?", a: "The studio is in Aosta. We follow the software in Valle d'Aosta, across Northern Italy and in the rest of Italy." },
  ],
  cta: "Talk about the software",
  related: [
    { href: "/projects/webapps/agenda-easy", label: "Agenda Easy, from €9.90 a month" },
    { href: "/services/product-development", label: "Custom web apps" },
  ],
};

export const serviceDetails: Record<string, Record<Locale, ServiceDetail>> = {
  "brand-identity": { it: brandIt, en: brandEn },
  "product-development": { it: productIt, en: productEn },
  "visual-communication": { it: visualIt, en: visualEn },
  "growth-support": { it: growthIt, en: growthEn },
  "software-ai": { it: softwareIt, en: softwareEn },
};

export function getServiceDetail(slug: string, lang: Locale): ServiceDetail | null {
  return serviceDetails[slug]?.[lang] ?? null;
}

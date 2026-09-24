import type { Role } from '@/types/user';

/**
 * Spotlight rondleiding — the first-login walk-through. Each stop opens a page
 * and rings one element tagged `data-tour="<target>"` in that view, so a
 * non-technical user sees the actual button rather than reading about it.
 *
 * `target` matches as a word in the attribute (`[data-tour~=…]`), and the first
 * *visible* match wins — that is how "nav" resolves to the sidebar on desktop
 * and the Menu button on a phone. A stop whose target isn't on screen (no
 * drafts yet, empty table) still shows, as a centred card.
 *
 * `roles` limits a stop to roles that can use it; `teamLeaders` additionally
 * admits a Teamlid with the Teamleider flag. Omit both for everyone.
 */
export interface TourStop {
  id: string;
  route: string;
  target?: string;
  title: string;
  body: string;
  roles?: Role[];
  teamLeaders?: boolean;
}

const STAFF: Role[] = ['Administrator', 'TeamManager'];
const ADMIN: Role[] = ['Administrator'];
const MEMBER: Role[] = ['TeamMember'];

export const tourStops: TourStop[] = [
  // --- Iedereen: basis ---------------------------------------------------
  {
    id: 'nav',
    route: '/dashboard',
    target: 'nav',
    title: 'Het menu',
    body: 'Hier vind je alle pagina’s. Je ziet enkel wat bij jouw rol past. Klik op een naam om naar die pagina te gaan.',
  },
  {
    id: 'dashboard',
    route: '/dashboard',
    target: 'dashboard-cards',
    title: 'Overzicht',
    body: 'Je startpagina. Hier zie je in één oogopslag je shifts en wat er nog op goedkeuring wacht.',
    roles: MEMBER,
  },
  {
    id: 'dashboard-staff',
    route: '/dashboard',
    target: 'dashboard-cards',
    title: 'Overzicht',
    body: 'De cijfers van deze week: wie vandaag werkt, hoeveel shifts er zijn, open leads en wat jij nog moet beoordelen.',
    roles: STAFF,
  },

  // --- Teamlid: eigen planning ------------------------------------------
  {
    id: 'add-shift',
    route: '/mijn-planning',
    target: 'add-shift',
    title: 'Stap 1 — Shift toevoegen',
    body: 'Klik hier om een dag in te plannen. Kies D2D of Straat; de uren vullen zich vanzelf in.',
    roles: MEMBER,
  },
  {
    id: 'availability',
    route: '/mijn-planning',
    target: 'availability',
    title: 'Beschikbaar melden',
    body: 'Kan je een dag werken? Klik op "Beschikbaar?". Hij wordt groen: "✓ Beschikbaar". Nog eens klikken haalt het weg.',
    roles: MEMBER,
  },
  {
    id: 'submit-week',
    route: '/mijn-planning',
    target: 'submit-week',
    title: 'Stap 2 — Week indienen',
    body: 'Nieuwe shifts zijn eerst een "Concept". Pas als je op "Week indienen" klikt, gaan ze naar de beheerder. Deze knop verschijnt zodra je een shift hebt toegevoegd.',
    roles: MEMBER,
  },

  // --- Staff: planning & rooster ----------------------------------------
  {
    id: 'new-shift',
    route: '/planning',
    target: 'new-shift',
    title: 'Shift aanmaken',
    body: 'Klik hier om iemand in te plannen: kies datum, medewerker en type (D2D, Straat of Event).',
    roles: STAFF,
  },
  {
    id: 'planning-list',
    route: '/planning',
    target: 'planning-list',
    title: 'Indienen en goedkeuren',
    body: 'Nieuwe shifts staan op "Concept". Klik op "Indienen" in de rij om ze ter goedkeuring te sturen.',
    roles: ['TeamManager'],
  },
  {
    id: 'planning-list-admin',
    route: '/planning',
    target: 'planning-list',
    title: 'Indienen en goedkeuren',
    body: 'Shifts "In afwachting" keur je hier goed met "Goedkeuren" of wijs je af met "Afwijzen" (met een reden).',
    roles: ADMIN,
  },
  {
    id: 'planning-tabs',
    route: '/planning',
    target: 'planning-tabs',
    title: 'Lijst, maand of beschikbaarheid',
    body: '"Maand" toont de kalender, "Beschikbaarheid" wie zich beschikbaar meldde. Handig om te zien wie je nog kan inplannen.',
    roles: STAFF,
  },
  {
    id: 'add-employee',
    route: '/employees',
    target: 'add-employee',
    title: 'Medewerker toevoegen',
    body: 'Zet iemand op het rooster zodat hij of zij ingepland kan worden. Keur de persoon eerst goed onder Gebruikers.',
    roles: ADMIN,
  },
  {
    id: 'employee-search',
    route: '/employees',
    target: 'employee-search',
    title: 'Medewerkers zoeken',
    body: 'Het rooster van je kantoor. Zoek hier op naam of e-mail.',
    roles: ['TeamManager'],
  },

  // --- Rekrutering ------------------------------------------------------
  {
    id: 'funnel',
    route: '/recruitment',
    target: 'funnel',
    title: 'Rekrutering',
    body: 'Hoeveel kandidaten zitten in elke fase, van "Nieuw" tot "Aangenomen".',
  },
  {
    id: 'add-lead',
    route: '/recruitment',
    target: 'add-lead',
    title: 'Kandidaat toevoegen',
    body: 'Nieuwe kandidaat? Klik hier. Naam en leeftijd zijn verplicht. Vul meteen "Geworven door" in — dat kan achteraf niet meer.',
    roles: STAFF,
  },
  {
    id: 'lead-table',
    route: '/recruitment',
    target: 'lead-table',
    title: 'Kandidaat opvolgen',
    body: 'Verander de fase van een kandidaat met de keuzelijst achteraan de rij. Dat wordt meteen opgeslagen.',
    roles: STAFF,
  },
  {
    id: 'lead-table-member',
    route: '/recruitment',
    target: 'lead-table',
    title: 'Kandidaten bekijken',
    body: 'Je kan alle kandidaten bekijken. Klik op een e-mail of telefoonnummer om ze te contacteren.',
    roles: MEMBER,
  },

  // --- Locaties ---------------------------------------------------------
  {
    id: 'map',
    route: '/locations',
    target: 'map',
    title: 'De kaart',
    body: 'Oranje = gepland, blauw = gereserveerd, groen = bezocht. Klik op een plek voor details.',
  },
  {
    id: 'draw-tools',
    route: '/locations',
    target: 'draw-tools',
    title: 'Plekken en zones toevoegen',
    body: '"Punt" zet één plek op de kaart. "Zone" en "Straat": tik de punten op de kaart en klik "Voltooien".',
    roles: STAFF,
    teamLeaders: true,
  },
  {
    id: 'location-table',
    route: '/locations',
    target: 'location-table',
    title: 'Bezoek loggen',
    body: 'Ben je ergens gaan werven? Klik "Bezoek loggen" bij die plek, dan weet iedereen dat je er geweest bent.',
  },

  // --- Geschiedenis -----------------------------------------------------
  {
    id: 'history',
    route: '/history',
    target: 'history-table',
    title: 'Geschiedenis',
    body: 'Je shifts per maand: hoeveel er waren en hoeveel goedgekeurd.',
  },

  // --- Beheer -----------------------------------------------------------
  {
    id: 'invite',
    route: '/users',
    target: 'invite',
    title: 'Iemand uitnodigen',
    body: 'Typ het e-mailadres en klik "Uitnodiging versturen". De persoon krijgt een link om een account te maken.',
    roles: ADMIN,
  },
  {
    id: 'user-filters',
    route: '/users',
    target: 'user-filters',
    title: 'Goedkeuren',
    body: 'Nieuwe mensen staan hier als "In afwachting". Klik op ⋮ → "Rol toewijzen" om ze toegang te geven, en zet ze daarna op het rooster onder Medewerkers.',
    roles: ADMIN,
  },
  {
    id: 'audit',
    route: '/audit',
    target: 'audit-table',
    title: 'Audit trail',
    body: 'Alles wat in de app gebeurt, met wie en wanneer. Alleen-lezen.',
    roles: ADMIN,
  },

  // --- Iedereen: afsluiter ----------------------------------------------
  {
    id: 'account',
    route: '/dashboard',
    target: 'account',
    title: 'Hulp nodig?',
    body: 'Via je naam vind je "Instellingen" en "Handleiding & FAQ". Daar kan je deze rondleiding altijd opnieuw starten.',
  },
];

export function tourForUser(role: Role | null, isTeamLeader = false): TourStop[] {
  return tourStops.filter(
    (s) =>
      (!s.roles && !s.teamLeaders) ||
      (!!role && !!s.roles?.includes(role)) ||
      (!!s.teamLeaders && isTeamLeader),
  );
}

import type { Role } from '@/types/user';

/**
 * Handleiding content — shown in Instellingen → Handleiding and stepped
 * through by the first-login WelcomeTutorial. One chapter per page of the app.
 *
 * `roles` limits a chapter or a single step to the roles that can actually
 * use it, so a Teamlid is never walked through a button they don't have.
 * Omit it for "everyone". Keep the wording in sync with the exact Dutch UI
 * labels in the views — the tutorial quotes them.
 */
export interface TutorialStep {
  text: string;
  roles?: Role[];
}

export interface TutorialChapter {
  id: string;
  icon: string;
  title: string;
  /** One-liner for the welcome carousel. */
  summary: string;
  /** Page the chapter is about; the welcome carousel offers a jump there. */
  to?: string;
  roles?: Role[];
  steps: TutorialStep[];
}

const STAFF: Role[] = ['Administrator', 'TeamManager'];
const ADMIN: Role[] = ['Administrator'];
const MEMBER: Role[] = ['TeamMember'];

export const tutorialChapters: TutorialChapter[] = [
  {
    id: 'start',
    icon: '★',
    title: 'Aan de slag',
    summary: 'Menu, rollen en je account — de basis in één minuut.',
    steps: [
      {
        text: 'Links zie je het menu (op je gsm: de knop rechtsboven). Je ziet enkel de pagina’s die bij jouw rol passen: Teamlid, Teammanager of Beheerder.',
      },
      {
        text: '"Teamleider" is geen aparte rol maar een extra vinkje bovenop je rol. Teamleiders kunnen onder meer zones beheren op de Locaties-kaart.',
      },
      {
        text: 'Klik onderaan het menu op je naam voor "Instellingen", deze "FAQ" en "Uitloggen".',
      },
      {
        text: 'Vink bij het aanmelden "Aangemeld blijven" aan om tot 7 dagen ingelogd te blijven. Zonder vinkje word je uitgelogd zodra je de browser sluit.',
      },
      {
        text: 'Wachtwoord vergeten? Klik op het inlogscherm op "Wachtwoord vergeten?" en je krijgt een reset-link per mail.',
      },
      {
        text: 'Als Beheerder zie je onder het logo een "Kantoor"-keuzelijst (zodra er meer dan één kantoor is). Alles wat je ziet — planning, medewerkers, leads, locaties, audit — volgt dat kantoor.',
        roles: ADMIN,
      },
    ],
  },
  {
    id: 'dashboard',
    icon: '▦',
    title: 'Overzicht',
    summary: 'Je startpagina met de cijfers die er vandaag toe doen.',
    to: '/dashboard',
    steps: [
      {
        text: '"Shifts voltooid" telt je goedgekeurde shifts in het verleden, "Wacht op goedkeuring" je ingediende shifts die nog beoordeeld moeten worden.',
        roles: MEMBER,
      },
      {
        text: '"Aankomende shifts" toont enkel goedgekeurde shifts vanaf vandaag. Staat een shift er niet? Dan is hij nog niet goedgekeurd.',
        roles: MEMBER,
      },
      {
        text: 'De kaarten tonen deze week: "Vandaag ingepland", "Shifts deze week", "Open leads" en "Wacht op goedkeuring".',
        roles: STAFF,
      },
      {
        text: '"Deze week in één oogopslag" toont per dag hoeveel mensen ingepland staan; "Huidige funnel" toont hoeveel leads in elke rekruteringsfase zitten.',
        roles: STAFF,
      },
    ],
  },
  {
    id: 'my-planning',
    icon: '▣',
    title: 'Mijn planning',
    summary: 'Plan je week, geef je beschikbaarheid door en dien in.',
    to: '/mijn-planning',
    roles: MEMBER,
    steps: [
      {
        text: 'Je ziet de huidige week, maandag tot zondag. Klik op "+ Dag toevoegen" of op het "+" bij een dag om een shift toe te voegen.',
      },
      {
        text: 'Kies het type: "D2D (deur-tot-deur)" (11:00–19:00) of "Straat" (09:30–17:00). De uren worden automatisch ingevuld. Een locatie is optioneel.',
      },
      {
        text: 'Nieuwe shifts staan eerst op "Concept". Pas als je op "Week indienen" klikt, gaan al je concepten in één keer naar de beheerder ter goedkeuring.',
      },
      {
        text: 'Een concept verwijderen kan met "Verwijderen" — de app vraagt eerst om bevestiging.',
      },
      {
        text: 'Klik op "Beschikbaar?" bij een dag om te laten weten dat je die dag kan werken (wordt "✓ Beschikbaar"). Nog eens klikken haalt het weg. Dit is los van je shifts.',
      },
      {
        text: 'Statussen: "Concept" → "In afwachting" → "Goedgekeurd" of "Afgewezen". Is een shift afgewezen, vraag dan je teammanager naar de reden.',
      },
    ],
  },
  {
    id: 'planning',
    icon: '▣',
    title: 'Planning',
    summary: 'Shifts aanmaken, indienen en goedkeuren voor je kantoor.',
    to: '/planning',
    roles: STAFF,
    steps: [
      {
        text: 'Klik op "+ Nieuwe shift". Kies datum, medewerker en type: "D2D" (11:00–19:00), "Straat" (09:30–17:00) of "Event" (vrije uren, met optionele titel).',
      },
      {
        text: 'Enkel actieve medewerkers uit Medewerkers staan in de lijst. Iemand ontbreekt? Voeg die persoon eerst toe onder Medewerkers.',
      },
      {
        text: 'Een medewerker kan geen twee overlappende shifts op dezelfde dag hebben — de app houdt dat tegen.',
      },
      {
        text: 'Nieuwe shifts starten als "Concept". Klik op "Indienen" om ze ter goedkeuring te sturen, of op "Verwijderen" (de app vraagt eerst om bevestiging).',
        roles: ADMIN,
      },
      {
        text: 'Nieuwe shifts starten als "Concept". Klik op "Indienen" om ze ter goedkeuring te sturen.',
        roles: ['TeamManager'],
      },
      {
        text: 'Shifts "In afwachting" keur je goed met "Goedkeuren" of wijs je af met "Afwijzen". Bij afwijzen kan je een reden meegeven die de teammanager ziet.',
        roles: ADMIN,
      },
      {
        text: 'Goedkeuren en afwijzen is voorbehouden aan de Beheerder. Jij maakt en dient in; de Beheerder beslist.',
        roles: ['TeamManager'],
      },
      {
        text: 'Tab "Lijst": shifts per dag. Tab "Maand": kalender met per dag het aantal shifts, teamleiders ("TL") en wachtende shifts — klik een dag om de lijst daarop te filteren.',
      },
      {
        text: 'Tab "Beschikbaarheid": per week wie zich beschikbaar heeft gemeld. Handig om te zien wie je nog kan inplannen.',
      },
    ],
  },
  {
    id: 'employees',
    icon: '♙',
    title: 'Medewerkers',
    summary: 'Het rooster van je kantoor: wie kan ingepland worden.',
    to: '/employees',
    roles: STAFF,
    steps: [
      {
        text: 'Zoek op naam of e-mail. Vink "Toon inactieve" aan om ook gedeactiveerde medewerkers te zien.',
      },
      {
        text: 'Je kan dit rooster bekijken; toevoegen en wijzigen doet de Beheerder.',
        roles: ['TeamManager'],
      },
      {
        text: '"+ Medewerker toevoegen": kies een account dat al goedgekeurd is voor dit kantoor. Naam en e-mail worden ingevuld, telefoon is optioneel.',
        roles: ADMIN,
      },
      {
        text: 'Staat het account er niet tussen? Keur de persoon dan eerst goed via Gebruikers → "Rol toewijzen".',
        roles: ADMIN,
      },
      {
        text: '"Bewerken" past naam, e-mail en telefoon aan. Rol en teamleider wijzig je via Gebruikers.',
        roles: ADMIN,
      },
      {
        text: '"Deactiveren" haalt iemand van het rooster (niet meer inplanbaar). Het blokkeert het inloggen níet — dat doe je in Gebruikers.',
        roles: ADMIN,
      },
    ],
  },
  {
    id: 'recruitment',
    icon: '◎',
    title: 'Rekrutering',
    summary: 'Leads opvolgen van eerste contact tot aanwerving.',
    to: '/recruitment',
    steps: [
      {
        text: 'Je kan alle leads en de funnel bekijken, maar niets wijzigen.',
        roles: MEMBER,
      },
      {
        text: 'Bovenaan zie je de funnel: "Nieuw", "Gecontacteerd", "Sollicitatie gepland", "Opgekomen" en "Aangenomen". Met de tabs filter je de tabel op fase.',
      },
      {
        text: '"+ Lead toevoegen": naam en leeftijd zijn verplicht; e-mail, telefoon, notities en "Geworven door" zijn optioneel. Kies de bron (WhatsApp, Instagram, Website, Doorverwijzing, Anders).',
        roles: STAFF,
      },
      {
        text: 'Vul "Geworven door" meteen in bij het aanmaken — dat kan achteraf niet meer, en het telt mee in "Prestatie per werver".',
        roles: STAFF,
      },
      {
        text: 'Verplaats een lead met de fase-keuzelijst in de laatste kolom. Dat wordt meteen opgeslagen, zonder bevestiging.',
        roles: STAFF,
      },
      {
        text: '"Straatstatus" (Nog niet bepaald, Gepland, Niet gekomen, Aangenomen) volgt straatwervingen op en staat los van de fase.',
        roles: STAFF,
      },
      {
        text: 'Opkomst, No-show en Conversie tonen hoe goed de funnel draait; "Prestatie per bron" en "Prestatie per werver" tonen waar je beste kandidaten vandaan komen.',
        roles: STAFF,
      },
      {
        text: 'Klik op een e-mailadres of telefoonnummer om de kandidaat meteen te mailen of te bellen.',
      },
    ],
  },
  {
    id: 'locations',
    icon: '⌖',
    title: 'Locaties',
    summary: 'De kaart met wervingsplekken, zones en straten.',
    to: '/locations',
    steps: [
      {
        text: 'Kleuren op de kaart: oranje = "Gepland", blauw = "Gereserveerd", groen = "Bezocht". Filter op naam, vorm of status boven de kaart.',
      },
      {
        text: 'Klik een punt, zone of rij in de tabel om de details te openen.',
      },
      {
        text: 'Ben je ergens gaan werven? Klik "Bezoek loggen". Je bezoek wordt geregistreerd; de status verandert daardoor niet vanzelf.',
      },
      {
        text: '"📍 Punt plaatsen": klik daarna op de kaart om daar een locatie toe te voegen.',
        roles: STAFF,
      },
      {
        text: '"⬠ Zone tekenen": tik minstens 3 hoekpunten op de kaart en klik "Voltooien". "〰 Straat tekenen": tik langs de straat (minstens 2 punten) en klik "Voltooien". Fout getikt? "Punt terug" haalt het laatste punt weg. Geef daarna een naam en kleur.',
        roles: STAFF,
      },
      {
        text: 'In het detailpaneel wijzig je de status, pas je met "Zone vorm aanpassen" de hoekpunten aan, of kies je "Bewerken". Let op: "Verwijderen" gebeurt meteen, zonder bevestiging.',
        roles: STAFF,
      },
      {
        text: 'Ben je Teamleider? Dan kan je ook punten plaatsen, zones en straten tekenen en locaties bewerken, en zien hoe vaak een plek bezocht is.',
        roles: MEMBER,
      },
    ],
  },
  {
    id: 'history',
    icon: '◷',
    title: 'Geschiedenis',
    summary: 'Terugblik op shifts per maand.',
    to: '/history',
    steps: [
      {
        text: 'Je ziet al je eigen shifts per maand: hoeveel er waren en hoeveel goedgekeurd.',
        roles: MEMBER,
      },
      {
        text: 'Je ziet de laatste 6 maanden: shifts, goedgekeurde shifts en het aantal actieve teamleiders per maand, met ▲/▼ tegenover de maand ervoor.',
        roles: STAFF,
      },
    ],
  },
  {
    id: 'users',
    icon: '☺',
    title: 'Gebruikers',
    summary: 'Nieuwe mensen uitnodigen, goedkeuren en rollen toewijzen.',
    to: '/users',
    roles: ADMIN,
    steps: [
      {
        text: '"Uitnodiging versturen" stuurt een aanmeldlink naar het kantoor dat je bovenaan geselecteerd hebt. Er kunnen ongeveer 5 uitnodigingen per dag vertrekken.',
      },
      {
        text: 'Wie zich aanmeldt, verschijnt met de badge "In afwachting". Staat er "⚠ ander kantoor", schakel dan eerst naar dat kantoor via de Kantoor-keuzelijst.',
      },
      {
        text: 'Goedkeuren = ⋮ → "Rol toewijzen": kies Teamlid, Teammanager of Beheerder, optioneel een functie en het vinkje "Teamleider", en klik "Opslaan".',
      },
      {
        text: 'Vergeet daarna niet de persoon toe te voegen onder Medewerkers — anders kan hij of zij niet ingepland worden of als werver gekozen worden.',
      },
      {
        text: '"Deactiveren" logt iemand meteen uit en blokkeert de toegang (zonder bevestiging); "Heractiveren" draait dat terug. "Verwijderen" wist het profiel na bevestiging — de persoon kan later opnieuw uitgenodigd worden.',
      },
      {
        text: 'Klik een rij voor de detailpagina: contactgegevens kopiëren, mailen of bellen, en de rol bewerken. De laatste beheerder van een kantoor kan je niet wegnemen.',
      },
    ],
  },
  {
    id: 'audit',
    icon: '⎘',
    title: 'Audit trail',
    summary: 'Wie deed wat en wanneer — alleen-lezen.',
    to: '/audit',
    roles: ADMIN,
    steps: [
      {
        text: 'Elke actie in de app (shifts, rollen, medewerkers, leads, locaties, beschikbaarheid) wordt hier gelogd met tijdstip en wie het deed.',
      },
      {
        text: 'Je ziet de 200 meest recente vermeldingen van het geselecteerde kantoor. Niets kan bewerkt of verwijderd worden.',
      },
    ],
  },
  {
    id: 'settings',
    icon: '⚙',
    title: 'Instellingen',
    summary: 'Je eigen gegevens: e-mail, telefoon, verificatie.',
    to: '/settings',
    steps: [
      {
        text: 'Onder "Mijn gegevens" zie je je naam, rol en kantoor. Die wijzigt een beheerder voor je.',
      },
      {
        text: 'E-mail wijzigen: klik "Wijzigen", geef het nieuwe adres en je huidige wachtwoord. De wijziging is pas definitief na het klikken op de link in je nieuwe mailbox.',
      },
      {
        text: 'Staat je e-mail op "Niet geverifieerd"? Klik "Verificatiemail versturen" en bevestig via de link in je inbox.',
        roles: ['TeamManager', 'TeamMember'],
      },
      {
        text: 'Telefoonnummer toevoegen of aanpassen doe je bij Telefoon met "+ Toevoegen" of "Bewerken".',
      },
    ],
  },
];

/** Chapters and steps visible to `role`; chapters left without steps are dropped. */
export function chaptersForRole(role: Role | null): TutorialChapter[] {
  const allowed = (roles?: Role[]) => !roles || (!!role && roles.includes(role));
  return tutorialChapters
    .filter((c) => allowed(c.roles))
    .map((c) => ({ ...c, steps: c.steps.filter((s) => allowed(s.roles)) }))
    .filter((c) => c.steps.length > 0);
}

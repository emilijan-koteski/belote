// Beljot · Rules content — Croatian (authored; ijekavian, Belote terminology).
import type { RulesLangData } from "./types";

export const hr: RulesLangData = {
  cardNames: {
    J: "Dečko",
    "9": "Devetka",
    A: "As",
    "10": "Desetka",
    K: "Kralj",
    Q: "Baba",
    "8": "Osmica",
    "7": "Sedmica",
  },
  trumpNotes: { J: "Najjača u adutu", "7": "Najslabija" },
  plainNotes: { A: "Najjača izvan aduta", "7": "Najslabija" },

  declarations: {
    belot: {
      name: "Belot / Rebelot",
      summary: "Kralj i Baba u adutu, oboje u istoj ruci.",
      detail:
        "Baba je Belot, Kralj je Rebelot — svako najavljuješ kad ga odigraš. Par se uvijek plaća, čak i kad protivnički tim drži nešto veće; stoji sam za sebe, izvan natjecanja.",
    },
    terca: {
      name: "Terca",
      summary: "Tri karte u nizu, sve iste boje.",
      detail: "Za najave redoslijed ide 7, 8, 9, 10, Dečko, Baba, Kralj, As — i nema vraćanja od Asa natrag na 7.",
    },
    kvarta: {
      name: "Kvarta",
      summary: "Četiri karte u nizu, sve iste boje.",
      detail: "Kvarta uvijek pobjeđuje bilo koju tercu koju drži drugi tim, bez obzira na boje.",
    },
    kvinta: {
      name: "Kvinta",
      summary: "Pet ili više karata u nizu, ista boja.",
      detail:
        "Bilo koji niz od pet ili više u jednoj boji vrijedi 100. Dulji niz ne nosi više od peterokartnog.",
    },
    carre: {
      name: "Kare",
      summary: "Sve četiri iste vrijednosti — samo Desetke, Babe, Kraljevi ili Asovi.",
      detail:
        "Četiri iste od jedne od ovih vrijednosti. Karei od devetki i dečki nose više i boduju se zasebno.",
    },
    carre9: {
      name: "Kare devetki",
      summary: "Sve četiri devetke.",
      detail:
        "Devetka u adutu je druga najjača karta u špilu — pa potpuni kare devetki plaća se jedan i pol put više od običnog karea.",
    },
    carreJ: {
      name: "Kare dečki",
      summary: "Sva četiri dečka.",
      detail:
        "Najveća pojedinačna najava u igri. Dobiti sva četiri dečka u svojih osam karata je rijetko — većina igrača to vidi tek nekoliko puta u cijeloj sezoni.",
    },
  },

  sections: [
    {
      id: "goal",
      label: "Cilj",
      title: "Utrkuj se s timom do 1001",
      lede: "Ti i tvoj partner dijelite jedan rezultat. Prvi tim do 1001 osvaja meč.",
      blocks: [
        {
          kind: "p",
          text: "Sjediš nasuprot svom partneru, vas dvoje protiv para s obje strane. Dijelite jedan zajednički rezultat i ništa se ne resetira između odigranih ruku — bodovi se samo gomilaju dok netko ne prijeđe 1001. Većina mečeva završi u 6 do 12 ruku.",
        },
        {
          kind: "p",
          text: "Postoje dva načina da osvojiš bodove. Osvoji štihove i skupljaš bodove ispisane na svakoj karti koju uzmeš. Drži prave karte i možeš najaviti kombinacije — niz od četiri u jednoj boji, ili Kralja i Babu u adutu zajedno — za bonus povrh toga. Štihovi su tvoj stalni prihod; najave su veliki preokreti koji znaju promijeniti tok cijelog meča.",
        },
      ],
    },
    {
      id: "basics",
      label: "Priprema",
      title: "Promiješaj, podijeli, uzmi adut",
      lede: "Četiri igrača, 32 karte, osam u ruci i brzi krug da se odredi koja je boja adut.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              t: "Sjedni na svoje mjesto",
              d: "Sjediš točno nasuprot svom partneru; dvojica protivnika zauzimaju stolice s obje strane. Igra se kreće udesno oko stola.",
            },
            {
              t: "Sastavi špil",
              d: "Beljot se igra s 32 karte. Uzmi obični špil i izbaci sve od 2 do 6. Ono što ostaje — 7, 8, 9, 10, Dečko, Baba, Kralj i As u sve četiri boje — je ono čime igraš.",
            },
            {
              t: "Podijeli prvih pet",
              d: "Djelitelj obilazi dvaput — po tri karte, pa dvije — pa svatko počinje s pet u ruci. Ostatak špila ostaje licem prema dolje na sredini.",
            },
            {
              t: "Otvori adut",
              d: "Djelitelj okreće sljedeću kartu sa špila licem prema gore. Redom, svaki igrač može je uzeti — čineći njezinu boju adutom za tu ruku — ili propustiti. Čim je netko uzme, ta je boja adut i djelitelj dijeli ostatak karata dok svatko ne drži osam. Adut pobjeđuje sve iz druge tri boje, bez obzira na rang.",
            },
          ],
        },
      ],
    },
    {
      id: "cards",
      label: "Vrijednost karata",
      title: "Adut igra po vlastitim pravilima",
      lede: "U adutu, Dečko i devetka postaju najjači. Za sve druge boje vrijedi redoslijed izvan aduta.",
      blocks: [
        {
          kind: "p",
          text: "Svaka karta radi dvije stvari. Njezina snaga određuje tko nosi štih; njezina vrijednost u bodovima dodaje se tvom rezultatu ako je osvojiš. To dvoje nije uvijek isto — karta može biti jaka a ništa ne vrijediti, ili slaba a nositi puno bodova.",
        },
        {
          kind: "p",
          text: "U tri obične boje, redoslijed je poznat: As na vrhu, pa 10, Kralj, Baba, Dečko i naniže. No čim jedna boja postane adut, dvije karte skaču gore. Dečko u adutu postaje najjača karta u cijelom špilu, a devetka u adutu odmah iza njega. As i desetka u adutu padaju na treće i četvrto mjesto. Brzo prebacivanje između ova dva redoslijeda najveći je dio igre.",
        },
        { kind: "cards" },
        {
          kind: "note",
          text: "Zbroji sve karte u špilu i dobiješ 152 boda. Osvoji posljednji štih u ruci i uzimaš još 10 (bonus za “posljednji štih”), pa je na stolu 162 boda u svakoj ruci prije nego što se dodaju najave.",
        },
      ],
    },
    {
      id: "play",
      label: "Igranje štiha",
      title: "Kada što smiješ baciti",
      lede: "Rijetko si slobodan baciti što želiš. Tri kratka pravila pokrivaju gotovo svaki potez.",
      blocks: [
        {
          kind: "p",
          text: "Štih je po jedna karta od svakog od četvorice igrača, redom. Tko nosi štih skuplja sve četiri karte u hrpu svog tima i vodi sljedeći. Osam štihova i ruka je gotova.",
        },
        {
          kind: "rule",
          title: "Prati boju koja je izašla — i nadbij je ako možeš",
          text: "Ako je izašlo srce, moraš baciti srce kad god ga imaš. I ne smiješ se izvući: ako držiš srce veće od najvećeg koje je već na stolu, dužan si ga baciti. Tek kad su sva tvoja srca manja smiješ pustiti manje.",
        },
        {
          kind: "rule",
          title: "Nemaš u boji? Moraš rezati — i nadrezati ako možeš",
          text: "Ne možeš pratiti boju ali još držiš adut? Dužan si rezati. I ako je adut već bačen, moraš ga nadbiti većim kada možeš; samo ako su svi tvoji aduti manji smiješ baciti mali adut. Najveći adut na stolu nosi štih.",
        },
        {
          kind: "rule",
          title: "Rezano adutom? Praćenje boje ipak je prvo",
          text: "Čak i nakon što je štih rezan adutom, igrač koji može pratiti izašlu boju ipak je mora pratiti — i ipak je mora pokušati nadbiti: baci svoju najveću kartu te boje ako pobjeđuje ono na stolu, inače manju. Za adut posežeš tek kad si potpuno bez izašle boje, čak i kad već znaš da je adut osvojio štih.",
        },
        {
          kind: "p",
          text: "Nemaš kartu izašle boje ni adut? Baci što želiš. Ta karta ne može osvojiti štih — samo je pokupi onaj tko ga nosi.",
        },
      ],
    },
    {
      id: "melds",
      label: "Najave",
      title: "Neke ruke nose bodove same po sebi",
      lede: "Padni na pravu kombinaciju u podijeljenoj ruci i ona nosi bodove sama po sebi — najavljuješ je na svom redu u prvom štihu, pa je otkrivaš na početku drugog.",
      blocks: [
        {
          kind: "p",
          text: "Čim su karte podijeljene i adut određen, provjeri ruku za najave: nizove karata u nizu u jednoj boji, četiri iste, i par Kralj-i-Baba u adutu — Baba je Belot, Kralj je Rebelot. Najava se radi na tvom redu u prvom štihu, dok igraš kartu — a zatim slažeš karte licem prema gore za sve na početku drugog štiha. Belot i Rebelot su iznimka — svako najavljuješ kad igraš tu kartu tijekom igre.",
        },
        { kind: "melds" },
        {
          kind: "rule",
          title: "Samo jedan tim je plaćen za najave",
          text: "Svaka strana ističe svoju jedinu najbolju najavu. Čija je jača, skuplja sve najave iz obje ruke tima — drugi tim ne dobiva ništa za svoje. Dulji niz pobjeđuje kraći. Ista duljina? Viša gornja karta nosi. Još uvijek izjednačeno? Niz u adutu pobjeđuje. Belot i Rebelot stoje izvan ovog natjecanja — tko ih najavi, uvijek ih boduje.",
        },
      ],
    },
    {
      id: "scoring",
      label: "Bodovanje",
      title: "Brojanje i zamka",
      lede: "Tko je uzeo adut daje obećanje: završi naprijed, ili predaj protivnicima sve što si osvojio te ruke.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              t: "Prebroji karte koje si uzeo",
              d: "Svaki tim okreće osvojene štihove i zbraja bodove na kartama unutra. Zbirno za oba tima uvijek izlazi točno 152.",
            },
            {
              t: "Dodaj bonus za posljednji štih",
              d: "Osvojio osmi i posljednji štih? To je još 10 bodova — za stolom ga zovu “de de der”. Sada si na 162 samo od karata.",
            },
            {
              t: "Dodaj najave",
              d: "Strana koja je dobila natjecanje najava zbraja sve kombinacije iz ruku oba partnera. Bilo koji Belot ili Rebelot najavljen tijekom igre dolazi povrh toga, za onoga tko ga je najavio.",
            },
          ],
        },
        {
          kind: "rule",
          title: "Onaj tko je uzeo adut mora izaći naprijed",
          text: "Tim koji je uzeo adut mora završiti sa strogo više bodova od druge strane, uključujući najave s obje strane. Ako zaostane — ili se čak izjednači — ruka je izgubljena: sve što je osvojio te ruke, i karte i najave, ide protivnicima umjesto toga. Igrači to zovu “pad”, i jedna loša ruka može izbrisati udobnu prednost.",
        },
        {
          kind: "note",
          text: "Ruke se igraju dok barem jedan tim ne sjedne na 1001 ili više na kraju ruke. Ako oba tima prijeđu granicu u istoj ruci, strana koja je te ruke uzela adut osvaja meč.",
        },
      ],
    },
  ],

  ui: {
    heroEyebrow: "Pravila · čitanje od 6 minuta",
    heroTitle: "Nauči Beljot u jednom sjedenju",
    heroIntro:
      "Beljot je timska igra s kartama za četiri igrača sa špilom od 32 karte. Šest kratkih poglavlja u nastavku vode te od prvog dijeljenja sve do pobjedničkog rezultata — sve što ti treba da se snađeš za stolom. Čitaj redom, ili skoči na ono što ti treba preko sadržaja lijevo.",
    facts: [
      { label: "Igrači", value: "4", caption: "dva tima po dvoje" },
      { label: "Špil", value: "32", caption: "od 7 do Asa, četiri boje" },
      { label: "Karte po ruci", value: "8", caption: "podijeljene 3, pa 2, pa 3" },
      { label: "Utrka do", value: "1001", caption: "bodova za pobjedu" },
    ],
    tocTitle: "Sadržaj",
    footerTitle: "Spreman za prvu ruku?",
    footerBody:
      "Ovaj vodič prati te i u igru. Tijekom ruke, pritisni gumb s upitnikom u donjem desnom kutu i istih šest poglavlja se otvara — bez pauziranja igre.",
    footerCta: "Igraj",
    noteLabel: "Napomena",
    pts: "bodova",
    ladderTrumpTitle: "U adutskoj boji",
    ladderTrumpEyebrow: "Adut",
    ladderPlainTitle: "U svakoj drugoj boji",
    ladderPlainEyebrow: "Izvan aduta",
    colCard: "Karta",
    colPoints: "Bodovi",
    colPower: "Snaga",
    meldKinds: { belot: "Par u adutu", set: "Kare", run: "Niz" },
    ovReference: "Uputa",
    ovTitle: "Pravila Beljota",
    ovChapters: "Poglavlja",
    ovFullRef: "Potpuna uputa:",
    ovClose: "Zatvori",
  },
};

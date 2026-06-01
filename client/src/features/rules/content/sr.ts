// Beljot · Rules content — Serbian (authored; ekavian, Latin, Belote terminology).
import type { RulesLangData } from "./types";

export const sr: RulesLangData = {
  cardNames: {
    J: "Žandar",
    "9": "Devetka",
    A: "Kec",
    "10": "Desetka",
    K: "Kralj",
    Q: "Baba",
    "8": "Osmica",
    "7": "Sedmica",
  },
  trumpNotes: { J: "Najjača u adutu", "7": "Najslabija" },
  plainNotes: { A: "Najjača van aduta", "7": "Najslabija" },

  declarations: {
    belot: {
      name: "Belot / Rebelot",
      summary: "Kralj i Baba u adutu, oboje u istoj ruci.",
      detail:
        "Baba je Belot, Kralj je Rebelot — svako najavljuješ kad ga odigraš. Par se uvek plaća, čak i kad protivnički tim drži nešto veće; stoji sam za sebe, van takmičenja.",
    },
    terca: {
      name: "Terca",
      summary: "Tri karte u nizu, sve iste boje.",
      detail:
        "Za najave redosled ide 7, 8, 9, 10, Žandar, Baba, Kralj, Kec — i nema vraćanja od Keca nazad na 7.",
    },
    kvarta: {
      name: "Kvarta",
      summary: "Četiri karte u nizu, sve iste boje.",
      detail: "Kvarta uvek pobeđuje bilo koju tercu koju drži drugi tim, bez obzira na boje.",
    },
    kvinta: {
      name: "Kvinta",
      summary: "Pet ili više karata u nizu, ista boja.",
      detail:
        "Bilo koji niz od pet ili više u jednoj boji vredi 100. Duži niz ne nosi više od petokartnog.",
    },
    carre: {
      name: "Kare",
      summary: "Sve četiri iste vrednosti — samo Desetke, Babe, Kraljevi ili Kecovi.",
      detail:
        "Četiri iste od jedne od ovih vrednosti. Karei od devetki i žandara nose više i boduju se posebno.",
    },
    carre9: {
      name: "Kare devetki",
      summary: "Sve četiri devetke.",
      detail:
        "Devetka u adutu je druga najjača karta u špilu — pa pun kare devetki plaća se jedan i po put više od običnog karea.",
    },
    carreJ: {
      name: "Kare žandara",
      summary: "Sva četiri žandara.",
      detail:
        "Najveća pojedinačna najava u igri. Dobiti sva četiri žandara u svojih osam karata je retko — većina igrača to vidi tek nekoliko puta u celoj sezoni.",
    },
  },

  sections: [
    {
      id: "goal",
      label: "Cilj",
      title: "Trkaj se s timom do 1001",
      lede: "Ti i tvoj partner delite jedan rezultat. Prvi tim do 1001 osvaja meč.",
      blocks: [
        {
          kind: "p",
          text: "Sediš naspram svog partnera, vas dvoje protiv para s obe strane. Delite jedan zajednički rezultat i ništa se ne resetuje između odigranih ruku — poeni se samo gomilaju dok neko ne pređe 1001. Većina mečeva završi za 6 do 12 ruku.",
        },
        {
          kind: "p",
          text: "Postoje dva načina da osvojiš poene. Osvoji štihove i skupljaš poene ispisane na svakoj karti koju uzmeš. Drži prave karte i možeš da najaviš kombinacije — niz od četiri u jednoj boji, ili Kralja i Babu u adutu zajedno — za bonus povrh toga. Štihovi su tvoj stalni prihod; najave su veliki preokreti koji znaju da promene tok celog meča.",
        },
      ],
    },
    {
      id: "basics",
      label: "Priprema",
      title: "Promešaj, podeli, uzmi adut",
      lede: "Četiri igrača, 32 karte, osam u ruci i brz krug da se odredi koja je boja adut.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              t: "Sedni na svoje mesto",
              d: "Sediš tačno naspram svog partnera; dvojica protivnika zauzimaju stolice s obe strane. Igra se kreće udesno oko stola.",
            },
            {
              t: "Sastavi špil",
              d: "Beljot se igra sa 32 karte. Uzmi običan špil i izbaci sve od 2 do 6. Ono što ostaje — 7, 8, 9, 10, Žandar, Baba, Kralj i Kec u sve četiri boje — je ono čime igraš.",
            },
            {
              t: "Podeli prvih pet",
              d: "Delilac obilazi dvaput — po tri karte, pa dve — pa svako počinje sa pet u ruci. Ostatak špila ostaje licem nadole na sredini.",
            },
            {
              t: "Otvori adut",
              d: "Delilac okreće sledeću kartu sa špila licem nagore. Redom, svaki igrač može da je uzme — čineći njenu boju adutom za tu ruku — ili da preskoči. Čim je neko uzme, ta boja je adut i delilac deli ostatak karata dok svako ne drži osam. Adut pobeđuje sve iz druge tri boje, bez obzira na rang.",
            },
          ],
        },
      ],
    },
    {
      id: "cards",
      label: "Vrednost karata",
      title: "Adut igra po sopstvenim pravilima",
      lede: "U adutu, Žandar i devetka postaju najjači. Za sve druge boje važi redosled van aduta.",
      blocks: [
        {
          kind: "p",
          text: "Svaka karta radi dve stvari. Njena snaga određuje ko nosi štih; njena vrednost u poenima dodaje se tvom rezultatu ako je osvojiš. To dvoje nije uvek isto — karta može biti jaka a da ništa ne vredi, ili slaba a da nosi mnogo poena.",
        },
        {
          kind: "p",
          text: "U tri obične boje, redosled je poznati: Kec na vrhu, pa 10, Kralj, Baba, Žandar i naniže. Ali čim jedna boja postane adut, dve karte skaču nagore. Žandar u adutu postaje najjača karta u celom špilu, a devetka u adutu odmah iza njega. Kec i desetka u adutu padaju na treće i četvrto mesto. Brzo prebacivanje između ova dva redosleda najveći je deo igre.",
        },
        { kind: "cards" },
        {
          kind: "note",
          text: "Saberi sve karte u špilu i dobiješ 152 poena. Osvoji poslednji štih u ruci i uzimaš još 10 (bonus za “poslednji štih”), pa je na stolu 162 poena u svakoj ruci pre nego što se dodaju najave.",
        },
      ],
    },
    {
      id: "play",
      label: "Igranje štiha",
      title: "Kada šta smeš da baciš",
      lede: "Retko si slobodan da baciš šta želiš. Tri kratka pravila pokrivaju gotovo svaki potez.",
      blocks: [
        {
          kind: "p",
          text: "Štih je po jedna karta od svakog od četvorice igrača, redom. Ko nosi štih skuplja sve četiri karte u gomilu svog tima i vodi sledeći. Osam štihova i ruka je gotova.",
        },
        {
          kind: "rule",
          title: "Prati boju koja je izašla — i nadbij je ako možeš",
          text: "Ako je izašlo srce, moraš da baciš srce kad god ga imaš. I ne smeš da se izvučeš: ako držiš srce veće od najvećeg koje je već na stolu, dužan si da ga baciš. Tek kad su sva tvoja srca manja smeš da pustiš manje.",
        },
        {
          kind: "rule",
          title: "Nemaš u boji? Moraš da sečeš — i nadseci ako možeš",
          text: "Ne možeš da pratiš boju ali još držiš adut? Dužan si da sečeš. I ako je adut već bačen, moraš da ga nadbiješ većim kada možeš; samo ako su svi tvoji aduti manji smeš da baciš mali adut. Najveći adut na stolu nosi štih.",
        },
        {
          kind: "rule",
          title: "Sečeno adutom? Praćenje boje ipak je prvo",
          text: "Čak i nakon što je štih sečen adutom, igrač koji može da prati izašlu boju ipak mora da je prati — i ipak mora da je nadbije: baci svoju najveću kartu te boje ako pobeđuje ono na stolu, inače manju. Za adut posežeš tek kad si potpuno bez izašle boje, čak i kad već znaš da je adut osvojio štih.",
        },
        {
          kind: "p",
          text: "Nemaš kartu izašle boje ni adut? Baci šta želiš. Ta karta ne može da osvoji štih — samo je pokupi onaj ko ga nosi.",
        },
      ],
    },
    {
      id: "melds",
      label: "Najave",
      title: "Neke ruke nose poene same po sebi",
      lede: "Padni na pravu kombinaciju u podeljenoj ruci i ona nosi poene sama po sebi — najavljuješ je na svom redu u prvom štihu, pa je otkrivaš na početku drugog.",
      blocks: [
        {
          kind: "p",
          text: "Čim su karte podeljene i adut određen, proveri ruku za najave: nizove karata u nizu u jednoj boji, četiri iste, i par Kralj-i-Baba u adutu — Baba je Belot, Kralj je Rebelot. Najava se radi na tvom redu u prvom štihu, dok igraš kartu — a zatim slažeš karte licem nagore za sve na početku drugog štiha. Belot i Rebelot su izuzetak — svako najavljuješ kad igraš tu kartu tokom igre.",
        },
        { kind: "melds" },
        {
          kind: "rule",
          title: "Samo jedan tim je plaćen za najave",
          text: "Svaka strana ističe svoju jedinu najbolju najavu. Čija je jača, skuplja sve najave iz obe ruke tima — drugi tim ne dobija ništa za svoje. Duži niz pobeđuje kraći. Ista dužina? Viša gornja karta nosi. Još uvek izjednačeno? Niz u adutu pobeđuje. Belot i Rebelot stoje van ovog takmičenja — ko ih najavi, uvek ih boduje.",
        },
      ],
    },
    {
      id: "scoring",
      label: "Bodovanje",
      title: "Brojanje i zamka",
      lede: "Ko je uzeo adut daje obećanje: završi napred, ili predaj protivnicima sve što si osvojio te ruke.",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              t: "Prebroj karte koje si uzeo",
              d: "Svaki tim okreće osvojene štihove i sabira poene na kartama unutra. Zbirno za oba tima uvek izlazi tačno 152.",
            },
            {
              t: "Dodaj bonus za poslednji štih",
              d: "Osvojio osmi i poslednji štih? To je još 10 poena — za stolom ga zovu “de de der”. Sada si na 162 samo od karata.",
            },
            {
              t: "Dodaj najave",
              d: "Strana koja je dobila takmičenje najava sabira sve kombinacije iz ruku oba partnera. Bilo koji Belot ili Rebelot najavljen tokom igre dolazi povrh toga, za onoga ko ga je najavio.",
            },
          ],
        },
        {
          kind: "rule",
          title: "Onaj ko je uzeo adut mora da izađe napred",
          text: "Tim koji je uzeo adut mora da završi sa strogo više poena od druge strane, uključujući najave s obe strane. Ako zaostane — ili se čak izjednači — ruka je izgubljena: sve što je osvojio te ruke, i karte i najave, ide protivnicima umesto toga. Igrači to zovu “pad”, i jedna loša ruka može da izbriše udobnu prednost.",
        },
        {
          kind: "note",
          text: "Ruke se igraju dok bar jedan tim ne sedne na 1001 ili više na kraju ruke. Ako oba tima pređu granicu u istoj ruci, strana koja je te ruke uzela adut osvaja meč.",
        },
      ],
    },
  ],

  ui: {
    heroEyebrow: "Pravila · čitanje od 6 minuta",
    heroTitle: "Nauči Beljot u jednom sedenju",
    heroIntro:
      "Beljot je timska igra s kartama za četiri igrača sa špilom od 32 karte. Šest kratkih poglavlja u nastavku vode te od prvog deljenja sve do pobedničkog rezultata — sve što ti treba da se snađeš za stolom. Čitaj redom, ili skoči na ono što ti treba preko sadržaja levo.",
    facts: [
      { label: "Igrači", value: "4", caption: "dva tima po dvoje" },
      { label: "Špil", value: "32", caption: "od 7 do Keca, četiri boje" },
      { label: "Karte po ruci", value: "8", caption: "podeljene 3, pa 2, pa 3" },
      { label: "Trka do", value: "1001", caption: "poena za pobedu" },
    ],
    tocTitle: "Sadržaj",
    footerTitle: "Spreman za prvu ruku?",
    footerBody:
      "Ovaj vodič prati te i u igru. Tokom ruke, pritisni dugme sa upitnikom u donjem desnom uglu i istih šest poglavlja se otvara — bez pauziranja igre.",
    footerCta: "Igraj",
    noteLabel: "Napomena",
    pts: "poena",
    ladderTrumpTitle: "U adutskoj boji",
    ladderTrumpEyebrow: "Adut",
    ladderPlainTitle: "U svakoj drugoj boji",
    ladderPlainEyebrow: "Van aduta",
    colCard: "Karta",
    colPoints: "Poeni",
    colPower: "Snaga",
    meldKinds: { belot: "Par u adutu", set: "Kare", run: "Niz" },
    ovReference: "Uputstvo",
    ovTitle: "Pravila Beljota",
    ovChapters: "Poglavlja",
    ovFullRef: "Potpuno uputstvo:",
    ovClose: "Zatvori",
  },
};

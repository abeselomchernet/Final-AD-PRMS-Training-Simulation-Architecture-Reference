import { OromifaContractData, OromifaContractTemplate, OwnerId } from '../types/prms';
import { sanitizeHtml } from '../utils/sanitize';

export const OROMIFA_CONTRACT_IMAGES = [
  { page: 1, label: 'Fuula 1 — Keewwata 1–3', src: '/assets/aistudio/agr1_e314cfa9.jpg' },
  { page: 2, label: 'Fuula 2 — Keewwata 4–5.3', src: '/assets/aistudio/agr2_9dc24966.jpg' },
  { page: 3, label: 'Fuula 3 — Keewwata 5.4–6.5', src: '/assets/aistudio/agr3_067d85b5.jpg' },
  { page: 4, label: 'Fuula 4 — Keewwata 6.5–7.1', src: '/assets/aistudio/agr4_cefd56f5.jpg' },
  { page: 5, label: 'Fuula 5 — Keewwata 7.2–8 & Mallattoo', src: '/assets/aistudio/agr5_465aaf72.jpg' },
] as const;

export const CASH_ATTACHMENT_SAMPLE_IMAGE = '/assets/aistudio/at1_4047ccc3.jpg';
export const TAX_FORM_SAMPLE_IMAGE = '/assets/aistudio/t1_5de542c2.jpg';

function fmtMoneyPlain(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthCountWordOm(months: number): string {
  switch (months) {
    case 1:
      return '1(Tokko)';
    case 2:
      return '2(Lama)';
    case 3:
      return '3(Sadii)';
    case 6:
      return '6(Ja’a)';
    case 12:
      return '12(Kudha Lama)';
    default:
      return String(months);
  }
}

export function recalculateOromifaFinancials(
  data: OromifaContractData
): OromifaContractData {
  const baseMonthly = Math.max(0, Number(data.baseMonthlyRentEtb) || 0);
  const vatRate = Math.max(0, Number(data.vatRatePercent) || 0);
  const advanceMonths = Math.max(1, Math.round(Number(data.advanceMonths) || 1));

  const vatAmountEtb = Math.round(baseMonthly * (vatRate / 100) * 100) / 100;
  const grossMonthlyRentEtb = Math.round((baseMonthly + vatAmountEtb) * 100) / 100;
  const advanceBaseTotalEtb = Math.round(baseMonthly * advanceMonths * 100) / 100;
  const advanceVatTotalEtb = Math.round(vatAmountEtb * advanceMonths * 100) / 100;
  const advanceGrandTotalEtb = Math.round(grossMonthlyRentEtb * advanceMonths * 100) / 100;

  return {
    ...data,
    baseMonthlyRentEtb: baseMonthly,
    vatRatePercent: vatRate,
    advanceMonths,
    vatAmountEtb,
    grossMonthlyRentEtb,
    advanceBaseTotalEtb,
    advanceVatTotalEtb,
    advanceGrandTotalEtb,
  };
}

export function createSampleOromifaContractData(): OromifaContractData {
  return {
    contractDateEc: '01/02/2018',
    landlordTitleAndName: 'Obboo Abdulwahaab Dhaqqaboo Tolaa',
    landlordAddress: 'Magaalaa Adaamaa Ku/Magaalaa Luugoo Aanaa Dirree Nagayaa',
    landlordPhone: '0911253639',
    landlordTin: '0003496157',
    landlordVat: '3140270032',
    tenantTitleAndName: 'Ad/ Habiba Mohammednur Kemer',
    tenantAddress: 'Magaalaa Adaamaa Ku/Magaalaa Luugoo Aanaa Barreecha',
    tenantPhone: '0912324843',
    tenantTin: '0089369475',
    tenantVat: '__________',
    tenantTradeLicense: 'ORO/ADT/04/451/5021197/2016',
    propertyLocation: 'Magaalaa Adaamaa Ku/Magaalaa Luugoo Aanaa Dirree Nagaa',
    parcelUniqueNo: 'OR001100204010',
    registrationDateEc: '14/08/2016',
    unitRoomLabel: 'Kutaa 1(Tokko) Lakk-6',
    businessPurpose: 'Tajajila Daldalaa Qinxaaaboo Jijjiirraa fi Faayaalee',
    startDateEc: '01/03/2018',
    endDateEc: '30/02/2019',
    durationText: 'waggaa 1(Tokkoo)',
    advanceMonths: 3,
    baseMonthlyRentEtb: 21250,
    vatRatePercent: 15,
    vatAmountEtb: 3750,
    grossMonthlyRentEtb: 25000,
    advanceBaseTotalEtb: 63750,
    advanceVatTotalEtb: 11250,
    advanceGrandTotalEtb: 75000,
    advanceGrandTotalWordsOm: 'Qr.Kuma Torbatamii Shan',
    bankName: 'Bankii Daldalaa',
    bankAccountNumber: '1000062431893',
    nextCycleNoticeDays: 5,
    dailyPenaltyPercent: 5,
    evictionNoticeMonths: 3,
    terminationNoticeLandlordMonths: 3,
    terminationNoticeTenantMonths: 1,
    forceMajeureMaxDays: 15,
    utilityDepositEtb: 200,
    utilityDepositWordsOm: 'Qr. Dhibba Lama',
    breachPenaltyEtb: 10000,
    breachPenaltyWordsOm: 'Qr.Kuma Kudhan',
    witness1: 'Ob. Abdi Kamaan — Adaamaa msh 3',
    witness2: 'Ob. Bakabtuu Arragaw — Adaamaa',
    witness3: 'Ragaa 3ffaa (Maqaa fi Teessoo)',
    signatureLandlordName: 'Abdulwadir Abdurahman',
    signatureTenantName: 'Habiba Mohamd',
  };
}

export function createDefaultOromifaTemplates(ownerId: OwnerId): OromifaContractTemplate[] {
  return [
    {
      id: `TPL-OM-SAMPLE-${ownerId}`,
      ownerId,
      templateName: 'Waliigaltee Kiraa Mana Daldalaa — Adaamaa (Sample Standard)',
      description:
        'Exact Afaan Oromoo commercial rental agreement template (Keewwata 1–8) ready for immediate reuse with any unit & tenant.',
      updatedAt: '2026-11-15',
      data: createSampleOromifaContractData(),
    },
  ];
}

export interface OromifaArticleBlock {
  heading: string;
  subheading?: string;
  paragraphs: string[];
}

export function buildOromifaContractSections(d: OromifaContractData): {
  dateLine: string;
  title: string;
  partiesLines: { label: string; value: string }[];
  legalPreamble: string;
  articles: OromifaArticleBlock[];
  witnesses: string[];
  witnessAttestation: string;
} {
  const advWord = monthCountWordOm(d.advanceMonths);

  return {
    dateLine: `Guyyaa-${d.contractDateEc}`,
    title: 'WALIIGALTEE (AHADII) KIRAA MANA DALDALAA',
    partiesLines: [
      {
        label: 'Ahadii Kennaan (Kireessaan) :-',
        value: d.landlordTitleAndName,
      },
      {
        label: 'Teessoon :-',
        value: `${d.landlordAddress} | Lakk.Bilbilaa - ${d.landlordPhone} | Lakk.Kafala Gibira(TIN)-${d.landlordTin} | Lakk.T.D.Q(VAT)-${d.landlordVat}`,
      },
      {
        label: 'Ahadii Fudhataan (Kireeffatan) :-',
        value: d.tenantTitleAndName,
      },
      {
        label: 'Teessoon :-',
        value: `${d.tenantAddress} | Lakk.Bilbilaa :- ${d.tenantPhone} | Lakk.Kafal Gibira(TIN) ${d.tenantTin} | Lakk.T.D.Q.(VAT) ${d.tenantVat} | Lakk.Hayyama Daldalaa: ${d.tenantTradeLicense}`,
      },
    ],
    legalPreamble:
      "Waliigalteen Kiraa Mana Daldalaa kun Kireessaa fi Kireeffatuu jiddutti Bu'ura S/H/H/ Lakk. 1678, 1719, 1731, 2896, 2945 fi 2005 tiin kan raawwateedha.",
    articles: [
      {
        heading: 'KEEWWATA-1',
        subheading: 'Waliigaltee',
        paragraphs: [
          `Waliigalteen (Ahaadiin) Kiraa Mana Daldalaa kun ${d.landlordTitleAndName} kanaan booda kireessaa je'amee kan waammamu fi ${d.tenantTitleAndName} kanaan booda Kireeffataa je'amee kan waamamu jiddutti kan raawwateedha.`,
        ],
      },
      {
        heading: 'KEEWWATA-2',
        subheading: 'Kaayyoo',
        paragraphs: [
          `${d.propertyLocation} keessatti Mana Daldalaa Lakk. Addaa Cituu Laffaa ${d.parcelUniqueNo} guyyaa ${d.registrationDateEc} maqaa kireessatiin galmaa'ee beekkamu keessaa ${d.unitRoomLabel} tiin kan galma'ee jiru ${d.businessPurpose}-tiif kireessuu waan barbaadeef ,kireeffattuunis haaluma waliigaltee armaan gadiiti ibsamuun kireeffachuu waan barbaaddeef waliigaltee raawwateedha.`,
        ],
      },
      {
        heading: 'KEEWWATA-3',
        subheading: 'Bara Waliigaltee',
        paragraphs: [
          `Waliigalteen Kiraa mana Daldalaa kun guyyaa ${d.startDateEc} irra hanga ${d.endDateEc}tti turtii ${d.durationText} qofaaf kan raawwatu yoo ta'u kafaltiin Kiraan dursaan kan ji'a ${advWord} akka kafalamu waliigallee jirra.`,
        ],
      },
      {
        heading: 'KEEWWATA-4',
        subheading: 'Gatii Kiraa fi Haala Raawwii',
        paragraphs: [
          `4.1 Kiraan Mana Daldalaa kun ji'atti Qr. ${fmtMoneyPlain(d.baseMonthlyRentEtb)} T.D.Q.(VAT) ${d.vatRatePercent}% Qr.${fmtMoneyPlain(d.vatAmountEtb)} dabalatee Qr.${fmtMoneyPlain(d.grossMonthlyRentEtb)}tti akka kireeffamu waliigallee jirra.`,
          `4.2 Bu'ura waliigaltee kanaatiin kafaltii kiraa ji'a ${d.advanceMonths}x${fmtMoneyPlain(d.baseMonthlyRentEtb)}=Qr.${fmtMoneyPlain(d.advanceBaseTotalEtb)} T.D.Q.(VAT) ${d.vatRatePercent}% kan ji'a ${d.advanceMonths}x${fmtMoneyPlain(d.vatAmountEtb)} = ${fmtMoneyPlain(d.advanceVatTotalEtb)} Walumaatti Kiraan dursaan kafalamu qabu Qr.${fmtMoneyPlain(d.advanceGrandTotalEtb)}(${d.advanceGrandTotalWordsOm}) ${d.bankName} Lakk. Herregaa ${d.bankAccountNumber}tti Maqaa ${d.landlordTitleAndName}-tiin galii ta'ee ragaan akka dhiyeeffatan waliigallee jirra.`,
          `4.3 Kafaltiin ji'a ${advWord} dursa kafalme akkuma xumurameetti kireeffattuun waliigalteen akka itti fufu yoo barbaadde kafaltiin itti aanu xumuramuun duratti guyyaa ${d.nextCycleNoticeDays}(Shan) dursitee kan marsaa itti aanu T.D.Q (VAT) dabalatee akka kafalamu waliigallee jirra.`,
          `4.4 Kireeffataan kiraa mana daldalaa yeroo waliigalame keessatti kan hin kafalamin yoo ta'e Kireessan kiraa waliigalaa irratti kan shalagamu guyyaa guyyaan Parsantii ${d.dailyPenaltyPercent}% adabbii kafalchiisuuf mirga akka qabu waliigallee jirra.`,
          `4.5 Kireeffataan akkaataa keewwata 4.4 jalatti ibsameen kiraa waliigala adabbii waliin kafalee kan hin xumuranne yoo ta'e of-eeggannoon dura afaniin nikennamaaf itti ansee akeekkachiifni dhumaa barreeffamaa erga kennameef booda Ji'a ${monthCountWordOm(d.evictionNoticeMonths)} keessatti manicha akka gadilakkisu waliigallee jirra.`,
          `4.6 Kireeffataan akkaataa keewwata 4.5 jalatti ibsameen kan hin raawwanne yoo ta'e kireessan Mana Murtitti himatee qabeenya kireeffataa kabachiisee durgoo Abukaatoo dabalatee idaa irraa barbadamu gutumatti kafalchiisuuf mirga akka qabu waliigallee jirra.`,
        ],
      },
      {
        heading: 'KEEWWATA-5',
        subheading: 'Mirgaa fi Dirqama Kireessaa',
        paragraphs: [
          `5.1 Kireessaan haala qabatamaa jiru bu'ureeffachuun waliigalteen duraa guyyaa ${d.startDateEc} - ${d.endDateEc}tti erga xumurame booda haal-duree tokko malee kiraa mana daldala kanaa fooyyessuuf ykn dabaluuf mirga akka qabu waliigallee jirra.`,
          `5.2 Kireessaan Mana daldalaa Kireeffataaf kireesse kana gatii kiraa waliigaltee keessatti ibsame kafalchiisuuf mirga akka qabu waliigallee jirra.`,
          `5.3 Kireessaan waliigalteen kira dura taasifame ture akkuma xumurametti kireeffataan yeroon akka dheeratuuf yoo gaafate haalaa fi amala kireeffataa ilaalee dheeressuufis ta'e diduuf mirga akka qabu waliigallee jirra.`,
          `5.4 Kireessaan qabeenyaa fi meeshaalee kireeffataan cabse, mancaase fi fudhate kafalchiisuuf ykn bakka busifachuuf mirga akka qabu waliigallee jirra.`,
          `5.5 Kireessaan Mana Daldalaa kireeffataaf kireesse kana guyyaa kiraan kafalamee waliigalteen Mallattaa'e battalumatti furtuu isaa waliin manicha kireeffataaf dabarsuuf dirqama akka qabu waliigallee jirra.`,
          `5.6 Kireessaan tajaajila ibsaa fi bishaanii mana daldalaa keessatti mijjeessuuf dirqama akka qabu waliigalameera.`,
          `5.7 Kireessaan gatii tajaajila ibsaa fi bishaanii kireeffataan itti fayyadame kafalchiisuuf mirga akka qabu waliigallee jirra.`,
          `5.8 Kireessaan waliigalteen kiraa akka addaan citu yoo barbaade Ji'a ${monthCountWordOm(d.terminationNoticeLandlordMonths)} dursee kireeffataaf barreeffamaan of-eeggannoo kennuu akka qabu waliigallee jirra.`,
        ],
      },
      {
        heading: 'KEEWWATA-6',
        subheading: 'Mirgaa fi Dirqama Kireeffataa',
        paragraphs: [
          "6.1 Kireeffataan yeroo waliigaltee kiraa raawwachuuf dhiyaatu HAYYAMA DALDALAA haroomfame, Ragaa Kafal Gibira (TIN), T.D.Q.(VAT) fi waraqaa Eenyummaa Kooppii walqabsiisee dhiyeeffachuu akka qabu kan waliigallee yoo ta'u, Ragaa gaafatame kana dhiyeeffachuu kan hin dandeenye yoo ta'e waliigaltee kiraa raawwachuu akka hin dandeenye waliigallee jirra.",
          "6.2 Kireeffataan Mana Daldalaa kireeffate keessatti wantoota seeraan dhorkaman meeshaa kontoroobaandii, Hashiishaa fi kkf mana daldalaa kireeffate keessa galchee gurguruun akkasumattis Meeshaa waraanaa seeraan alaa dhoksaadhaan mana daldalaa kireeffate keessa ka'uunis gonkummaa dhoorkaadha. Kireeffataan waliigaltee kana diigee gochaa seeraan alaa kana raawwatee yoo argame waliigalteen battalumatti kan addaan cituu fi yakka raawwateefis kallattiin kan itti gaafatamu ta'uu waliigallee jirra.",
          "6.3 Kireeffataan jeequmsaa fi gochaawwan Nageenyaa Naannoo booressan kamiyyuu irratti hirmaachuus ta'e deeggaruu hin qabu. Gochaawwan jeequmsaa sababa ta'an kan kakaasuu fi kan irratti hirmaatu yoo ta'e haal-duree tokko malee waliigalteen addaan citee qaama Mootummaatti kan gabasamu ta'uu waliigallee jirra.",
          "6.4 Kireeffataan Hojii daldalaa mana kana keessatti gaggeessuuf Gibiraa fi Taaksii akkasumattis kafaltiiwwan adda addaa Mootummaan irraa barbaadu yeroon kafaluuf dirqama qaba. Kafaltiiwwan irraa barbaadu kan hin kafalle yoo ta'e guutumaan guututti kan itti gaafatamu ta'uu waliigallee jirra.",
          "6.5 Kireeffataan mana daldalaa kireeffate kana beekamtii fi hayyamaa kireessaa malee haala kamiiniyyuu qaama 3ffaa tiif kireessuu ykn dabarsee kennuu hin danda'u. Waliigaltee kanaa ala kan raawwatu yoo ta'e battalumatti waliigalteen kiraa akka addaan citu waliigallee jirra.",
          "6.6 Kireeffataan qabeenyaa fi meeshaalee mana daldalaa of-eeggannoon eeguu fi qabuuf dirqama qaba. Sababa hanqina kireeffataatiin qabeenya miidhaan irra ga'e kamiyyuu yoo jiraate kireeffataan baasii mataa isaatiin suphuu fi haroomsuuf dirqama akka qabu waliigallee jirra.",
          "6.7 Kireeffataan yeroon waliigaltee kiraa mana daldalaa duraanii xumuramuuf Baatiin 1(Tokko) yoo hafu waliigalteen itti aanu akka haroomfamuuf gaafachuu qaba. Kana gochuu yoo baate akkuma waliigalteen duraa xumurametti idaa irra barbaadamu kafalee, qabeenya cabse suphuun, kan bade bakka buusuun manicha harkaan gahuuf dirqama akka qabu waliigallee jirra.",
          "6.8 Kireeffataan wantoota qulqullina naannoo faalan irraa of-eeggannoo gochuuf dirqama qaba. Naannoon balfaan faalee yoo argame qulqulleessuuf ni dirqama. Yoo qulqulleessuu baate Waajjirri qulqullina eeguuf Angoon kennameef tarkaanfii irratti fudhatuu fi adabuus akka danda'u waliigallee jirra.",
          `6.9 Kireeffataan mana daldalaa kireeffate kana hojii malee cufee teessisuun dhorkaadha. Rakkoon humnaa olii(Force Majeure) yoo isa mudate kireessaa hayyamsiisee hanga guyyaa ${d.forceMajeureMaxDays}(Kudha Shan) turuu ni danda'a. Guyyaa hayyamameefii ol manicha cufee kan tursiisu yoo ta'e idaa irra barbaadamu kafalchiisuun waliigalteen akka addaan citu waliigallee jirra.`,
          '6.10 Kireeffataan gatii tajaajila ibsaa fi bishaan itti fayyadame kafaluuf dirqama akka qabu waliigallee jirra.',
          '6.11 Kireeffataan Mana Daldalaa Kireeffate kana akkuma waliigaltee raawwatee kiraa kafaletti manicha harkaan gahachuuf mirga akka qabu waliigallee jirra.',
          `6.12 Kireeffataan waliigaltee addaan kutuu yoo barbaade ji'a ${monthCountWordOm(d.terminationNoticeTenantMonths)} dursee kireessaadhaaf barreeffamaan beeksisuuf akka qabu waliigallee jirra.`,
          "6.13 Kireeffataan Beeksisa Daldalaa Elektroniiksii Nanna'u hojjachiifachuu qabu. Kanaan ala Beeksisa adda addaa maxxansuun yoo barbaade kireessaa irraa hayyama yoo argate malee maxxansuun dhorkaadha ta'uu waliigallee jirra.",
        ],
      },
      {
        heading: 'KEEWWATA-7',
        subheading: 'Haala Waliigalaa',
        paragraphs: [
          "7.1 Waliigalteen kiraa mana daldalaa kun kooppii 3n qophaa'ee, kooppiin 1 Waajjira Dhimmi ilaallatuuf, 1 Kireeffataaf kennama haateen 1 sanadaan walqabatee Kireessaa bira ragaa ta'ee akka taa'u waliigallee jirra.",
          `7.2 Kireeffataan Tajaajila ibsaa fi bishaaniitiif of-eeggannoof dursa Qr.${fmtMoneyPlain(d.utilityDepositEtb)}(${d.utilityDepositWordsOm}) ${d.bankName} Lakk. ${d.bankAccountNumber}tti galchee ragaa isaa akka dhiyeefatu waliigallee jirra.`,
          "7.3 Kireessaa fi Kireeffataa jiddutti waldhabdeen yoo uumame hanga danda'ametti sammuu qulqulluun, walhubannaa fi ilaalcha gaariin (good faith) mariin waldhabdee furuuf yaaliin akka taasifamu waliigallee jirra.",
          "7.4 Keewwata kana keeww.3 jalatti kan ibsame akkuma jirutti ta'ee waldhabdeen uumame jaarsummaa fi mariin hiikuun yoo dadhabame Mana Murtii dhimmicha ilaaluuf angoo qabutti dhiyaachuun murtii seeraa argachuun kan danda'amu ta'uu waliigallee jirra.",
          `7.5 Waliigalteen kiraa Mana Daldalaa kun erga mallatta'e booda diiguun hin danda'amu, qaamni waliigaltee kana diiguuf ykn gufachiisuuf yaale gama waliigaltee kabajeef Bu'ura SHH.Lakk 1889 fi 1892-tiin Qr.${fmtMoneyPlain(d.breachPenaltyEtb)}(${d.breachPenaltyWordsOm}) fi Mootummaaf Qr.${fmtMoneyPlain(d.breachPenaltyEtb)}(${d.breachPenaltyWordsOm}) adabbii kafalee Bu'ura SHH.Lakk.2005-tiin waliigalteen seera duratti cimee akka itti fufu waliigallee jirra.`,
        ],
      },
      {
        heading: 'KEEWWATA-8',
        subheading: 'Ragaalee Namaa',
        paragraphs: [
          'Waliigalteen Kiraa Mana Daldalaa kun yeroo raawwatu ragaaleen namaa qaamaan argaman:-',
        ],
      },
    ],
    witnesses: [d.witness1, d.witness2, d.witness3],
    witnessAttestation: `Nuti Ragoonni maqaan keenya gubbatti tarreeffame Kireessaa fi kireeffattuun kiraa mana ${d.businessPurpose}-tiif oolu irratti waliigalanii fedhaa fi jaalalaan yeroo waliigaltee mallatteessanii fi maallaqa kiraa fi manicha yeroo walii dabarsan arginee dhageenye ragummaan sanada waliigaltee kana irratti mallattoo keenyaan mirkaneessinee jirra.`,
  };
}

export function buildOromifaContractExportRows(raw: OromifaContractData): {
  columns: string[];
  rows: string[][];
} {
  const sections = buildOromifaContractSections(raw);
  const rows: string[][] = [
    ['Guyyaa', sections.dateLine],
    ['Mata-duree', sections.title],
    ...sections.partiesLines.map((p) => [p.label, p.value]),
    ['Seensa Seeraa', sections.legalPreamble],
  ];

  for (const art of sections.articles) {
    const headerLabel = art.subheading ? `${art.heading} — ${art.subheading}` : art.heading;
    art.paragraphs.forEach((p, idx) => {
      rows.push([idx === 0 ? headerLabel : art.heading, p]);
    });
  }

  sections.witnesses.forEach((w, idx) => {
    rows.push([`Ragaa ${idx + 1}`, w]);
  });
  rows.push(['Mirkaneeffannaa Ragoottaa', sections.witnessAttestation]);
  rows.push([
    'Mallattoo',
    `Kireessaa: ${raw.signatureLandlordName} | Kireeffataa: ${raw.signatureTenantName}`,
  ]);

  return {
    columns: ['Kutaa / Keewwata', 'Qabiyyee Waliigaltee (Afaan Oromoo)'],
    rows,
  };
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printOromifaContractDocument(raw: OromifaContractData): void {
  if (typeof document === 'undefined') return;
  const sections = buildOromifaContractSections(raw);

  const bodyMarkup = sanitizeHtml(`
  <div class="date">${escHtml(sections.dateLine)}</div>
  <h1>${escHtml(sections.title)}</h1>
  <div class="parties">
    ${sections.partiesLines
      .map((p) => `<p><strong>${escHtml(p.label)}</strong> ${escHtml(p.value)}</p>`)
      .join('')}
  </div>
  <p>${escHtml(sections.legalPreamble)}</p>
  ${sections.articles
    .map(
      (a) => `
    <div class="article">
      <div class="article-head"><span>${escHtml(a.heading)}</span>${
        a.subheading ? escHtml(a.subheading) : ''
      }</div>
      ${a.paragraphs.map((p) => `<p>${escHtml(p)}</p>`).join('')}
    </div>`
    )
    .join('')}
  <ol class="witnesses">
    ${sections.witnesses.map((w) => `<li>${escHtml(w)}</li>`).join('')}
  </ol>
  <p>${escHtml(sections.witnessAttestation)}</p>
  <div class="sig-grid">
    <div class="sig-col">
      <h4>Maqaa fi Mallattoo Kireessaa</h4>
      <p>Maqaa: ${escHtml(raw.signatureLandlordName)}</p>
      <p>Mallattoo: ____________________ Guyyaa: __________</p>
    </div>
    <div class="sig-col">
      <h4>Maqaa fi Mallattoo Kireeffataa</h4>
      <p>Maqaa: ${escHtml(raw.signatureTenantName)}</p>
      <p>Mallattoo: ____________________ Guyyaa: __________</p>
    </div>
  </div>
  <div class="sig-witness">
    <p><strong>Mallattoo Ragoottaa</strong></p>
    <p>1. _______________________ &nbsp;&nbsp; 2. _______________________ &nbsp;&nbsp; 3. _______________________</p>
  </div>`);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escHtml(sections.title)}</title>
<style>
  @page { size: portrait; margin: 16mm 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111827; font-size: 11.5px; line-height: 1.55; margin: 0; }
  .date { text-align: right; font-weight: 700; margin-bottom: 10px; }
  h1 { text-align: center; font-size: 14px; text-decoration: underline; margin: 0 0 14px; letter-spacing: 0.02em; }
  .parties { margin-bottom: 10px; }
  .parties p { margin: 3px 0; }
  .article { margin-top: 12px; }
  .article-head { text-align: center; font-weight: 700; font-size: 12px; margin-bottom: 4px; }
  .article-head span { text-decoration: underline; margin-right: 12px; }
  p { margin: 4px 0; text-align: justify; }
  .witnesses { margin: 8px 0 8px 18px; }
  .sig-grid { display: flex; justify-content: space-between; margin-top: 24px; gap: 24px; }
  .sig-col { width: 45%; font-size: 11px; }
  .sig-col h4 { text-decoration: underline; margin: 0 0 6px; font-size: 11.5px; }
  .sig-witness { text-align: center; margin-top: 20px; font-size: 11px; }
</style>
</head>
<body>${bodyMarkup}</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const docTarget = iframe.contentWindow?.document;
  if (docTarget) {
    docTarget.open();
    docTarget.write(html);
    docTarget.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Ignore print failures in headless tests
      }
      setTimeout(() => {
        iframe.remove();
      }, 1500);
    }, 150);
  } else {
    iframe.remove();
  }
}

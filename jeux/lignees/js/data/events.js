// Événements à choix, présentés par Maître Hulotte, et récompenses des contrats.
//
// Chaque événement est une fonction (run, ctx) qui renvoie null s'il ne peut pas se produire,
// sinon { icon, title, text, choices: [{ label, cost, effects, result }] }.
// effects : { res: {r: n}, savoir: n, heritage: n, timed: { label, icon, dur, effects: [...] },
//             ruin: building, tiles: n }
// ctx.pick(list) tire au hasard ; ctx.era est l'ère courante ; ctx.R(r) nom en minuscules d'une ressource.
G.EVENTS = {
  caravane: (run, ctx) => {
    const give = ['bois', 'bois', 'planches', 'acier', 'acier'][ctx.era], get = ['pierre', 'bronze', 'fer', 'machines', 'electronique'][ctx.era];
    const n = [50, 60, 80, 60, 120][ctx.era], m = [40, 25, 30, 15, 6][ctx.era];
    return {
      icon: '🐪', title: 'Une caravane marchande',
      text: 'Des marchands venus de très loin installent leurs étals devant le forum. Ils sentent le cumin et la bonne affaire.',
      choices: [
        { label: 'Échanger ' + n + ' ' + ctx.R(give) + ' contre ' + m + ' ' + ctx.R(get), cost: { [give]: n }, effects: { res: { [get]: m } }, result: 'Marché conclu ! Les marchands repartent en sifflotant.' },
        { label: 'Leur offrir l\'hospitalité (−30 nourriture, savoir)', cost: { nourriture: 30 }, effects: { savoir: 40 + ctx.era * 80 }, result: 'Autour du feu, ils racontent des contrées lointaines. Vos sages prennent des notes.' },
        { label: 'Passer votre chemin', result: 'La caravane s\'éloigne dans un nuage de poussière.' },
      ],
    };
  },

  mammouths: (run, ctx) => {
    if (ctx.era > 0) return null;
    return {
      icon: '🦣', title: 'Un troupeau de mammouths',
      text: 'La terre tremble : un troupeau de mammouths traverse la vallée. Vos chasseurs trépignent. Hulotte, lui, se cache derrière un rocher.',
      choices: [
        { label: 'Organiser une grande chasse (−10 outils, +120 nourriture, +40 peaux)', cost: { outils: 10 }, effects: { res: { nourriture: 120, peaux: 40 } }, result: 'Quelle chasse ! On racontera cette histoire pendant des générations. Hulotte l\'a déjà embellie deux fois.' },
        { label: 'Les peindre sur les parois (savoir)', effects: { savoir: 40 }, result: 'Vos artistes saisissent la majesté des bêtes. Le savoir progresse, les mammouths aussi : ils s\'en vont.' },
        { label: 'Les laisser passer', result: 'Ils passent, lentement, majestueusement. Il faudra trois jours pour que la poussière retombe.' },
      ],
    };
  },

  incendie: (run, ctx) => {
    const list = run.buildings.filter(b => b.type !== 'forum' && !b.ruined && !G.BUILDINGS[b.type].road);
    if (list.length < 6) return null;
    const b = ctx.pick(list), name = G.BUILDINGS[b.type].name.toLowerCase();
    return {
      icon: '🔥', title: 'Au feu !',
      text: 'Une étincelle mal placée : votre ' + name + ' prend feu ! Les habitants accourent avec des seaux… enfin, certains.',
      choices: [
        { label: 'Chaîne de seaux (production −30 % pendant 1 min)', effects: { timed: { label: 'Lutte contre l\'incendie', icon: '🪣', dur: 60, effects: [{ t: 'prod', target: 'all', v: -0.3 }] } }, result: 'Le feu est maîtrisé. Tout le monde est trempé, mais fier.' },
        { label: 'Payer des pompiers (pierre et bois)', cost: { pierre: 25 + ctx.era * 40, bois: 25 + ctx.era * 30 }, result: 'Les pompiers professionnels éteignent le feu avec une élégance remarquable.' },
        { label: 'Laisser brûler', effects: { ruin: b }, result: 'Votre ' + name + ' n\'est plus qu\'un tas de cendres. On le reconstruira.' },
      ],
    };
  },

  refugies: (run, ctx) => ({
    icon: '🧳', title: 'Des réfugiés aux portes',
    text: 'Une colonne de familles épuisées demande asile. Elles ont tout perdu, sauf leur appétit et leur savoir-faire.',
    choices: [
      { label: 'Les accueillir (−40 nourriture, population +25 % pendant 8 min)', cost: { nourriture: 40 }, effects: { timed: { label: 'Réfugiés accueillis', icon: '🧳', dur: 480, effects: [{ t: 'pop', v: 0.25 }] }, heritage: 1 }, result: 'Les nouveaux venus retroussent leurs manches. La Chronique note votre générosité.' },
      { label: 'Les orienter vers la ville voisine', result: 'Ils repartent tristement. Hulotte fait semblant de ne pas avoir vu.' },
    ],
  }),

  recolte: (run, ctx) => ({
    icon: '🌻', title: 'Une récolte exceptionnelle',
    text: 'Le soleil, la pluie, les abeilles : tout s\'aligne. Les champs débordent comme jamais.',
    choices: [
      { label: 'Formidable ! (nourriture +40 % pendant 4 min)', effects: { timed: { label: 'Récolte exceptionnelle', icon: '🌻', dur: 240, effects: [{ t: 'prod', target: 'cat:food', v: 0.4 }] } }, result: 'Les greniers chantent. Enfin, façon de parler.' },
    ],
  }),

  ruines: (run, ctx) => {
    if ((run.res.outils || 0) < 5) return null;
    return {
      icon: '🏺', title: 'Des ruines oubliées',
      text: 'En creusant des fondations, vos ouvriers mettent au jour les vestiges d\'une civilisation plus ancienne encore. Hulotte en tremble d\'émotion.',
      choices: [
        { label: 'Fouiller avec soin (−10 outils, savoir)', cost: { outils: 10 }, effects: { savoir: 120 + ctx.era * 250 }, result: 'Des tablettes couvertes de signes ! Vos sages en ont pour des semaines.' },
        { label: 'Récupérer les pierres (+60 pierre)', effects: { res: { pierre: 60 } }, result: 'Pragmatique. Hulotte boude un peu.' },
        { label: 'Ne pas déranger les anciens', effects: { heritage: 1 }, result: 'Le respect des ancêtres est noté dans la Chronique.' },
      ],
    };
  },

  fete: (run, ctx) => {
    const food = ctx.era >= 2 ? 'pain' : 'nourriture', n = ctx.era >= 2 ? 30 : 50;
    return {
      icon: '🎉', title: 'Le peuple veut faire la fête',
      text: 'Une délégation de citoyens réclame un banquet pour célébrer… à vrai dire, ils ne savent plus très bien quoi.',
      choices: [
        { label: 'Organiser un banquet (−' + n + ' ' + ctx.R(food) + ', production +15 % pendant 5 min)', cost: { [food]: n }, effects: { timed: { label: 'Lendemain de fête motivé', icon: '🎉', dur: 300, effects: [{ t: 'prod', target: 'all', v: 0.15 }] } }, result: 'Quelle fête ! Le lendemain, tout le monde travaille en chantant.' },
        { label: 'Refuser poliment', result: 'Ils repartent en ronchonnant, mais travaillent quand même.' },
      ],
    };
  },

  epidemie: (run, ctx) => {
    if (ctx.era < 2) return null;
    return {
      icon: '🤧', title: 'Une épidémie de rhume',
      text: 'Tout le monde éternue. Les porteurs éternuent en portant, ce qui est peu hygiénique.',
      choices: [
        { label: 'Distribuer de la soupe (−40 pain)', cost: { pain: 40 }, result: 'La soupe fait des miracles. Ou alors c\'était le repos.' },
        { label: 'Serrer les dents (production −20 % pendant 4 min)', effects: { timed: { label: 'Épidémie de rhume', icon: '🤧', dur: 240, effects: [{ t: 'prod', target: 'all', v: -0.2 }] } }, result: 'Ça passera. Atchoum.' },
      ],
    };
  },

  greve: (run, ctx) => {
    if ((run.transit || []).length < 6) return null;
    return {
      icon: '🪧', title: 'Les porteurs font grève',
      text: '« Plus de pauses, des sandales neuves ! » Le syndicat des porteurs a peint des pancartes. Elles sont assez réussies.',
      choices: [
        { label: 'Négocier (−50 nourriture, porteurs +20 % pendant 5 min)', cost: { nourriture: 50 }, effects: { timed: { label: 'Porteurs motivés', icon: '👟', dur: 300, effects: [{ t: 'logi', v: 0.2 }] } }, result: 'Sandales neuves pour tout le monde ! Ils courent plus vite que jamais.' },
        { label: 'Ignorer (porteurs −35 % pendant 3 min)', effects: { timed: { label: 'Grève des porteurs', icon: '🪧', dur: 180, effects: [{ t: 'logi', v: -0.35 }] } }, result: 'Les cellules avancent… lentement… très lentement.' },
      ],
    };
  },

  erudit: (run, ctx) => ({
    icon: '🧑‍🏫', title: 'Un érudit itinérant',
    text: 'Un savant à la barbe impressionnante propose ses services. Il a écrit trois traités, dont un sur les barbes.',
    choices: [
      { label: 'L\'héberger (−25 nourriture, savoir +25 % pendant 5 min)', cost: { nourriture: 25 }, effects: { savoir: 30 + ctx.era * 60, timed: { label: 'Érudit en résidence', icon: '🧑‍🏫', dur: 300, effects: [{ t: 'prod', target: 'res:savoir', v: 0.25 }] } }, result: 'Il donne des conférences passionnantes. Surtout celle sur les barbes.' },
      { label: 'Le remercier', result: 'Il repart vers d\'autres cités, sa barbe au vent.' },
    ],
  }),

  filon: (run, ctx) => {
    const ore = ['pierre', 'cuivre', 'minerai_fer', 'charbon', 'gemmes'][ctx.era];
    return {
      icon: '💎', title: 'Un filon inattendu',
      text: 'Un enfant revient de la colline les poches pleines de cailloux brillants. Ce ne sont pas que des cailloux.',
      choices: [
        { label: 'Exploiter le filon (+' + (ore === 'gemmes' ? 20 : 80) + ' ' + ctx.R(ore) + ', +40 pierre)', effects: { res: { [ore]: ore === 'gemmes' ? 20 : 80, pierre: 40 } }, result: 'Un beau petit trésor. L\'enfant reçoit une médaille en bronze.' },
      ],
    };
  },

  encrier: (run, ctx) => ({
    icon: '🦉', title: 'L\'encrier de Maître Hulotte',
    text: 'Catastrophe : Maître Hulotte a égaré son encrier préféré, celui avec la petite plume gravée. Sans lui, il refuse d\'écrire quoi que ce soit.',
    choices: [
      { label: 'Organiser des recherches (−5 outils)', cost: { outils: 5 }, effects: { heritage: 2 }, result: 'Retrouvé… sous son propre perchoir. Hulotte, ému, vous consacre un chapitre entier.' },
      { label: 'Lui offrir un encrier neuf (−20 pierre)', cost: { pierre: 20 }, effects: { heritage: 1 }, result: '« Ce n\'est pas le même, mais il a du caractère. » Hulotte reprend la plume.' },
      { label: '« Écrivez au crayon. »', result: 'Hulotte vous regarde longuement. Très longuement. Puis reprend, au crayon.' },
    ],
  }),
};

// Récompenses des contrats : ressources par ère.
G.CONTRACT_REWARDS = [
  ['bois', 'pierre', 'nourriture'],
  ['bois', 'pierre', 'nourriture', 'bronze'],
  ['planches', 'fer', 'pain', 'outils'],
  ['acier', 'charbon', 'machines', 'textiles'],
  ['alliages', 'electronique', 'carburant', 'acier'],
];

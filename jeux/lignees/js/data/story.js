// Récit de la Lignée : chapitres de l'histoire (une trame suivie d'une partie à l'autre), événements supplémentaires,
// répliques de Maître Hulotte et textes des cinématiques de changement d'ère.
// Les chapitres se déclenchent dans l'ordre, quand leur condition est remplie (voir chronicle.js).
// Un choix peut poser un « drapeau » (effects.flag) que les chapitres suivants relisent : l'histoire se ramifie.

// ---------- Chapitres ----------
// when(run) : condition ; event(run, ctx) : même format que les événements (icon, title, text, choices).
G.CHAPTERS = [
  {
    id: 'ch_feu', when: run => run.era === 0 ? run.time >= 240 : true,
    event: (run, ctx) => ({
      icon: '🔥', chapter: 'Chapitre I — Le premier feu',
      title: 'Le serment du premier feu',
      text: `Un soir, autour des braises, Maître Hulotte s'éclaircit la gorge et déroule un parchemin encore vierge. « Toute lignée commence par une promesse, dit-il. Les anciens appelaient cela le serment. Que jurez-vous à ceux qui viendront après vous ? »`,
      choices: [
        { label: `Prudence : « Nous ne manquerons jamais de vivres » (tours +15 %, PV +10 % pendant toute la partie)`, effects: { flag: 'serment_prudence', timed: { label: 'Serment de prudence', icon: '🛡️', dur: 99999, effects: [{ t: 'towerDmg', v: 0.15 }, { t: 'hp', v: 0.1 }] } }, result: `Hulotte note : « Ils jurèrent de rester debout. » Les braises crépitent, approbatrices.` },
        { label: `Curiosité : « Nous comprendrons le monde » (savoir +15 % pendant toute la partie)`, effects: { flag: 'serment_curiosite', timed: { label: 'Serment de curiosité', icon: '🔭', dur: 99999, effects: [{ t: 'prod', target: 'res:savoir', v: 0.15 }] } }, result: `« Ils jurèrent de chercher. » Hulotte souligne deux fois, ce qui chez lui est un honneur.` },
        { label: `Générosité : « Notre porte restera ouverte » (population +8 % pendant toute la partie)`, effects: { flag: 'serment_generosite', timed: { label: 'Serment de générosité', icon: '🤝', dur: 99999, effects: [{ t: 'pop', v: 0.08 }] } }, result: `« Ils jurèrent d'accueillir. » Quelque part dans la nuit, une famille hésite devant votre lueur. Elle s'approche.` },
      ],
    }),
  },
  {
    id: 'ch_etrangere', when: run => run.era >= 1,
    event: (run, ctx) => ({
      icon: '🧙‍♀️', chapter: 'Chapitre II — L\'étrangère',
      title: 'L\'étrangère aux yeux de cendre',
      text: `Une voyageuse se présente aux portes du forum, un étui de cuir sous le bras. Elle ne demande ni pain ni abri. « J'ai marché trois saisons pour vous remettre ceci, dit-elle. Une tablette gravée de signes que personne ne sait lire. Elle appartient à votre lignée, bien plus qu'à la mienne. » Hulotte, d'ordinaire bavard, ne dit rien. Ses plumes se sont dressées.`,
      choices: [
        { label: `Accepter la tablette et héberger l'étrangère (−40 nourriture, +60 savoir)`, cost: { nourriture: 40 }, effects: { flag: 'tablette', savoir: 60 + ctx.era * 40 }, result: `Elle dort une nuit, puis disparaît avant l'aube, laissant la tablette sur la table. Vos sages la couvrent de craie et de questions. Hulotte la range dans sa bibliothèque, tout au fond, à l'abri des courants d'air.` },
        { label: `Prendre la tablette sans façons (+30 savoir)`, effects: { flag: 'tablette', savoir: 30 }, result: `Elle hausse les épaules et s'en va. La tablette reste énigmatique, et un peu froide.` },
        { label: `La congédier poliment`, effects: { flag: 'tablette_refusee' }, result: `Elle incline la tête, sans reproche, et reprend sa route. « Elle reviendra peut-être, murmure Hulotte. Ou quelqu'un d'autre. »` },
      ],
    }),
  },
  {
    id: 'ch_rival', when: run => run.era >= 1 && ((G.stats && G.stats.pop) || 0) >= 120,
    event: (run, ctx) => ({
      icon: '🐦‍⬛', chapter: 'Chapitre III — Les Corbeaux de l\'Est',
      title: 'La lignée rivale',
      text: `Une délégation en manteaux noirs arrive à cheval : les Corbeaux de l'Est, une autre lignée, aussi ancienne que la vôtre, et beaucoup moins aimable. Leur cheffe, Maëlle Corvinelle, claque des doigts. « Votre cité est jolie, dit-elle. Dommage qu'elle soit si petite. Nous pouvons nous allier, ou nous pouvons nous croiser plus tard, moins poliment. »`,
      choices: [
        { label: `S'allier par un traité de commerce (−60 ${ctx.R(['bois', 'pierre', 'planches', 'acier', 'acier'][ctx.era])}, production +8 % pendant 20 min)`, cost: { [['bois', 'pierre', 'planches', 'acier', 'acier'][ctx.era]]: 60 }, effects: { flag: 'rival_allie', timed: { label: 'Alliance des Corbeaux', icon: '🤝', dur: 1200, effects: [{ t: 'prod', target: 'all', v: 0.08 }] } }, result: `Poignée de main un peu trop longue, sourire un peu trop large. Mais les caravanes des Corbeaux arrivent le lendemain, chargées.` },
        { label: `Les défier avec panache (tours +25 % pendant 10 min)`, effects: { flag: 'rival_defie', timed: { label: 'Fierté de la lignée', icon: '⚔️', dur: 600, effects: [{ t: 'towerDmg', v: 0.25 }] } }, result: `Maëlle éclate de rire et remonte en selle. « Bien. Vous n'êtes pas aussi petits que votre cité. À bientôt. » Hulotte consigne : « présage ambigu ».` },
        { label: `Leur faire visiter la ville, simplement (+1 héritage)`, effects: { flag: 'rival_neutre', heritage: 1 }, result: `Après trois heures de visite, Maëlle repart un peu moins sûre d'elle. La Chronique y voit de la diplomatie.` },
      ],
    }),
  },
  {
    id: 'ch_cathedrale', when: run => run.era >= 2,
    event: (run, ctx) => ({
      icon: '⛪', chapter: 'Chapitre IV — Le chantier des siècles',
      title: 'Bâtir pour ceux qui viendront',
      text: `Les maçons de votre cité réclament un projet digne de durer plus longtemps qu'eux. « Une pierre que l'on pose aujourd'hui, disent-ils, sera encore là quand nos arrière-arrière-petits-enfants se disputeront à son sujet. » Hulotte approuve vivement : « Un monument, c'est une chronique que personne ne peut effacer. »`,
      choices: [
        { label: `Un grand monastère-bibliothèque (−80 pierre, −60 planches : savoir +20 % pendant 15 min)`, cost: { pierre: 80, planches: 60 }, effects: { flag: 'cath_savoir', timed: { label: 'Bibliothèque de la lignée', icon: '📚', dur: 900, effects: [{ t: 'prod', target: 'res:savoir', v: 0.2 }] } }, result: `Les copistes arrivent par dizaines. Hulotte pleure discrètement dans son aile du bâtiment : on lui a réservé un perchoir.` },
        { label: `Des remparts d'une épaisseur ridicule (−100 pierre : PV +20 % pendant 15 min)`, cost: { pierre: 100 }, effects: { flag: 'cath_remparts', timed: { label: 'Remparts épais', icon: '🏰', dur: 900, effects: [{ t: 'hp', v: 0.2 }] } }, result: `On y a mis tant de pierre qu'un éléphant s'y casserait les défenses. Les enfants jouent à y courir.` },
        { label: `Une place publique plantée d'arbres (+1 héritage, population +10 % pendant 15 min)`, effects: { flag: 'cath_place', heritage: 1, timed: { label: 'Belle place publique', icon: '🌳', dur: 900, effects: [{ t: 'pop', v: 0.1 }] } }, result: `On y célèbre des mariages dès la première semaine. C'est la plus belle des fondations : elle sert.` },
      ],
    }),
  },
  {
    id: 'ch_guilde', when: run => run.era >= 2 && ((G.stats && G.stats.pop) || 0) >= 250,
    event: (run, ctx) => ({
      icon: '⚒️', chapter: 'Chapitre V — La guilde des bâtisseurs',
      title: 'Les maîtres de métier',
      text: `Les artisans de votre cité se sont organisés en guilde. Leur doyen, un forgeron aux avant-bras comme des troncs, demande audience. « Nous voulons trois choses, dit-il : un statut, des apprentis, et que l'on arrête de nous demander "pour hier". » Il ne plaisante qu'à moitié.`,
      choices: [
        { label: `Reconnaître la guilde (artisanat +15 % pendant 20 min)`, effects: { flag: 'guilde', timed: { label: 'Guilde reconnue', icon: '⚒️', dur: 1200, effects: [{ t: 'prod', target: 'cat:craft', v: 0.15 }] } }, result: `La guilde fait peindre ses armes sur la porte du forum. Elle est plutôt jolie, vue de près.` },
        { label: `Fonder une école d'apprentis (−40 nourriture, −30 outils : savoir +100)`, cost: { nourriture: 40, outils: 30 }, effects: { flag: 'ecole', savoir: 100 + ctx.era * 40 }, result: `Les premiers apprentis arrivent, le nez encore plein de suie. Dans dix ans, ils corrigeront leurs maîtres.` },
        { label: `Refuser : « La cité décide »`, effects: { flag: 'guilde_refus' }, result: `Le doyen sort sans bruit. La porte du forum claque quand même un peu.` },
      ],
    }),
  },
  {
    id: 'ch_machine', when: run => run.era >= 3,
    event: (run, ctx) => ({
      icon: '⚙️', chapter: 'Chapitre VI — La machine qui calcule',
      title: 'Les ingénieurs et la Machine',
      text: `Dans un atelier enfumé, vos ingénieurs ont assemblé une machine à rouages qui additionne plus vite que trois comptables. Elle a même corrigé une erreur de Hulotte, ce qu'il ne pardonne qu'à moitié. « Elle pourrait tout faire, dit l'inventeur. Si on la laisse. » ${run.flags && run.flags.guilde ? 'La guilde, de son côté, murmure qu\'elle veut garder ses emplois.' : ''}`,
      choices: [
        { label: `Automatiser largement (production +12 % pendant 20 min, population −5 %)`, effects: { flag: 'machine_auto', timed: { label: 'Automatisation', icon: '🤖', dur: 1200, effects: [{ t: 'prod', target: 'all', v: 0.12 }, { t: 'pop', v: -0.05 }] } }, result: `Les cadences s'envolent. Les ouvriers regardent la machine avec un respect un peu méfiant.` },
        { label: `La mettre au service des ouvriers (population +10 %, production +5 % pendant 20 min)`, effects: { flag: 'machine_humaine', timed: { label: 'Machine au service du peuple', icon: '🧑‍🏭', dur: 1200, effects: [{ t: 'pop', v: 0.1 }, { t: 'prod', target: 'all', v: 0.05 }] } }, result: `La machine calcule, les humains décident. Hulotte inscrit : « équilibre trouvé ». Il la regarde du coin de l'œil.` },
        { label: `La démonter pour étude (+120 savoir)`, effects: { flag: 'machine_demontee', savoir: 120 + ctx.era * 80 }, result: `On l'ouvre, on la mesure, on la dessine. Trois ans plus tard, ses plans équiperont toutes les écoles.` },
      ],
    }),
  },
  {
    id: 'ch_signal', when: run => run.era >= 4,
    event: (run, ctx) => {
      const tab = run.flags && run.flags.tablette;
      return {
        icon: '📡', chapter: 'Chapitre VII — Le Signal',
        title: 'Un signal venu d\'au-delà',
        text: `Dans la nuit, vos radios captent une suite de pulsations très régulières, venue du ciel. ${tab ? 'Votre savant le plus âgé blêmit : les motifs ressemblent trait pour trait aux signes de la vieille tablette de l\'étrangère. « Elle savait, murmure-t-il. Elle savait depuis le début. »' : 'Personne ne sait ce que cela veut dire, mais tout le monde se tait pour l\'écouter.'} Hulotte ouvre son plus grand registre. « Écrivez que nous avons été appelés, dit-il. Même si nous ne savons pas encore par qui. »`,
        choices: [
          { label: tab ? `Déchiffrer le signal avec la tablette (+300 savoir, savoir +25 % pendant 15 min)` : `Déchiffrer le signal avec tous les moyens du bord (+150 savoir)`, effects: { flag: 'signal_dechiffre', savoir: tab ? 300 + ctx.era * 80 : 150, timed: tab ? { label: 'Signal déchiffré', icon: '📡', dur: 900, effects: [{ t: 'prod', target: 'res:savoir', v: 0.25 }] } : undefined }, result: tab ? `Le message tient en une phrase : « Venez nous retrouver. » La tablette a trouvé son sens, et Hulotte, un moment de silence.` : `Le signal tient en une phrase inachevée : « Venez nous ret… ». Il se répète en boucle, patiemment.` },
          { label: `Répondre immédiatement (−30 électronique ou −100 outils : +2 héritage)`, cost: ctx.era >= 4 && (run.res.electronique || 0) >= 30 ? { electronique: 30 } : { outils: 100 }, effects: { flag: 'signal_repondu', heritage: 2 }, result: `Votre réponse part dans la nuit. La suite du signal change de rythme : on vous a entendus. Hulotte en lâche son encrier.` },
          { label: `Garder le secret (population +5 % pendant 15 min)`, effects: { flag: 'signal_secret', timed: { label: 'Le secret du ciel', icon: '🤫', dur: 900, effects: [{ t: 'pop', v: 0.05 }] } }, result: `Quelques initiés le savent. Les autres dorment tranquilles. La Chronique, elle, n'oublie pas.` },
        ],
      };
    },
  },
  {
    id: 'ch_veille', when: run => run.buildings.some(b => b.type === 'pas_de_tir'),
    event: (run, ctx) => ({
      icon: '🚀', chapter: 'Chapitre VIII — La veille du départ',
      title: 'Qui montera à bord ?',
      text: `Le pas de tir est posé. Le vaisseau, encore à l'état de promesse, domine la plaine. Les volontaires s'alignent, valise en main, mais la question reste entière : à qui confier le voyage ? Hulotte tourne son registre, hésite, puis déclare : « Cette page-ci, c'est à vous de l'écrire. »`,
      choices: [
        { label: `Un équipage de savants (savoir +30 % pendant 20 min)`, effects: { flag: 'equipage_savants', timed: { label: 'Équipage de savants', icon: '🧑‍🔬', dur: 1200, effects: [{ t: 'prod', target: 'res:savoir', v: 0.3 }] } }, result: `Quarante têtes pleines de formules, et un cuisinier. Hulotte pense déjà au cuisinier.` },
        { label: `Un équipage de bâtisseurs (coûts −10 % pendant 20 min)`, effects: { flag: 'equipage_batisseurs', timed: { label: 'Équipage de bâtisseurs', icon: '🧑‍🏭', dur: 1200, effects: [{ t: 'cost', v: -0.1 }] } }, result: `Ils savent monter un campement, réparer une coque, et réparer le moral. Ils sont les moins bavards du groupe.` },
        { label: `Un équipage de toute la lignée (+2 héritage, population +10 % pendant 20 min)`, effects: { flag: 'equipage_lignee', heritage: 2, timed: { label: 'Équipage de la lignée', icon: '👪', dur: 1200, effects: [{ t: 'pop', v: 0.1 }] } }, result: `Des jeunes, des vieux, des chats même. Le vaisseau est un peu surchargé, mais pas un seul passager n'a l'air triste.` },
      ],
    }),
  },
  {
    id: 'ch_apres1', when: run => !!run.launched,
    event: (run, ctx) => ({
      icon: '🌌', chapter: 'Chapitre IX — Au-delà de la planète',
      title: 'Le silence des étoiles',
      text: `Le vaisseau a disparu, mais la lignée est restée. Les rues sont étrangement calmes. Sur la place, un enfant demande : « Et maintenant ? » Hulotte, perché sur son nouveau toit de verre, lève la tête vers le ciel qui devient noir. « Maintenant, dit-il, on continue d'écrire. Pas pour ceux qui sont partis. Pour ceux qui voudront un jour revenir. »`,
      choices: [
        { label: `Fonder l'Observatoire du retour (savoir +30 % pendant 30 min)`, effects: { flag: 'observatoire', timed: { label: 'Observatoire du retour', icon: '🔭', dur: 1800, effects: [{ t: 'prod', target: 'res:savoir', v: 0.3 }] } }, result: `Chaque nuit, un télescope se tourne vers la constellation où le vaisseau a disparu. Il n'y a rien à voir. On regarde quand même.` },
        { label: `Entretenir la flamme de la cité (production +10 % pendant 30 min)`, effects: { flag: 'flamme', timed: { label: 'La flamme entretenue', icon: '🔥', dur: 1800, effects: [{ t: 'prod', target: 'all', v: 0.1 }] } }, result: `Le premier feu de la lignée brûle toujours, au centre du forum. Quelqu'un y ajoute une bûche, comme chaque soir.` },
      ],
    }),
  },
  {
    id: 'ch_apres2', when: run => !!run.launched && run.time - (run.launchedAt || 0) >= 900,
    event: (run, ctx) => ({
      icon: '✉️', chapter: 'Épilogue — La lettre de Maître Hulotte',
      title: 'Un message de l\'espace',
      text: `Un matin, la radio crépite. Une voix lointaine, hachée, mais familière, prononce quelques mots : « … bien arrivés… la lignée… écrivez-nous… » Hulotte laisse tomber sa plume. Pour la première fois depuis très longtemps, il ne sait pas quoi noter. Alors il note simplement : « Ils vivent. » La page est restée pâle, mais c'est la plus belle de la Chronique.`,
      choices: [
        { label: `Leur répondre longuement (+3 héritage)`, effects: { flag: 'lettre', heritage: 3 }, result: `Votre lettre part par faisceau. Elle contient la liste de tous ceux qui sont restés, et une recette de pain. Les deux sont indispensables.` },
        { label: `Garder la lettre dans la Chronique (savoir +200)`, effects: { flag: 'lettre', savoir: 200 + ctx.era * 200 }, result: `On la copie vingt fois. Chaque école de la lignée en détient désormais un exemplaire, derrière une vitre.` },
      ],
    }),
  },
];

// ---------- Nouveaux événements ----------
Object.assign(G.EVENTS, {
  tempete: (run, ctx) => ({
    icon: '⛈️', title: 'Une tempête sur la plaine',
    text: `Le ciel vire au gris ardoise, puis au noir. Le vent arrache des tuiles, des bâches, et la perruque d'un notable. Hulotte s'est réfugié dans un tonneau.`,
    choices: [
      { label: `Tout bâcher (−40 bois, −20 pierre)`, cost: { bois: 40, pierre: 20 }, result: `Tout tient. On a même sauvé la perruque du notable, qui jure de ne plus jamais sortir sans elle.` },
      { label: `Laisser le vent passer (production −15 % pendant 3 min)`, effects: { timed: { label: 'Après la tempête', icon: '⛈️', dur: 180, effects: [{ t: 'prod', target: 'all', v: -0.15 }] } }, result: `Une heure de grêle, deux jours de rangement. Les enfants, eux, ont adoré.` },
    ],
  }),
  festival: (run, ctx) => ({
    icon: '🎪', title: 'Le festival des récoltes',
    text: `On propose de célébrer les moissons : banderoles, tambours, un concours de la plus grosse citrouille. Hulotte tient déjà son carnet pour noter les gagnants.`,
    choices: [
      { label: `Organiser une grande fête (−60 nourriture : population +15 % pendant 6 min, +1 héritage)`, cost: { nourriture: 60 }, effects: { heritage: 1, timed: { label: 'Festival', icon: '🎪', dur: 360, effects: [{ t: 'pop', v: 0.15 }] } }, result: `La plus grosse citrouille mesure deux mètres. Elle gagne, évidemment, mais le meilleur moment reste la danse du soir.` },
      { label: `Une petite fête sobre (−20 nourriture : +20 savoir)`, cost: { nourriture: 20 }, effects: { savoir: 20 + ctx.era * 30 }, result: `Un petit feu, trois chansons, une histoire de plus. Les anciens sourient.` },
    ],
  }),
  comete: (run, ctx) => ({
    icon: '☄️', title: 'Une comète dans le ciel',
    text: `Une traînée brillante déchire la nuit. Les uns y voient un présage, les autres un joli spectacle. Hulotte s'est déjà fait un thé pour mieux observer.`,
    choices: [
      { label: `L'observer avec tous les moyens du bord (savoir +${60 + ctx.era * 60})`, effects: { savoir: 60 + ctx.era * 60 }, result: `Les calculs des savants sont étonnamment justes. La comète reviendra dans soixante-seize ans. Ils lui laissent un message.` },
      { label: `Y voir un signe de bonheur (+1 héritage)`, effects: { heritage: 1 }, result: `Les habitants dansent. La suite des événements ne confirmera rien, mais la danse, elle, aura bien eu lieu.` },
    ],
  }),
  pelerins: (run, ctx) => {
    if (ctx.era < 1) return null;
    return {
      icon: '🧭', title: 'Des pèlerins en chemin',
      text: `Une longue file de pèlerins traverse votre territoire en chantant. Ils vont vers un lieu que personne ne sait nommer, mais ils y vont avec une conviction admirable.`,
      choices: [
        { label: `Les nourrir (−50 nourriture : +1 héritage, savoir +40)`, cost: { nourriture: 50 }, effects: { heritage: 1, savoir: 40 + ctx.era * 30 }, result: `Ils laissent derrière eux une comptine, une recette et trois bons conseils de voyage.` },
        { label: `Les laisser traverser en paix`, result: `Ils passent comme un fleuve tranquille. Le silence qui suit est étonnamment doux.` },
      ],
    };
  },
  archives: (run, ctx) => ({
    icon: '📚', title: 'Les archives de Hulotte',
    text: `En fouillant les caves du forum, Hulotte retrouve des centaines de rouleaux oubliés. « Mes premières chroniques, murmure-t-il. Il y a des fautes d'orthographe. Je n'en parlerai à personne. »`,
    choices: [
      { label: `Les trier avec soin (−5 outils : +2 héritage)`, cost: { outils: 5 }, effects: { heritage: 2 }, result: `On y trouve des listes de rois que personne ne connaissait, et un conte de fées étonnamment juste.` },
      { label: `Les faire étudier par vos savants (savoir +${50 + ctx.era * 50})`, effects: { savoir: 50 + ctx.era * 50 }, result: `Beaucoup de bêtises. Quelques idées, quand même, qu'on remet à l'honneur.` },
    ],
  }),
  inventeur: (run, ctx) => {
    if (ctx.era < 2) return null;
    return {
      icon: '🧪', title: 'L\'inventeur distrait',
      text: `Un inventeur, les sourcils roussis, demande des fonds pour son « moteur à rêves ». Il n'a pas précisé s'il fonctionnait avec du charbon ou de l'imagination.`,
      choices: [
        { label: `Le financer (−${40 + ctx.era * 20} outils : production +15 % pendant 5 min)`, cost: { outils: 40 + ctx.era * 20 }, effects: { timed: { label: 'Moteur à rêves', icon: '🧪', dur: 300, effects: [{ t: 'prod', target: 'all', v: 0.15 }] } }, result: `Le moteur fonctionne ! Pendant cinq minutes. Puis il s'envole. Mais la production, elle, y gagne un bon élan.` },
        { label: `Le financer à moitié (−${20 + ctx.era * 10} outils : +40 savoir)`, cost: { outils: 20 + ctx.era * 10 }, effects: { savoir: 40 + ctx.era * 30 }, result: `Il revient avec un plan, trois croquis et un chapeau cabossé. Les croquis sont excellents.` },
        { label: `Lui indiquer la sortie`, result: `Il part en grommelant. Quelques semaines plus tard, un nouvel inventeur le remplacera.` },
      ],
    };
  },
  saboteur: (run, ctx) => {
    if (ctx.era < 3) return null;
    return {
      icon: '🕵️', title: 'Un saboteur dans l\'atelier',
      text: `Des boulons ont disparu, des rouages ont été dérangés. Le contremaître a des soupçons, mais surtout un dossier de quarante pages.`,
      choices: [
        { label: `Renforcer la surveillance (−30 outils : PV +10 % pendant 8 min)`, cost: { outils: 30 }, effects: { timed: { label: 'Atelier surveillé', icon: '🔎', dur: 480, effects: [{ t: 'hp', v: 0.1 }] } }, result: `Le saboteur, un jeune homme au regard fuyant, se fait prendre en trois jours. Il voulait seulement de l'attention.` },
        { label: `Ignorer (production −15 % pendant 4 min)`, effects: { timed: { label: 'Sabotage', icon: '🕵️', dur: 240, effects: [{ t: 'prod', target: 'all', v: -0.15 }] } }, result: `Les cadences ralentissent un moment. Puis tout s'arrange, dans un grand bruit de ferraille.` },
      ],
    };
  },
  meteorites: (run, ctx) => {
    if (ctx.era < 4) return null;
    return {
      icon: '🌠', title: 'Une pluie de météorites',
      text: `Les alarmes retentissent : des fragments rocheux traversent l'atmosphère. Heureusement, ils sont petits, et tombent dans des champs vides. Leur contenu, en revanche, est étrangement scintillant.`,
      choices: [
        { label: `Récupérer les fragments (+25 gemmes, +60 savoir)`, effects: { res: { gemmes: 25 }, savoir: 60 }, result: `Un matin de collecte, des paniers pleins, et des enfants qui jurent avoir vu les étoiles tomber exprès pour eux.` },
        { label: `Les laisser aux chercheurs (savoir +${150 + ctx.era * 40})`, effects: { savoir: 150 + ctx.era * 40 }, result: `Les analyses révèlent des métaux qu'on ne connaissait pas. Ils sont rangés dans un coffre portant l'étiquette « ne pas lécher ».` },
      ],
    };
  },
  poete: (run, ctx) => ({
    icon: '🪶', title: 'Le poète officiel',
    text: `Un jeune poète vient proposer d'écrire l'hymne de la lignée. Il a déjà trois couplets, dont un sur Hulotte, que ce dernier a décrété « un peu trop flatteur, mais pas assez long ».`,
    choices: [
      { label: `Lui commander l'hymne (−20 ${ctx.R(['bois', 'pierre', 'planches', 'acier', 'acier'][ctx.era])} : +2 héritage)`, cost: { [['bois', 'pierre', 'planches', 'acier', 'acier'][ctx.era]]: 20 }, effects: { heritage: 2 }, result: `L'hymne est chanté dès la semaine suivante. Les enfants le chantent trop fort, les anciens trop faux, mais l'émotion y est.` },
      { label: `Lui offrir un repas et un encouragement`, result: `Il repart, ravi, avec un croûton et une promesse. L'hymne attendra.` },
    ],
  }),
});

// ---------- Répliques de Maître Hulotte ----------
(function () {
  const L = G.LORE.events;
  function add(key, lines, prio) {
    if (!L[key]) L[key] = { prio: !!prio, lines: [] };
    lines.forEach(l => L[key].lines.push(l));
  }
  // Ambiance : une remarque de temps en temps, propre à l'ère.
  add('ambient0', [
    `Les mammouths ont de la mémoire, vous savez. Moi aussi. Je me souviens de toutes les histoires avec des mammouths.`,
    `Quelqu'un a inventé la roue, hier. Le même quelqu'un s'est pris les pieds dedans, ce matin. Le progrès est un drame en deux actes.`,
    `Dans mille ans, on retrouvera vos huttes en fouillant le sol. J'espère qu'on dira « des gens ordonnés ».`,
    `Le feu, c'est l'invention préférée de tout le monde. Je compte bien le citer dans chaque chapitre.`,
  ]);
  add('ambient1', [
    `Les premières cités ont toutes un temple, un marché et une querelle de voisinage. Je prends des notes sur les trois.`,
    `Votre écriture fait des progrès : on commence à lire ce que vous avez noté. Je suis presque vexé.`,
    `Le bronze est un métal charmant : on peut y graver son nom. Je réfléchis à une plaque pour mon perchoir.`,
    `On dit que les marchands lointains racontent des histoires fausses. Les meilleures histoires sont presque toujours fausses.`,
  ]);
  add('ambient2', [
    `Les châteaux ont des murs épais, mais les bibliothèques ont des fenêtres. Je préfère largement les secondes.`,
    `Chaque seigneur a un blason. Le vôtre, d'ailleurs, est resté vide. Je propose une chouette. C'est une suggestion neutre.`,
    `Les ménestrels répètent la même légende depuis trois siècles. Elle s'améliore à chaque version, ce qui est louche.`,
    `Les villages deviennent des villes. Les villes deviennent des problèmes d'urbanisme. L'Histoire adore se répéter.`,
  ]);
  add('ambient3', [
    `Tout va plus vite. Même les rumeurs. J'ai mis deux ans à apprendre un nouvel adverbe, il est déjà périmé.`,
    `La fumée des usines est impressionnante. Hélas, elle déteint sur mes plumes. Je ne suis plus gris, je suis anthracite.`,
    `Les ingénieurs s'écrivent des lettres de dix pages sur la taille des boulons. Je trouve cela fascinant et un peu effrayant.`,
    `Le train siffle, la cité vibre. Avant, on mesurait les distances en journées. Maintenant, en retards.`,
  ]);
  add('ambient4', [
    `Je regarde les étoiles depuis ma fenêtre. Elles me regardent aussi, à ce qu'il paraît, mais avec beaucoup de retard.`,
    `Le vide ne fait pas de bruit. Mon registre non plus, du coup, dans l'espace. Je réfléchis à une encre qui chuchote.`,
    `Les ordinateurs ne dorment jamais. Moi non plus, mais j'ai au moins la politesse de faire semblant.`,
    `Chaque fusée qui monte écrit une ligne dans le ciel. Je les appelle des « points de suspension ». Il faut bien un peu de poésie.`,
  ]);
  add('ambient5', [
    `Là-haut, votre vaisseau est un point de lumière. Ici, c'est un point d'honneur.`,
    `Chaque nuit, je vérifie les étoiles. Au cas où l'une d'elles serait en retard pour écrire.`,
    `La Chronique est plus longue que jamais. Je n'ai plus l'âge de tout porter, alors vos savants font des copies. Elles sont presque aussi lisibles que les miennes.`,
    `Les recherches s'enchaînent, sans fin ni mesure. J'y vois une très bonne définition de l'avenir : une page toujours blanche.`,
  ]);
  // Paliers de gloire.
  add('milestone', [
    `Un palier de plus, et de la gloire en réserve pour la prochaine lignée. L'Histoire retient ce genre de détail.`,
    `Noté : « {what} ». La Grande Chronique s'étoffe, les cartes de maîtrise attendent sagement.`,
    `Ce n'est pas encore la fin de la page, mais c'est déjà un joli paragraphe.`,
  ]);
  add('launchBack', [
    `Le vaisseau est parti, la lignée reste, et les recherches infinies commencent. C'est ça, la vraie gloire : continuer.`,
    `Chaque recherche d'après le départ ajoute un peu de lumière à la gloire de la lignée. Les étoiles peuvent attendre, nous aussi.`,
  ], true);
  add('chapter', [
    `Une nouvelle page de la Chronique s'ouvre. Soyons à la hauteur de l'encre.`,
    `L'Histoire frappe à la porte. Ouvrez, elle n'a jamais l'air de plaisanter.`,
  ], true);
  add('research', [
    `Une recherche de plus ! Je note la date, l'heure, et ma propre émotion, pour la postérité.`,
    `Le savoir avance. Les erreurs aussi, mais elles font de bonnes anecdotes.`,
    `Encore une découverte. À ce rythme, je vais devoir agrandir le chapitre « Idées reçues ».`,
  ]);
  add('waveWon', [
    `La paix revient. La paix, c'est ce moment où l'on peut enfin s'occuper des tâches ennuyeuses : les stocks, les routes, les impôts.`,
    `Repoussés, et sans trop de dégâts ! Je m'octroie une pause, qui durera exactement le temps d'une plume trempée.`,
  ]);
  add('ruin', [
    `Une ruine de plus… On dit qu'une cité se mesure à ce qu'elle reconstruit. Alors la vôtre est sans limite.`,
  ]);
  add('levelUp', [
    `Un bâtiment amélioré, une journée plus douce. Les petits progrès sont les plus durables.`,
  ]);
})();

// ---------- Cinématiques de changement d'ère ----------
// kicker : petite ligne au-dessus du titre ; quote : citation de Hulotte affichée à la fin de la scène.
G.CINE = {
  1: { kicker: 'Le premier âge des cités', quote: `« Les champs se dessinent, la pierre se dresse, et pour la première fois on se dit : et si on restait ? » — Maître Hulotte` },
  2: { kicker: 'Le siècle des pierres et du fer', quote: `« Un château, c'est une promesse faite avec des cailloux. Elle dure plus longtemps que la plupart des autres. » — Maître Hulotte` },
  3: { kicker: 'Le grondement des machines', quote: `« La cité respire par ses cheminées. Elle tousse un peu, mais elle ne s'est jamais sentie aussi vivante. » — Maître Hulotte` },
  4: { kicker: 'Vers les étoiles', quote: `« La nuit n'est plus un plafond, c'est une porte. Reste à trouver la clé. » — Maître Hulotte` },
  launch: { kicker: 'Décollage', quote: `« Trois, deux, un… Adieu, planète. Nous écrirons la suite là-haut. » — Maître Hulotte` },
};

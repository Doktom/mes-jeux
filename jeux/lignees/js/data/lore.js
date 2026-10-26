// Lore : Maître Hulotte, chouette archiviste de la Grande Chronique, commente la partie.
// Chaque événement a plusieurs répliques ; {variables} remplacées à l'affichage.
// prio : les répliques importantes passent devant et ignorent le délai entre deux bulles.
G.LORE = {
  name: 'Maître Hulotte',
  title: 'Archiviste de la Grande Chronique',
  icon: '🦉',
  events: {
    start: { prio: true, lines: [
      'Ah, une nouvelle lignée ! J\'ouvre un registre tout neuf. Origine : {origin}. Je souligne deux fois, c\'est plus solennel.',
      'Hulotte, archiviste en chef, pour vous servir. Je note tout, je juge un peu, je ne vole jamais. Commençons : {origin} !',
      'Page 1 de la Grande Chronique : « Ils arrivèrent, virent une plaine, et dirent : ça fera l\'affaire. » Bienvenue, {origin}.',
    ] },
    waveWarn: { prio: true, lines: [
      'Des {enemy}s approchent {side} ! J\'ai déjà préparé la page « Bravoure »… et, par prudence, la page « Fuite ».',
      'Mes plumes se hérissent : ça vient {side}. Vérifiez vos tours, je vérifie mon encrier.',
      'Alerte {side} ! Rappel du règlement : les envahisseurs ne sont pas autorisés à piétiner les champs. Ils l\'ignorent, hélas.',
    ] },
    waveStart: { lines: [
      '{n} assaillants. Je les compte deux fois, au cas où l\'un d\'eux se serait caché derrière un autre.',
      'La bataille commence ! J\'écris vite, mais pas aussi vite qu\'ils courent.',
      'À vos postes ! Moi, mon poste, c\'est ce perchoir. Très stratégique. Très en hauteur.',
    ] },
    bossStart: { prio: true, lines: [
      'C\'est {boss} en personne ! Je l\'ai déjà vu dans trois chroniques. Il n\'en sortait jamais gagnant, mais il y croyait fort.',
      '{boss} ! Ses cris résonnent jusqu\'aux archives. Il faudra plus que de bonnes intentions.',
    ] },
    waveWon: { lines: [
      'Victoire ! J\'inscris « repoussés avec panache ». Le panache est facultatif, mais il fait bien dans le texte.',
      '{n} vague(s) repoussée(s). Je commence à manquer d\'adjectifs héroïques. « Superbe », c\'est déjà pris ?',
      'Ils s\'enfuient ! Notez qu\'ils ont laissé leurs affaires. Le butin, c\'est un peu la paperasse du vainqueur.',
      'Le calme revient. Profitez-en pour ranger : un champ de bataille bien tenu est un champ de bataille rassurant.',
    ] },
    bossWon: { prio: true, lines: [
      'Le chef est tombé ! Je lui consacre une note de bas de page. Petite. Police réduite.',
      'Quel triomphe ! Le peuple réclame une faveur, et franchement, il l\'a méritée.',
    ] },
    flee: { prio: true, lines: [
      'Ils repartent avec {pct} % de nos réserves… J\'inscris « prêt à durée indéterminée », c\'est plus digne.',
      'Pillés ! Mon registre des stocks pleure. Moi aussi, un peu. Il nous faut plus de tours.',
    ] },
    ruin: { lines: [
      'Notre {building} est en ruine. Je barre son nom… au crayon, pour pouvoir le réparer.',
      'Un {building} de moins. Les ruines, c\'est pittoresque, mais ça produit peu.',
    ] },
    forumHurt: { prio: true, lines: [
      'Le forum vacille ! Si le forum tombe, la Chronique s\'arrête… et je serai au chômage. Défendez-le !',
      'Hulotte à tout le monde : LE FORUM. On protège LE FORUM. Je le souligne trois fois.',
    ] },
    firstResearch: { prio: true, lines: [
      'Votre première découverte : {tech} ! J\'ouvre enfin la section « Idées brillantes ». Elle était un peu vide.',
    ] },
    research: { lines: [
      '{tech} ! Les sages sont ravis. Ils ont fêté ça avec une tisane. Les sages font la fête très calmement.',
      'Nouvelle connaissance : {tech}. Je range le parchemin à la lettre T… ou à la lettre S… je verrai.',
      '{tech}, découverte majeure. Enfin, majeure jusqu\'à la prochaine.',
    ] },
    levelUp: { lines: [
      'Votre {building} passe au niveau {level}. Même case, plus de travail : l\'urbanisme, c\'est l\'art de tasser.',
      'Niveau {level} pour le {building} ! Les porteurs ont plus de bras, et le registre plus de colonnes.',
    ] },
    annex: { lines: [
      '{n} cases annexées d\'un coup ! Les cartographes réclament une pause et des crayons neufs.',
      'Nos frontières s\'étirent de {n} cases. J\'agrandis la carte… je vais avoir besoin d\'une table plus grande.',
    ] },
    era1: { prio: true, lines: [
      'L\'Antiquité ! On sème, on récolte, on invente l\'écriture… Enfin ! Je n\'aurai plus à tout retenir de tête.',
    ] },
    era2: { prio: true, lines: [
      'Le Moyen Âge ! Fini les huttes qui sentent la fumée, bonjour les maisons qui sentent… la fumée aussi, mais avec du pain.',
    ] },
    era3: { prio: true, lines: [
      'L\'ère industrielle ! Tout fume, tout siffle, tout produit. Je vais devoir dépoussiérer mes plumes plus souvent.',
    ] },
    era4: { prio: true, lines: [
      'L\'ère spatiale ! Les savants parlent d\'aller là-haut, parmi les étoiles. Je prépare un tome spécial, résistant au vide.',
    ] },
    launch: { prio: true, lines: [
      'Trois… deux… un… DÉCOLLAGE ! Votre peuple quitte la planète. Je ferme la Grande Chronique… et j\'en ouvre une nouvelle, quelque part là-haut.',
    ] },
    rigUnlock: { prio: true, lines: [
      'Votre renommée franchit les frontières… et attire les convoitises. « {name} » est désormais disponible pour vos prochaines lignées. J\'ai déjà taillé mes plumes de guerre.',
      'Nouvelle difficulté débloquée : {name}. Les envahisseurs ont entendu parler de vous. Je ne dis pas que c\'est ma faute, mais j\'ai peut-être trop bien écrit.',
    ] },
    thief: { prio: true, lines: [
      'Un {enemy} chaparde nos cellules en plein transit ! Abattez-le avant qu\'il ne file : on récupérera le butin.',
      'Au voleur ! Ce {enemy} vise nos porteurs. Des tours le long des routes ne seraient pas de trop.',
    ] },
    contractFirst: { prio: true, lines: [
      'La Chronique propose des contrats ! Remplissez-les à temps : héritage et récompenses à la clé. Ils sont dans l\'onglet Civilisation.',
    ] },
    contractDone: { lines: [
      'Contrat rempli : {what}. Je tamponne. J\'adore tamponner.',
      'Et un contrat honoré ! La Chronique se souviendra de votre ponctualité.',
    ] },
    contractFail: { lines: [
      'Contrat expiré… Je le range dans le tiroir « une autre fois ». Il est déjà bien rempli.',
    ] },
    season0: { lines: ['Le printemps ! Les bourgeons bourgeonnent, les abeilles abeillent. Je manque d\'inspiration, mais pas de joie.'] },
    season1: { lines: ['L\'été ! Les champs dorent au soleil. Les porteurs transpirent, mais avec le sourire.'] },
    season2: { prio: true, lines: ['L\'automne arrive. Conseil d\'archiviste : stockez du bois. Beaucoup de bois. L\'hiver n\'a aucun sens de l\'humour.'] },
    season3: { prio: true, lines: ['L\'hiver ! Les champs dorment, les cheminées fument. Sans bois de chauffage, vos habitants grelotteront et s\'en iront.'] },
    depleting: { prio: true, lines: ['Le filon de votre {building} s\'épuise. Prévoyez la suite : un nouveau gisement ne se trouve pas sous le sabot d\'un cheval.'] },
    wonder: { prio: true, lines: [
      'La {name} est achevée ! J\'en ai les plumes qui frissonnent. Je lui réserve une page entière, avec enluminures.',
      '{name} : terminée ! Dans mille ans, on viendra la visiter. Et on lira ma chronique dans la file d\'attente.',
    ] },
    achievement: { prio: true, lines: [
      'Succès : « {name} ». Je l\'inscris en lettres dorées. Enfin, jaunes. L\'or est hors budget.',
      '« {name} » ! Voilà qui mérite une ligne dans la Grande Chronique… et un biscuit pour l\'archiviste.',
    ] },
    offline: { lines: [
      'Vous revoilà ! Pendant {time}, vos gens ont travaillé. Moi, j\'ai surveillé. Surtout dormi, en surveillant.',
      '{time} d\'absence. Aucun envahisseur ne s\'est montré : ils attendent que vous soyez là, par politesse.',
    ] },
    stockFull: { lines: [
      'Les stocks débordent ! Un entrepôt rangerait tout ça. Je ne dis pas ça pour moi, j\'aime juste l\'ordre.',
    ] },
    waiting: { lines: [
      'Votre {building} attend ses livraisons ({res}) et se tourne les pouces. Une chaîne plus courte, peut-être ?',
    ] },
  },
};

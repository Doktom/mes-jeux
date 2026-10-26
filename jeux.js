// Liste des jeux affichés sur la page d'accueil.
// Pour ajouter un jeu : mets ses fichiers dans jeux/<dossier>/ (avec un index.html),
// une capture dans apercus/<dossier>.jpg, puis ajoute un bloc ci-dessous.
const JEUX = [
  {
    dossier: "lignees",
    titre: "Lignées",
    emoji: "🏛️",
    genre: "Gestion idle · roguelike",
    couleur: "#ffd23f",
    commentaire: "Tu commences avec trois huttes, tu finis dans l'espace. Entre les deux, une chouette commente tes choix d'urbanisme.",
  },
  {
    dossier: "peche-perchee",
    titre: "Pêche Perchée",
    emoji: "🦦",
    genre: "Pêche 3D · humour perché",
    couleur: "#3ae0d6",
    commentaire: "Une loutre, un caillou avec des yeux qui s'appelle Roger, et des poissons qui n'avaient rien demandé.",
  },
  {
    dossier: "royaumes-en-pagaille",
    titre: "Royaumes en Pagaille",
    emoji: "🐑",
    genre: "Stratégie · cartes absurdes",
    couleur: "#ff7a45",
    commentaire: "Le Duché des Moutons Furieux contre la République des Canards. Tu joues des cartes et tu fais semblant d'avoir un plan.",
  },
  {
    dossier: "tout-droit",
    titre: "Tout Droit",
    emoji: "☀️",
    genre: "Plateforme · piégeux",
    couleur: "#ff4f8b",
    commentaire: "Le jeu de plateforme le plus simple du monde. Le Soleil te ment. Le panneau aussi. Probablement nous aussi.",
  },
  {
    dossier: "dieu-joue-aux-des",
    titre: "Dieu Joue aux Dés",
    emoji: "🎲",
    genre: "Simulation divine · pixel art",
    couleur: "#a78bfa",
    commentaire: "3000 ans d'histoire en trois minutes. Si un empire s'effondre, c'est la faute des dés. Pas la tienne. Enfin, un peu.",
  },
  {
    dossier: "irie-bay",
    titre: "Irie Bay",
    emoji: "🌴",
    genre: "Ferme chill · île reggae",
    couleur: "#2fa84f",
    commentaire: "Cultive ton yard, élève des poules, pêche au bout de la jetée. Le sound system du village ne s'arrête jamais, et personne ne s'en plaint.",
  },
];

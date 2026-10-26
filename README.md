# La Salle d'Arcade de Doktom

Les petits jeux de Doktom, jouables dans le navigateur : https://doktom.github.io/mes-jeux/

Site statique (HTML/CSS/JS, aucune installation), publié avec GitHub Pages (branche `main`, racine).

- `index.html`, `style.css`, `site.js` : la page d'accueil (cartes 3D, bouton « Je me sens chanceux »)
- `jeux.js` : la liste des jeux (titre, emoji, genre, couleur, commentaire)
- `jeux/<nom>/` : une copie de chaque jeu, prise dans son propre dépôt
- `apercus/<nom>.jpg` : la capture affichée sur la carte

## Ajouter ou mettre à jour un jeu
1. Copier les fichiers du jeu (pas la doc de dev) dans `jeux/<nom>/`.
2. Mettre une capture 800×500 dans `apercus/<nom>.jpg`.
3. Ajouter un bloc dans `jeux.js`.

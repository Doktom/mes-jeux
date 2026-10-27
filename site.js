// Page d'accueil : cartes 3D qui suivent le pointeur, bouton « au hasard », décor flottant.
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const grille = document.getElementById("grille");

JEUX.forEach((jeu, i) => {
  const carte = document.createElement("a");
  carte.className = "carte";
  carte.href = "jeux/" + jeu.dossier + "/";
  carte.style.setProperty("--accent", jeu.couleur);
  carte.style.setProperty("--delai", (i * -1.3) + "s");
  carte.innerHTML = `
    <div class="boite">
      <div class="apercu"><img src="apercus/${jeu.dossier}.jpg" alt="Aperçu de ${jeu.titre}" loading="lazy"></div>
      <span class="sticker">${jeu.emoji}</span>
      <div class="infos">
        <p class="genre">${jeu.genre}</p>
        <h2>${jeu.titre}</h2>
        <p class="commentaire">${jeu.commentaire}</p>
        <span class="jouer">Jouer ▶</span>
      </div>
      <div class="reflet"></div>
    </div>`;
  if (!calme) {
    const boite = carte.querySelector(".boite");
    carte.addEventListener("pointermove", (e) => {
      const r = carte.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      boite.style.setProperty("--ry", (x * 22) + "deg");
      boite.style.setProperty("--rx", (-y * 18) + "deg");
      boite.style.setProperty("--gx", (x + 0.5) * 100 + "%");
      boite.style.setProperty("--gy", (y + 0.5) * 100 + "%");
      carte.classList.add("survol");
    });
    carte.addEventListener("pointerleave", () => {
      boite.style.setProperty("--ry", "0deg");
      boite.style.setProperty("--rx", "0deg");
      carte.classList.remove("survol");
    });
  }
  grille.appendChild(carte);
});

document.querySelector(".compteur").textContent =
  JEUX.length + " jeux en stock · " + (JEUX.length * 1000 + 42) + " bugs corrigés (environ)";

// Bouton « Je me sens chanceux » : le dé tourne, puis on part sur un jeu au hasard.
const hasard = document.getElementById("hasard");
hasard.addEventListener("click", () => {
  const jeu = JEUX[Math.floor(Math.random() * JEUX.length)];
  hasard.classList.add("lance");
  hasard.innerHTML = `<span class="de">🎲</span> Direction… ${jeu.titre} !`;
  setTimeout(() => { location.href = "jeux/" + jeu.dossier + "/"; }, calme ? 0 : 900);
});

// Objets qui flottent dans le décor, piochés dans les emojis des jeux.
const flotteurs = document.querySelector(".flotteurs");
const objets = JEUX.map((j) => j.emoji).concat(["🕹️", "⭐", "👾"]);
for (let i = 0; i < 14; i++) {
  const o = document.createElement("span");
  o.textContent = objets[i % objets.length];
  o.style.left = (Math.random() * 100) + "%";
  o.style.top = (Math.random() * 70) + "%";
  o.style.fontSize = (18 + Math.random() * 30) + "px";
  o.style.animationDuration = (8 + Math.random() * 10) + "s";
  o.style.animationDelay = (-Math.random() * 10) + "s";
  flotteurs.appendChild(o);
}

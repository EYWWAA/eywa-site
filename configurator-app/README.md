# EYWA — configurateur photographique et bar 3D

Le site public GitHub Pages présente désormais la photographie Celio fournie par Louis, avec ses deux détails (gobelet et latte) réellement créés par l’outil de génération d’images OpenAI. Aucun montage Canvas n’est affiché. La photo complète est la vue principale ; « Explorer en 3D » charge à la demande le modèle GLB fixe. Les trois photographies peuvent être agrandies et sont conservées sans recadrage.

Les autres noms restent acceptés pour l’aperçu 3D. En l’absence de serveur OpenAI actif, l’interface annonce clairement que leurs photographies sur mesure ne sont pas encore disponibles. Elle ne substitue ni un montage, ni l’image d’une autre entreprise. Le catalogue photographique couvre actuellement **Celio uniquement**.

## Génération à la demande — code préparé, accès de production requis

- `server/brand.ts` utilise par défaut **gpt-6-astra**, la recherche web et les sources officielles pour élaborer la direction artistique.
- `server/photo-direction.ts` fixe **gpt-6-astra** comme directeur et **gpt-image-2.5-sunburst** comme outil d’édition, qualité haute. Chaque appel Responses reçoit de vraies images de référence. Aucun retour silencieux à un autre modèle.
- `server/images.ts` génère des photographies complètes, puis fait contrôler par Astra le produit, le logo et le réalisme. Un visuel refusé n’est pas publié. Les succès sont conservés pour éviter de les payer de nouveau lors d’un nouvel essai. La limite quotidienne s’applique à chaque image, et non seulement aux scènes.
- La référence réelle du bar prime sur l’exemple Celio pour la géométrie et l’équipement. Le gobelet et le latte générés deviennent des références stables jusqu’au remplacement par des photos réelles. Une édition générative ne garantit pas une conservation pixel par pixel ; le contrôle visuel réduit les dérives sans remplacer une validation humaine. La géométrie GLB, elle, reste identique pour chaque marque.

Documentation consultée le 24 septembre 2026 :
https://developers.openai.com/api/docs/models/gpt-6-astra
https://developers.openai.com/api/docs/guides/tools-image-generation

## Déploiement

Le frontend est publié sur `https://eywacoffeecatering.com/configurateur/` : `pnpm build:pages` exporte dans `../configurateur/`, sous `/configurateur`. Le domaine professionnel est la destination par défaut des liens. Les anciens fichiers JS portant une empreinte restent accessibles aux pages mises en cache. `EYWA_BASE_PATH` et `EYWA_SITE_URL` permettent de préparer une autre destination explicitement.

Le backend est une application Next.js Node 22.13+ (`pnpm build`, puis démarrage standalone) qui nécessite un **disque persistant** pour SQLite, les verrous, les quotas et les images. Le Dockerfile existant convient à un hôte avec volume persistant. Ne pas déployer ce stockage local tel quel dans une fonction Vercel éphémère : remplacer d’abord SQLite/fichiers par une base et un stockage d’objets durables si cet hébergement est retenu.

Pour activer le parcours photographique :

1. Configurer la clé `OPENAI_API_KEY` exclusivement côté serveur avec un compte ayant accès aux modèles et une facturation active.
2. Déposer la vraie photo du bar dans le stockage privé et définir `EYWA_BAR_REFERENCE_FILE` (exemple : `./data/eywa-bar-reference.jpg`). Le fichier original reçu est préparé localement dans `data/`, ignoré par Git et jamais publié dans le site.
3. Configurer `EYWA_PUBLIC_API_ORIGIN`, les origines CORS et le stockage durable. Tester les appels réels et le contrôle qualité avant `EYWA_LIVE_ENABLED=true`.
4. Renseigner cette origine HTTPS dans `public/runtime-config.json`, reconstruire et publier la page statique.

Les références via l’administration historique sont également reconnues. Si un ensemble maître approuvé existe, ses photographies prennent priorité. Le GLB v2 de présentation peut être remplacé par un modèle mesuré via l’administration.

## Vérifications

### Préparer le domaine professionnel sans couper le site existant

Après installation des dépendances, exécuter depuis `configurator-app` :

```sh
node scripts/prepare-domain.mjs eywacoffeecatering.com /chemin/vers/un-nouveau-dossier
```

Le script construit une copie statique complète avec `/configurateur` comme chemin de base, les liens du devis et les métadonnées sur le nouveau domaine, et le fichier `CNAME`. Il ne modifie ni le site publié ni les DNS. Le dossier doit être neuf et extérieur au dépôt. Ne publier cette copie qu’après achat et vérification du domaine. L’ancienne adresse GitHub Pages redirige vers le domaine professionnel.

Le serveur peut être contrôlé avec `node --env-file=.env.local scripts/preflight.mjs`. Ce contrôle vérifie les prérequis locaux sans afficher de secrets ni facturer d’appel API. Le stockage SQLite/fichiers nécessite toujours un volume persistant. Une connexion au compte Vercel, à elle seule, ne rend pas cette architecture compatible avec les fonctions Vercel.

`pnpm check`, `pnpm test`, `pnpm build:pages`.

Les tests photographiques simulent le fournisseur : ils vérifient le passage effectif des références à Astra, le cache et le refus d’un résultat non conforme. Ils ne prouvent pas l’accès API de production ni la qualité de résultats qui n’ont pas été générés.

Le viewer WebGL est rendu à la demande. Une projection SVG du même GLB sert de solution de repli sur les appareils sans WebGL ; sa qualité ne représente pas celle d’un rendu GPU. Les dimensions du modèle photo‑basé doivent encore être validées sur le meuble réel.

# EYWA — configurateur de coffee bar

Cette application remplace l’ancien import manuel du configurateur EYWA par une expérience où le prospect saisit seulement le nom d’une marque. Les cinq directions visibles (Celio, Nike, Dior, Cupra et Renault) restent des inspirations rapides ; n’importe quel autre nom peut maintenant produire une proposition éditoriale et ses trois visuels, sans bloquer sur une liste fermée.

## Deux déploiements complémentaires

- `pnpm build:pages` produit `../configurateur/`, une exportation statique à publier sous `/eywa-site/configurateur/` sur GitHub Pages. Elle embarque le GLB photo‑basé v2, le viewer, les directions publiques et les références visuelles générées. En mode statique, la recherche publique Wikidata est mise en cache côté navigateur ; si elle est indisponible, une proposition locale déterministe reste disponible. GitHub Pages ne peut pas garder une clé OpenAI ni exécuter les routes API.
- `pnpm build && node .next/standalone/server.js` produit le backend Node à héberger séparément. La page statique utilise `public/runtime-config.json` pour connaître l’URL HTTPS de ce backend.

L’analyse automatique nécessite `EYWA_LIVE_ENABLED=true`, `OPENAI_API_KEY` et `EYWA_PUBLIC_API_ORIGIN`. Les images nécessitent en plus les références maîtres approuvées et un logo vérifié. Une clé ne doit jamais être placée dans `NEXT_PUBLIC_*` ou dans le dépôt.

## Références maîtres

Le meuble est généré une seule fois par `scripts/build-model.mjs` à partir de la photo reçue : `eywa-bar-v2.glb` conserve un caisson rectangulaire plat, le plateau noyer, les roulettes, le moulin et la machine. Il est le modèle affiché par défaut ; ses surfaces protégées reçoivent uniquement l’habillage de marque. En production, il pourra être remplacé par un GLB mesuré et les références photographiques approuvées. L’interface d’administration `/api/admin/upload` vérifie le type, la taille, les dimensions, les nœuds GLB indispensables (`BAR_FRONT`, `BAR_LEFT`, `BAR_RIGHT`, `COUNTERTOP`) et les ressources embarquées. La calibration des quatre coins est ensuite stockée par `/api/admin/masters`.

La composition des photos est déterministe : le meuble original détouré est recoloré et recomposé après la génération de la plaque d’environnement. Les pixels hors des surfaces calibrées restent inchangés ; la structure, les proportions, les roulettes, le plateau noyer, la machine et le moulin ne sont donc pas régénérés par l’IA.

## Commandes

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm build:pages
```

Le viewer utilise WebGL avec une boucle de rendu limitée à la demande. Un aperçu SVG projeté du même GLB est utilisé lorsqu’un navigateur ne fournit pas WebGL ; la vérification finale de fluidité GPU doit être faite sur un appareil compatible.

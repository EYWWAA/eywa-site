# EYWA — configurateur de coffee bar

Cette application remplace l’ancien import manuel du configurateur EYWA par une expérience où le prospect saisit seulement le nom d’une marque. Les cinq directions visibles (Celio, Nike, Dior, Cupra et Renault) sont des exemples éditoriaux clairement identifiés ; elles ne prétendent pas être une analyse automatique ni un partenariat officiel.

## Deux déploiements complémentaires

- `pnpm build:pages` produit `../configurateur/`, une exportation statique à publier sous `/eywa-site/configurateur/` sur GitHub Pages. Elle embarque le même modèle GLB, le viewer et les exemples. GitHub Pages ne peut pas garder une clé OpenAI ni exécuter les routes API.
- `pnpm build && node .next/standalone/server.js` produit le backend Node à héberger séparément. La page statique utilise `public/runtime-config.json` pour connaître l’URL HTTPS de ce backend.

L’analyse automatique nécessite `EYWA_LIVE_ENABLED=true`, `OPENAI_API_KEY` et `EYWA_PUBLIC_API_ORIGIN`. Les images nécessitent en plus les références maîtres approuvées et un logo vérifié. Une clé ne doit jamais être placée dans `NEXT_PUBLIC_*` ou dans le dépôt.

## Références maîtres

Le meuble est généré une seule fois par `scripts/build-model.mjs`. En production, il doit être remplacé par le GLB réel et les quatre références photographiques approuvées : photo du bar, détourage du bar, gobelet et latte. L’interface d’administration `/api/admin/upload` vérifie le type, la taille, les dimensions, les nœuds GLB indispensables (`BAR_FRONT`, `BAR_LEFT`, `BAR_RIGHT`, `COUNTERTOP`) et les ressources embarquées. La calibration des quatre coins est ensuite stockée par `/api/admin/masters`.

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

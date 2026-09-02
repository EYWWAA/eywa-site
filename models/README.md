# Modèle 3D du bar

Dépose ici ton fichier **`coffee-bar.glb`**. Il sera utilisé automatiquement
à la place du bar de secours dessiné en primitives par `configurateur.js`.

## Format

**GLB** (glTF binaire, extension `.glb`). Un seul fichier, textures incluses.
Le `.gltf` fonctionne aussi mais éparpille les fichiers, le `.glb` est plus simple.

Depuis Blender : `Fichier > Exporter > glTF 2.0`, format **glTF Binary (.glb)**.

## Nommer les pièces, c'est le point important

Le configurateur applique le visuel du client en cherchant les meshes **par leur
nom**. Renomme-les exactement ainsi dans Blender :

| Nom du mesh  | Pièce             | Reçoit le visuel |
|--------------|-------------------|------------------|
| `BAR_FRONT`  | façade avant      | **oui**          |
| `BAR_LEFT`   | panneau gauche    | **oui**          |
| `BAR_RIGHT`  | panneau droit     | **oui**          |
| `COUNTERTOP` | plan de travail   | non              |
| `FRAME`      | structure alu     | non              |
| `WHEELS`     | roulettes         | non              |

Les suffixes automatiques de Blender (`BAR_FRONT.001`) sont tolérés.
Tout mesh portant un autre nom est affiché mais ne reçoit jamais de visuel.

## Les trois panneaux ont besoin d'une UV map

Sans dépliage UV, la texture ne s'affichera pas. Le plus simple pour des faces
planes : sélectionner la face, `U > Projection depuis la vue` ou `U > Dépliage
intelligent`. L'UV doit couvrir tout le carré 0-1 pour que le visuel remplisse
le panneau.

## Orientation et échelle

- Axe **Y vers le haut**, le bar posé sur le sol (`y = 0`).
- Façade tournée vers **+Z**, côté droit vers **+X**.
- Échelle : **1 unité = 1 mètre**. Le bar fait donc environ
  `1,20 × 0,87 × 0,60`. Applique les transformations avant d'exporter
  (`Ctrl+A > Toutes les transformations`).

## Poids

Vise **moins de 3 Mo**. Au-delà, l'aperçu devient lent sur téléphone.
Compresse les textures en 1024 px et active Draco à l'export si besoin.

## Vérifier que c'est bon

Ouvre la page d'accueil, puis dans la console du navigateur :

```js
document.querySelector('[data-configurateur]').eywa.etat()
```

`source` doit indiquer `models/coffee-bar.glb` et `meshes` doit lister les six
noms ci-dessus. S'il en manque un, c'est qu'il est mal nommé.

# Film du parcours EYWA — animation 2D

Film explicatif de 57 secondes : Camille organise un événement, découvre EYWA, fait son devis, réserve en ligne puis accueille le coffee bar. Personnages, gestes, accessoires, boissons et véhicule sont dessinés et animés dans le code. Les écrans du devis et de la réservation sont des captures locales du site. Narration française de synthèse (voix macOS Thomas) et sous-titres. Aucune demande n’a été envoyée.

Direction visuelle demandée : [TOSIZE.fr | la scierie en ligne](https://youtu.be/KT9ZVO88zQc), un récit illustré en 2D avec un personnage, des objets animés et une démonstration du site. Les dessins EYWA sont originaux et utilisent la palette vert, crème et sauge de la marque.

Le parcours de réservation en ligne suivi d’une confirmation automatique est celui demandé pour cette version. La scène de confirmation est une illustration du message souhaité, pas la capture d’un e-mail réellement envoyé.

## Point à valider avant diffusion

Le dossier contient les pages de devis et de réservation et une redirection vers une fonction de paiement Netlify externe. Il ne contient pas le traitement serveur du paiement ni l’envoi de la confirmation. Le formulaire de devis appelle Zoho et FormSubmit ; il redirige vers le devis même lorsque l’appel d’e-mail échoue. La réception d’un e-mail et le blocage de la date ne sont donc pas vérifiés par cette démonstration.

Avant de publier le film, valider en environnement de test : disponibilité de la date, prix côté serveur, réception du paiement, transmission des informations pratiques, confirmation client unique, puis reprise en cas de paiement annulé ou échoué. Les champs pratiques présents dans `reservation.html` ne sont pas transmis par sa redirection actuelle, qui ne comporte que le montant, le libellé et l’URL d’annulation.

## Sources

- `narration.json` : texte et scènes modifiables.
- `screens/` : écrans locaux du site, sans coordonnées client.
- `build_video.py` : illustrations et animation à 24 images/seconde, export 1280 × 720 avec anticrénelage. Dépend de Pillow, FFmpeg et de `say` (macOS) pour régénérer la voix. L’option `--preview` produit les vues de contrôle dans `/private/tmp/eywa-animation-preview`.
- `../assets/video/eywa-parcours.mp4` : vidéo intégrée à l’accueil, sans lecture automatique.
- `../assets/video/eywa-parcours.fr.vtt` : sous-titres français.

L’audio est une voix de synthèse générique, pas la voix de Louis. Aucun SMS, e-mail ou rappel automatique n’a été envoyé ou activé pendant cette création.

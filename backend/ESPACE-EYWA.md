# Espace privé EYWA, 20 novembre 2026

Accès : https://eywa-booking.eywa-booking-cloudflare.workers.dev/espace/
Raccourci du site : https://eywacoffeecatering.com/espace.html

Connexion par code à usage unique (10 minutes), envoyé uniquement à contact.eywa08@gmail.com. Session de huit heures, cookie Secure/HttpOnly/SameSite Strict, protection CSRF, limitation des demandes et des tentatives. Aucun jeton d’administration dans le navigateur ou dans Git.

## Fonctionnement

- Tableau de bord, calendrier, dossiers clients, tâches, baristas, matériel, fournisseurs et réglages.
- « Devis à suivre » est cliquable. Les devis ouverts sont aussi nommés directement sur le tableau de bord. Dans chaque dossier : référence, coordonnées, entreprise, événement, choix, demande d’origine, lien du devis, PDF, factures et échanges. Les données proviennent du devis enregistré, sans recalcul du document d’origine.
- Suivi commercial interne : à contacter, contact pris, en attente ou sans suite, notes et prochain contact. Sans suite arrête les relances ; cela ne permet pas d’annuler une réservation payée. Les versions empêchent d’écraser une modification concurrente.
- Relances J+1/J+3/J+5 : échéance et état d’envoi visibles. Le contenu validé des relances n’est pas modifié par cet ajout.
- Mail personnalisé : texte et objet enregistrés en brouillon, aperçu privé beige EYWA, signature et lien vers le devis. Un clic explicite « Envoyer au client » avec confirmation est requis. Le destinataire est imposé côté serveur à l’adresse du devis. Une boîte d’envoi idempotente assure les reprises sans créer plusieurs messages pour le même brouillon. Les échanges remontent dans l’historique et la synchronisation Notion existante.
- La dictée des consignes se fait dans notre conversation ; il n’y a pas de moteur IA payant ou de transformation automatique des notes dans le CRM. Après rédaction, le texte est collé dans le brouillon. Enregistrer un brouillon ou ouvrir l’aperçu n’envoie rien.
- Les réservations réglées existantes sont reprises dans des fiches de préparation séparées. Les devis, paiements et factures ne sont pas modifiés.
- Les essais restent conservés mais masqués par défaut. Les tâches terminées restent visibles dans la vue Toutes les tâches.
- Tâches de préparation idempotentes : appel J−7, préparation J−1 ; commandes et fichiers selon les options choisies.
- Les horaires incluent chargement, installation, service, rangement, aller et retour. Le trajet routier connu est repris ; sinon 30 minutes par défaut, à vérifier. Pas de promesse de trafic temps réel.
- La disponibilité publique reste conservatrice, à la journée. Les nouvelles réservations bloquent aussi les journées supplémentaires couvertes par leur préparation et leur retour. Les indisponibilités et événements externes bloquent le même calendrier via des contrôles transactionnels SQLite.
- Affectations de personnel et matériel avec contrôle de quantité et de chevauchement. Les ressources affectées à des événements futurs ne peuvent pas être désactivées.
- Demande d’avis Google un jour après les nouveaux événements, désactivable globalement ou par événement. Les anciens événements et essais sont exclus ; aucun rattrapage au-delà de 30 jours. Lien repris de la fiche Google déjà présente sur le site.
- Le cron existant continue toutes les cinq minutes. Les demandes d’avis utilisent la boîte d’envoi et les protections anti-doublons existantes.
- Une alerte quotidienne maximum à la boîte EYWA si des mails ou des dossiers Notion échouent à plusieurs reprises. Une panne de Gmail ne permet évidemment pas d’envoyer immédiatement une alerte par Gmail ; l’erreur reste visible dans l’espace.
- Export JSON des données chargées. Les messages et PDF restent accessibles dans les dossiers ; cet export n’est pas une sauvegarde exhaustive de la base.
- Commandes : quantités confirmées, souhaits exacts, format, fichier et validation du visuel, fournisseur, échéance, référence et suivi. Les gobelets standards, imprimés, stickers, habillage et mousse ont des fiches adaptées aux options. Les fournisseurs retrouvés dans la page Notion « Eywa fournisseur » sont importés comme pistes, pas comme partenaires validés. Les suggestions n’utilisent que les règles activées et renseignées par Louis (produit, quantités, délai, priorité). Aucun achat automatique et aucune modification des prix.
- Accès rapide : favoris sur ordinateur, instructions d’ajout à l’écran d’accueil, manifeste et icônes. Aucune copie hors ligne des données clients.

## Références de fonctionnement

Les fonctions utiles ont été rapprochées de la documentation publique Flashquotes : https://docs.flashquotes.com/events/event-brief. L’espace EYWA conserve sa propre présentation. Aucun compte Flashquotes, inscription à une démo ou test de leur interface privée n’a été effectué. La fiche fournisseur provient de la page Notion 40150db31fe080049beecbe56d5b0683. Le minimum de 250 unités PixePrint provient de sa fiche produit ; les délais annoncés sont des notes à reconfirmer et non des règles activées automatiquement.

## Publication

1. `node tools/build-crm.mjs` puis `npm test` dans backend.
2. Appliquer seulement les nouvelles migrations nécessaires avec `wrangler d1 execute ... --remote --file ...` : 0007 pour l’espace initial, puis 0008 fournisseurs et 0009 suivi des devis. Vérifier celles déjà appliquées. Les migrations antérieures ont déjà été appliquées manuellement en production ; ne pas relancer aveuglément toutes les migrations.
3. `wrangler deploy --config wrangler.jsonc --keep-vars`, en préservant les secrets existants.
4. Pousser le commit validé vers GitHub Pages.

Aucun service payant supplémentaire, aucune API de SMS ou de signature n’est activé. Surveiller les quotas Cloudflare et Google.

## Vérification locale

`node tools/preview-crm.mjs` lance un aperçu isolé sur 127.0.0.1:8157. Données fictives uniquement, base en mémoire, aucune connexion à Stripe, Gmail ou Notion. Le chemin `/preview-login` n’existe que dans cet outil local et n’est pas déployé.

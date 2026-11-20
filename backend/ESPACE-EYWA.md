# Espace privé EYWA, 20 novembre 2026

Accès : https://eywa-booking.eywa-booking-cloudflare.workers.dev/espace/
Raccourci du site : https://eywacoffeecatering.com/espace.html

Connexion par code à usage unique (10 minutes), envoyé uniquement à contact.eywa08@gmail.com. Session de huit heures, cookie Secure/HttpOnly/SameSite Strict, protection CSRF, limitation des demandes et des tentatives. Aucun jeton d’administration dans le navigateur ou dans Git.

## Fonctionnement

- Tableau de bord, calendrier, dossiers clients, tâches, baristas, matériel et réglages.
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

## Publication

1. `node tools/build-crm.mjs` puis `npm test` dans backend.
2. Appliquer uniquement `migrations/0007_crm.sql` avec `wrangler d1 execute ... --remote --file ...`. Les migrations antérieures ont déjà été appliquées manuellement en production ; ne pas relancer aveuglément toutes les migrations.
3. `wrangler deploy --config wrangler.jsonc`, en préservant les secrets existants.
4. Pousser le commit validé vers GitHub Pages.

Aucun service payant supplémentaire, aucune API de SMS ou de signature n’est activé. Surveiller les quotas Cloudflare et Google.

## Vérification locale

`node tools/preview-crm.mjs` lance un aperçu isolé sur 127.0.0.1:8157. Données fictives uniquement, base en mémoire, aucune connexion à Stripe, Gmail ou Notion. Le chemin `/preview-login` n’existe que dans cet outil local et n’est pas déployé.

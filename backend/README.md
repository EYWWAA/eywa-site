# Serveur de réservation EYWA

Source du Worker Cloudflare `eywa-booking`. Les tarifs du serveur font autorité avant paiement. Ne jamais publier une grille différente uniquement dans le frontend.

Tests : Node.js 24 ou ultérieur, puis `npm test`. Les tests de paiement, de mails et de Notion utilisent des doubles locaux ; aucun paiement réel n’est réalisé.

Tarifs : base 300 €, invité supplémentaire 2,31 €, heure supplémentaire 69,23 €, barista supplémentaire 150 €. Personnalisations journalières : habillage 200 €, gobelets 200 €, logo mousse 150 €. Urgence gobelets : 50 € une seule fois. Déplacement : offert sous 20 km à l’aller, puis 0,35 €/km sur l’aller-retour complet, sans part horaire. NATHALIE08 : prestation et déplacement à 1 €, options au tarif normal.

Les migrations 0003/0004 ajoutent les devis, l’outbox des messages, les relances, les factures d’acompte, la synchronisation Notion et les verrous des tâches. Elles ne modifient aucune réservation existante. Vérifier le schéma avant de répéter un ALTER TABLE.

Le déclencheur planifié s’exécute toutes les cinq minutes. `EYWA_AUTOMATION_ENABLED` doit être explicitement `true` ; sinon aucun nouvel envoi ni archivage automatique n’est effectué. La lecture Gmail demande aussi `EYWA_GMAIL_ARCHIVE_ENABLED=true`.

Secrets à configurer uniquement dans Cloudflare : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EYWA_SPECIAL_PRICE_CODE`, `EYWA_MAIL_RELAY_URL`, `EYWA_MAIL_RELAY_SECRET`, `EYWA_NOTION_TOKEN`. Ne jamais les mettre dans ce dépôt ou dans le frontend. `EYWA_MAIL_TEST_RECIPIENTS` peut limiter l’envoi aux seules adresses de validation avant l’ouverture.

Le relais Google se trouve dans `google/` ; il est exécuté avec le compte EYWA et refuse les appels sans secret. Sa publication publique, les portées Gmail et l’intégration Notion doivent être explicitement autorisées. La connexion Notion ne doit accéder qu’aux bases Contacts et Dossiers EYWA.

Les relances J1/J3/J7/J15/J25 partent pour tout devis, sans case à cocher : elles prolongent une demande que la personne vient de faire. Chaque message porte en pied de page, en petits caractères, un lien pour les arrêter. Elles cessent après paiement, désinscription, date de l’événement ou arrêt manuel du suivi dans Notion.

Les factures créées au paiement avant prestation sont des factures d’acompte, dans une série EYWA-WEB distincte ; la facture finale de prestation réalisée reste à établir ensuite. Les anciens paiements ne sont pas repris silencieusement.

Avant toute publication, lire et sauvegarder le code actif et les paramètres distants ; préserver liaisons et secrets. Publier le serveur compatible, vérifier tarifs/calendrier, puis activer progressivement les fournisseurs et seulement ensuite le nouveau formulaire. Ne jamais créer de réservation ou paiement réel pour un test automatisé.

Options du 13 novembre : les gobelets avec stickers (100 €/jour) et le logo sur les boissons (150 €/jour) sont réservés aux mariages et événements privés. Les gobelets imprimés restent à 200 €/jour. Les deux types de gobelets sont exclusifs. Le client ne voit que le montant global et les prestations choisies ; les lignes de calcul restent internes.

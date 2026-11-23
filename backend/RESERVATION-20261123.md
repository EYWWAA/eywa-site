# Réservation du 23 novembre 2026

Louis a validé le parcours mobile puis précisé : acompte de 50 %, solde au plus tard le jour de l'événement avant le début du service. La proposition J-7 a été abandonnée. Les anciennes réservations gardent leurs conditions : le nouveau planning est enregistré sous paymentSchedule=event_day_20261123 et cgvVersion=2026-11-23.

La facture de solde des nouvelles réservations est mise en attente d'envoi à J-7, ou dès que possible si l'acompte est reçu dans les sept derniers jours. L'échéance reste le premier jour du service. Les anciennes factures et réservations ne sont pas réécrites. Le contrôle Stripe demeure côté serveur ; les prix et le code NATHALIE08 sont inchangés.

Le virement est direct sur le compte EYWA, dont les coordonnées sont dans EYWA_BANK_DETAILS (secret Cloudflare). Aucun RIB PDF ni IBAN réel n'est dans le dépôt ou les ressources publiques. Seuls les documents privés liés à une demande ou facture les présentent.

Le client peut demander les instructions de virement pour son acompte. La date est retenue provisoirement 48 heures. Une proforma indique le montant et la référence ; elle ne prétend jamais que le paiement est reçu. Dans l'accueil du CRM, Louis vérifie son compte bancaire, puis clique « Virement reçu ». Ce clic marque le paiement, confirme la réservation et met en file d'envoi la facture et les confirmations. La boîte d'envoi conserve ses protections d'idempotence. Un virement attendu ne crée pas de facture acquittée et ne confirme pas de réservation. Une demande expirée libère ses créneaux ; il faut vérifier de nouveau la disponibilité avant de traiter un virement tardif.

Pour le solde, la facture affiche les coordonnées et sa référence. Le lien propose aussi la carte. Louis peut marquer le solde reçu par virement dans Rapports, uniquement après réception effective. Cela ne déclenche pas de transfert d'argent et ne donne aucun accès au compte bancaire.

Aucun débit automatique du solde, aucune carte enregistrée pour prélèvement ultérieur et aucun mandat SEPA ne sont activés. Une demande de renseignement sur ces fonctions n'est pas une autorisation de prélever les clients.

La présentation mobile retire l'ancien habillage m-cartes uniquement sur reservation.html. Total, navigation et liens légaux restent dans un pied de page réservé ; les questions longues annoncent leur défilement. Les CGV restent décochées. La facturation a sa propre question.

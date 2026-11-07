# Modération et préparation commerciale

## Accès à la modération

Définir `VELOCE_MODERATOR_IDS` dans l’environnement du serveur avec les identifiants MongoDB des comptes autorisés, séparés par des virgules. Seuls ces comptes voient la file des signalements dans **Paramètres → Modération** et peuvent conserver ou retirer un contenu signalé. Ne pas utiliser les noms d’utilisateur comme autorisation.

Les signalements publics de publications et du Carrefour sont enregistrés dans `ContentReport`. Les signalements de comptes faits depuis leur profil sont aussi visibles dans la même file ; l’équipe peut les examiner puis les clôturer. Les sanctions de comptes ne sont pas automatisées depuis cette file.

## Suppression de compte

Le membre peut lancer la suppression depuis **Paramètres** après deux confirmations. Veloce supprime le profil, le solde local, les publications et médias personnels, les conversations, notifications, statuts, données Carrefour, pièces jointes, relations, préférences IA et abonnements Push. Les transferts de direction de clan sont appliqués ; si le dernier clan possède encore une trésorerie, le membre doit d’abord la distribuer ou transférer la direction.

Les écritures Piz sont conservées sans lien direct avec le compte pour préserver l’historique comptable. Un compte Piz externe associé n’est pas fermé par cette action. La page publique `/delete-account.html` explique comment accéder à la demande de suppression.

## Informations à renseigner avant la commercialisation

Les pages `/terms.html`, `/privacy.html` et `/community-rules.html` sont des brouillons techniques, pas un avis juridique. Avant de les présenter comme définitives, remplacer leurs mentions de travail par : identité juridique et adresse de l’exploitant, contact de confidentialité/support, liste des sous-traitants, durées de conservation, procédure d’exercice des droits et réclamation, modalités applicables aux paiements Piz, et conditions territoriales de lancement. Faire relire ces textes par un professionnel compétent dans les territoires visés.

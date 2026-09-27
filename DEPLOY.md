# Déployer Veloce pour les tests

Veloce peut être déployé comme un seul service Node sur Render : Express sert l’API et le build React. La base et les pièces jointes restent dans MongoDB Atlas, pas sur le disque temporaire de Render.

## 1. Préparer MongoDB Atlas

1. Créer un compte Atlas et un cluster **Free**.
2. Créer un utilisateur de base de données avec un mot de passe fort.
3. Dans **Network Access**, autoriser les connexions du service Render. Pour un prototype Render gratuit dont l’adresse IP sortante n’est pas fixe, `0.0.0.0/0` est nécessaire ; conserver un mot de passe unique et ne jamais partager l’URI.
4. Copier l’URI de connexion, remplacer le mot de passe et inclure le nom de base `veloce`.

## 2. Déployer sur Render

1. Envoyer ce dossier dans un dépôt Git privé sur GitHub ou GitLab. Vérifier que les fichiers `.env` et les dossiers `node_modules` ne sont pas ajoutés. Le fichier `.gitignore` les exclut.
2. Dans Render, choisir **New → Blueprint**, connecter le dépôt et sélectionner `render.yaml`.
3. Lors de la création, fournir `MONGO_URI`. Render génère `JWT_SECRET` automatiquement.
4. Une fois le déploiement terminé, ouvrir l’adresse `onrender.com` indiquée par Render. `/health` doit répondre avec `{"status":"ok","service":"veloce-api"}`.

## 3. Configurer la vérification des publications

Dans **Environment** du service Render, définir `TAVILY_API_KEY` et `GEMINI_API_KEY`. La vérification utilise [Tavily](https://app.tavily.com/home) pour chercher des sources et [Google AI Studio](https://aistudio.google.com/app/apikey) pour créer une clé Gemini et analyser les résultats. Ces deux clés ne doivent pas être mises dans le code ni dans un fichier versionné. Après les avoir ajoutées ou modifiées, enregistrer les variables et redéployer le service.

## 4. Activer l’assistant IA (facultatif)

Dans **Environment** du service Render, ajouter `PERPLEXITY_API_KEY` avec la clé secrète Perplexity. Ne pas la mettre dans le code, dans `frontend`, ni dans un fichier versionné. `PERPLEXITY_MODEL` peut rester sur la valeur par défaut du backend.

## À savoir pour les essais gratuits

Le service web gratuit Render s’endort après 15 minutes sans trafic et peut mettre environ une minute à répondre au premier accès suivant. Son disque est éphémère : les images et fichiers Veloce sont donc stockés dans MongoDB GridFS. Le cluster Atlas gratuit est limité en capacité ; cette configuration convient à une démo, pas à une production ou à des données importantes sans sauvegarde.

# Guildou Awards

## Problème actuel
Le site utilise uniquement `localStorage` pour enregistrer les questions et les réponses. Cela fonctionne bien en local dans Live Server, mais sur un vrai site en ligne les réponses sont stockées uniquement dans le navigateur de chaque utilisateur.

## Solution proposée
J'ai ajouté un backend Vercel via deux fonctions serverless :
- `api/questions.js` pour lire/écrire les questions
- `api/responses.js` pour enregistrer les réponses et générer des résultats agrégés

Le front-end garde un comportement de secours local (`localStorage`) quand le backend distant n'est pas disponible.

## Déploiement sur Vercel avec Supabase
### 1. Créer un projet Supabase gratuit
1. Aller sur https://supabase.com
2. Créer un nouveau projet gratuit
3. Copiez l'URL du projet et la `SERVICE_ROLE_KEY`

### 2. Créer les tables SQL
Dans Supabase SQL Editor, exécutez :

```sql
create table if not exists questions (
  id text primary key,
  title text not null,
  type text,
  choices jsonb,
  media jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists responses (
  id text primary key,
  respondent text,
  answers jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### 3. Configurer les variables d'environnement Vercel
Dans le dashboard Vercel, ajoutez :
- `SUPABASE_URL` → votre URL Supabase (ex: `https://xyz.supabase.co`)
- `SUPABASE_SERVICE_KEY` → votre clé de service role Supabase
- `ADMIN_SECRET` → un mot de passe secret pour l'API admin (par exemple `guildou`)

### 4. Déployer le site
1. Pusher votre repo sur GitHub
2. Connecter votre repo dans Vercel
3. Déployer

## Utilisation
- Les questions sont maintenant synchronisées avec Supabase quand le backend est disponible.
- Les réponses envoyées par votre pote sont stockées à distance et visibles depuis l'administration.
- Si le backend n'est pas accessible, l'application continue de fonctionner en local avec `localStorage`.

## Remarque
Pour que l'administration puisse modifier les questions en ligne, le mot de passe local doit correspondre à `ADMIN_SECRET` configuré dans Vercel.

# Maintenance du parc informatique

Application mobile Expo/React Native de suivi hors ligne du parc matériel,
des techniciens et des interventions planifiées.

## Lancer l'application

```bash
npm install
npx expo start
```

Le projet utilise Expo SDK 58. L'interface est conçue pour Android et iOS;
SQLite conserve les données localement entre les démarrages.

## Fonctions

- CRUD des équipements, des techniciens et des maintenances planifiées.
- Journal CRUD des interventions effectuées.
- Import de contacts du téléphone pour créer un technicien.
- Rappels locaux programmés 24 h avant une maintenance (ou à son échéance
  si elle est prévue dans moins de 24 h).
- Diagnostic de la connexion, position GPS et carte native avec les
  coordonnées d'équipements renseignées.
- Photos avant/après et mémos vocaux conservés dans le stockage privé de
  l'application.

Les données de démonstration sont créées au premier démarrage lorsque la base
est vide. Les coordonnées GPS d'exemple sont à remplacer par celles du site
réel.

## Carte Android

`expo-maps` affiche Google Maps sur Android. Créez une clé Google Maps SDK
for Android, restreignez-la au package `com.exposereseau.maintenance`, puis
fournissez-la à la configuration Expo :

```powershell
$env:GOOGLE_MAPS_API_KEY = "votre-cle"
npx expo start
```

La clé est injectée uniquement par `app.config.ts` et ne doit pas être
commise dans le dépôt. La carte nécessite une application native (un build
EAS); iOS utilise Apple Maps.

## APK Android avec EAS

Associez le projet à un compte Expo et initialisez EAS :

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Définissez `EAS_PROJECT_ID` et `GOOGLE_MAPS_API_KEY` dans l'environnement de
build EAS, puis générez l'APK :

```bash
npx eas-cli@latest build -p android --profile preview
```

Le profil `preview` produit un APK installable. Les modules caméra, carte,
audio, contacts et notifications nécessitent un build natif et ne sont pas
tous disponibles dans Expo Go.

## Publier le code sur GitHub

Git et GitHub CLI doivent être installés. Configurez votre identité Git locale
(utilisez de préférence l'adresse `noreply` fournie par GitHub), puis :

```bash
git add .
git commit -m "Créer l'application de maintenance du parc"
gh auth login
gh repo create Expose_Reseau_2023020140_2023021090 --public --source=. --remote=origin --push
```

Le dossier local est déjà initialisé comme dépôt Git. Le fichier `.gitignore`
exclut les fichiers d'environnement et l'état local Expo.

## Vérification

```bash
npx expo lint
npx tsc --noEmit
```

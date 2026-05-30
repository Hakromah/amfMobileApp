# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.



### TO BUILD THE MOBILE .APK and deploy to hetzner server
- npx eas-cli login
- npx eas-cli build --platform android --profile preview

### copy the build link to open the browser and download the APK in your expo account
- rename the .apk file to whatever you want (my-school.apk)
- upload it to hetzner server by adding it to the frontend app public folder.
- execute git command to commit and push the changes to the git repository.
- login to hetzner server and
- cd /var/www/AMFOFANA/frontend
- git pull origin main
- npm install
- npm run build
- pm2 restart amfofana-frontend
- And now this link [https://hassanskdev.online/my-school.apk] and send it to the user to install.it will open and show a message on the top right corner "This developer has not published an app yet, and may be testing it." click on 'Continue anyway' to proceed.








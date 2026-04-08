# AdFlow Zone

This is a NextJS application built with Firebase Studio AI.

## Overview

This project is an AdFlow Zone app, a platform for managing ad account maintenance tasks. It's built using Next.js, React, ShadCN, Tailwind CSS, and Firebase.

## Development

This application is being developed collaboratively by viber coder and the Firebase Studio AI platform.

## Firebase Project

The project is connected to a Firebase project to handle authentication and database services (Firestore). All necessary configurations are managed by Firebase Studio.

To get started with the app, run `npm run dev` and open the provided URL.

## Security

This application uses Firebase Authentication to secure user data. The dashboard routes are protected, meaning only authenticated users can access them. Any attempt to access a protected route without being logged in will result in a redirection to the login page. Firestore Security Rules are in place to ensure that users can only read and write their own data, preventing unauthorized access to other users' information.

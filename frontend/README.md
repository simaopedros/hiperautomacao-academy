# Hiperautomação Academy Frontend

This project contains the frontend application for the Hiperautomação Academy platform, built with React and modern web technologies.

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Component Library](#component-library)
- [Routing](#routing)
- [Learn More](#learn-more)

## Overview

The frontend application provides a responsive, user-friendly interface for students and administrators to interact with the Hiperautomação Academy platform. It includes features for course browsing, enrollment, learning, social interaction, and administrative management.

## Technology Stack

- **Framework**: [React](https://reactjs.org/) with [React Router](https://reactrouter.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom components
- **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives
- **State Management**: React hooks
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Build Tool**: [Craco](https://github.com/gsoft-inc/craco) (Create React App Configuration Override)
- **Icons**: [Lucide React](https://lucide.dev/)

## Key Features

### Student Features
- Course browsing and enrollment
- Lesson viewing with progress tracking
- Social feed and community discussions
- Support access

### Admin Features
- Dashboard with analytics
- Course, module, and lesson management
- User management and enrollment control
- Payment transaction monitoring
- Email and payment gateway configuration
- Support settings management

### UI/UX Features
- Responsive design for all device sizes
- Dark theme interface
- Animated transitions and loading states
- Accessible components
- Toast notifications

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # Radix UI based components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── pages/              # Page components
│   ├── AdminDashboard.js
│   ├── StudentDashboard.js
│   ├── CourseView.js
│   ├── LessonPlayer.js
│   └── ...             # Other page components
├── App.js              # Main application component
├── App.css             # Global styles
├── index.js            # Entry point
└── index.css           # Base styles
```

## Environment Variables

Create a `.env` file in the frontend root directory with the following variables:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_DEFAULT_SUPPORT_URL=https://wa.me/5511999999999
```

## Component Library

The project uses a custom component library based on Radix UI primitives with Tailwind CSS styling. Components include:
- Buttons
- Cards
- Dialogs
- Forms
- Navigation
- Data display

## Routing

The application uses React Router for client-side routing with protected routes for authenticated users. Routes are defined in `App.js` with role-based access control.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

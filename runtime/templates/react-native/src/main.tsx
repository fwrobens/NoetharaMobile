// Web preview entry only. In Expo, App.tsx is the entry and this file is unused.
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', { rootTag: document.getElementById('root') });

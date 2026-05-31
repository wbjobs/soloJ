import React from 'react';
import { AppRegistry } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from './App';
import HomeScreen from './screens/HomeScreen';
import DataCollectionScreen from './screens/DataCollectionScreen';
import ResultsScreen from './screens/ResultsScreen';
import ExplainabilityScreen from './screens/ExplainabilityScreen';
import HistoryScreen from './screens/HistoryScreen';
import { AppStateProvider } from './context/AppStateContext';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
      <Stack.Screen name="DataCollection" component={DataCollectionScreen} options={{ title: '数据采集' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: '分析结果' }} />
      <Stack.Screen name="Explainability" component={ExplainabilityScreen} options={{ title: '结果解释' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
    </Stack.Navigator>
  );
}

function RootApp() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('App', () => RootApp);
AppRegistry.runApplication('App', {
  initialProps: {},
  rootTag: document.getElementById('root'),
});

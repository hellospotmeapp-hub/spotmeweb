import { Alert, AlertButton, Platform } from 'react-native';

// Alert.alert is a no-op on react-native-web, so web falls back to the browser's
// alert/confirm. With a cancel + action pair, confirm() runs the action on OK.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons || []).filter((b) => b.style !== 'cancel');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    actions[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) actions[0]?.onPress?.();
  else buttons.find((b) => b.style === 'cancel')?.onPress?.();
}

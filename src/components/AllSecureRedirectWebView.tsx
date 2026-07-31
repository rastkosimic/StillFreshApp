import { WebView } from 'react-native-webview';

export const ALLSECURE_RETURN_PATH = '/payment/allsecure/return';

export type AllSecureReturnStatus = 'success' | 'cancel' | 'error' | 'unknown';

export function parseAllSecureReturnStatus(url: string): AllSecureReturnStatus {
  const match = url.match(/[?&]status=(success|cancel|error)(?:&|$)/);
  if (match?.[1] === 'success' || match?.[1] === 'cancel' || match?.[1] === 'error') {
    return match[1];
  }
  return 'unknown';
}

interface AllSecureRedirectWebViewProps {
  redirectUrl: string;
  onReturn?: (status: AllSecureReturnStatus) => void;
}

export function AllSecureRedirectWebView({
  redirectUrl,
  onReturn,
}: AllSecureRedirectWebViewProps) {
  const handleReturnUrl = (url: string): boolean => {
    if (!url.includes(ALLSECURE_RETURN_PATH)) {
      return true;
    }

    onReturn?.(parseAllSecureReturnStatus(url));
    return false;
  };

  return (
    <WebView
      source={{ uri: redirectUrl }}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      originWhitelist={['https://*', 'http://*']}
      onShouldStartLoadWithRequest={(req) => handleReturnUrl(req.url)}
      onNavigationStateChange={(nav) => {
        if (nav.url.includes(ALLSECURE_RETURN_PATH)) {
          handleReturnUrl(nav.url);
        }
      }}
      style={{ flex: 1 }}
    />
  );
}

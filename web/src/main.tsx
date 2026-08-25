import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import App from './App';
import type { RuntimeConfig } from './types';
import './styles.css';

const LOCAL_PREVIEW_CONFIG: RuntimeConfig = {
  apiEndpoint: 'http://localhost:3000/analyze',
  region: 'us-east-2',
  signingService: 'lambda',
  userPoolId: 'local',
  userPoolClientId: 'local',
  identityPoolId: 'local',
};

function Root() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLocalPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has('preview');

  useEffect(() => {
    if (isLocalPreview) return;

    fetch('/runtime-config.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Runtime configuration is unavailable.');
        return response.json() as Promise<RuntimeConfig>;
      })
      .then((loaded) => {
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: loaded.userPoolId,
              userPoolClientId: loaded.userPoolClientId,
              identityPoolId: loaded.identityPoolId,
              allowGuestAccess: false,
            },
          },
        });
        setConfig(loaded);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load the app.',
        );
      });
  }, [isLocalPreview]);

  if (isLocalPreview) {
    return (
      <App
        config={LOCAL_PREVIEW_CONFIG}
        username="Detective Dan"
        signOut={() => undefined}
      />
    );
  }

  if (loadError) {
    return <div className="startup-error">{loadError}</div>;
  }
  if (!config) {
    return <div className="startup-loading">Loading review workspace...</div>;
  }

  return (
    <div className="auth-shell">
      <Authenticator hideSignUp>
        {({ signOut, user }) => (
          <App
            config={config}
            username={user?.signInDetails?.loginId ?? user?.username ?? 'Analyst'}
            signOut={() => signOut?.()}
          />
        )}
      </Authenticator>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

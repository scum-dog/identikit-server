import { Router, Request, Response } from "express";
import { authenticateUser } from "../../auth/middleware";
import { query } from "../../database";
import { CharacterInfo } from "../../types";
import { log } from "../../utils/logger";
import { SessionManager } from "../../auth/sessions";

import newgroundsRoutes from "./newgrounds";
import itchRoutes from "./itch";
import googleRoutes from "./google";

const router = Router();

router.use("/newgrounds", newgroundsRoutes);
router.use("/itchio", itchRoutes);
router.use("/google", googleRoutes);

// GET /auth/callback - unified OAuth callback handler
router.get("/callback", (req: Request, res: Response) => {
  const provider = req.query.provider as string;

  if (!provider) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Error</h1>
          <p>Provider parameter is required</p>
        </body>
      </html>
    `);
  }

  if (!["google", "itch"].includes(provider)) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Error</h1>
          <p>Invalid provider: ${provider}</p>
        </body>
      </html>
    `);
  }

  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'none'; frame-ancestors 'none';",
  );

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth Authentication</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }

        .container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
        }

        .loading {
            color: #666;
        }

        .success {
            color: #28a745;
        }

        .error {
            color: #dc3545;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #666;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div id="status" class="loading">Processing authentication...</div>
        <p id="message"></p>
    </div>

    <script>
    (function() {
        'use strict';

        const statusElement = document.getElementById('status');
        const messageElement = document.getElementById('message');

        function updateStatus(text, className = 'loading') {
            statusElement.textContent = text;
            statusElement.className = className;
        }

        function updateMessage(text) {
            messageElement.textContent = text;
        }

        function hideSpinner() {
            const spinner = document.querySelector('.spinner');
            if (spinner) {
                spinner.style.display = 'none';
            }
        }

        function getUrlParams() {
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1));

            const params = {};
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
            for (const [key, value] of hashParams) {
                params[key] = value;
            }

            return params;
        }

        function validateState(receivedState) {
            try {
                const expectedState = sessionStorage.getItem('oauth_state');
                if (!expectedState) {
                    console.error('No stored state found in sessionStorage');
                    return false;
                }

                if (receivedState !== expectedState) {
                    console.error('State mismatch:', { received: receivedState, expected: expectedState });
                    return false;
                }

                sessionStorage.removeItem('oauth_state');
                return true;
            } catch (error) {
                console.error('Error validating state:', error);
                return false;
            }
        }

        function sendMessageAndClose(data) {
            try {
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(data, '*');
                } else if (window.parent && window.parent !== window) {
                    window.parent.postMessage(data, '*');
                }

                setTimeout(() => {
                    try {
                        window.close();
                    } catch (e) {
                        console.log('Could not auto-close window, user must close manually');
                    }
                }, 1500);
            } catch (error) {
                console.error('Error sending message to parent:', error);
                updateMessage('Please close this window manually');
            }
        }

        function handleSuccess(authData) {
            hideSpinner();
            updateStatus('Authentication successful!', 'success');
            updateMessage('You may close this window or it will close automatically.');

            const message = {
                success: true,
                data: authData,
                timestamp: Date.now()
            };

            sendMessageAndClose(message);
        }

        function handleError(error, description = '') {
            hideSpinner();
            updateStatus('Authentication failed', 'error');
            updateMessage(description || 'Please close this window and try again.');

            const message = {
                success: false,
                error: error,
                message: description,
                timestamp: Date.now()
            };

            sendMessageAndClose(message);
        }

        async function exchangeCodeForToken(provider, code, state) {
            try {
                const endpointMap = {
                    'google': '/auth/google/callback',
                    'itch': '/auth/itchio/callback'
                };

                const endpoint = endpointMap[provider];
                if (!endpoint) {
                    throw new Error('Unknown provider: ' + provider);
                }

                let response;

                if (provider === 'google') {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            code: code,
                            state: state
                        })
                    });
                } else if (provider === 'itch') {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            access_token: code,
                            state: state
                        })
                    });
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'HTTP ' + response.status + ': ' + response.statusText);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Token exchange error:', error);
                throw error;
            }
        }

        async function processCallback() {
            try {
                const params = getUrlParams();
                console.log('Callback params:', params);

                const provider = params.provider || new URLSearchParams(window.location.search).get('provider');
                if (!provider) {
                    throw new Error('No provider specified');
                }

                if (params.error) {
                    const errorDescription = params.error_description || params.error;
                    throw new Error('OAuth Error: ' + errorDescription);
                }

                const code = params.code || params.access_token;
                if (!code) {
                    throw new Error('No authorization code or access token received');
                }

                const state = params.state;
                if (!state) {
                    throw new Error('No state parameter received');
                }

                if (!validateState(state)) {
                    throw new Error('Invalid state parameter - possible CSRF attack');
                }

                updateStatus('Exchanging code for token...', 'loading');

                const authData = await exchangeCodeForToken(provider, code, state);

                if (!authData || !authData.sessionId) {
                    throw new Error('Invalid response from authentication server');
                }

                handleSuccess(authData);

            } catch (error) {
                console.error('Callback processing error:', error);
                handleError(error.name || 'authentication_failed', error.message);
            }
        }

        function handleDirectNavigation() {
            hideSpinner();
            updateStatus('Authentication completed', 'loading');
            updateMessage('This window can be closed.');

            setTimeout(() => {
                try {
                    window.close();
                } catch (e) {
                    updateMessage('Please close this window manually.');
                }
            }, 2000);
        }

        document.addEventListener('DOMContentLoaded', function() {
            const params = getUrlParams();

            if (params.code || params.error || params.access_token) {
                processCallback();
            } else {
                handleDirectNavigation();
            }
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', arguments.callee);
        } else {
            const params = getUrlParams();
            if (params.code || params.error || params.access_token) {
                processCallback();
            } else {
                handleDirectNavigation();
            }
        }

    })();
    </script>
</body>
</html>
  `;

  res.send(html);
});

// GET /auth/session - verify current session
router.get("/session", authenticateUser, (req: Request, res: Response) => {
  res.json({
    valid: true,
    user: {
      id: req.user!.id,
      username: req.user!.username,
      platform: req.user!.platform,
      isAdmin: req.user!.isAdmin,
    },
  });
});

// GET /auth/me - get current user info
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await query<CharacterInfo>(
      "SELECT id, created_at, last_edited_at, is_edited FROM characters WHERE user_id = $1 AND is_deleted = false",
      [req.user!.id],
    );

    res.json({
      user: {
        id: req.user!.id,
        username: req.user!.username,
        platform: req.user!.platform,
        isAdmin: req.user!.isAdmin,
      },
      character: character.rows[0] || null,
      hasCharacter: character.rows.length > 0,
    });
  } catch (error) {
    log.error("Get user info error", { error });
    res.status(500).json({ error: "Failed to get user information" });
  }
});

// DELETE /auth/session - logout with serverside cleanup
router.delete(
  "/session",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const sessionId = authHeader.substring(7);
        await SessionManager.deleteSession(sessionId);
      }

      res.json({
        success: true,
        message: "Logout successful. Session cleared from server.",
      });
    } catch (error) {
      log.error("Logout error", { error });
      res.status(500).json({ error: "Logout failed" });
    }
  },
);

export default router;

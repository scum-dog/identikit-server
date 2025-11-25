import { Router, Request, Response } from "express";
import { itchAuth } from "../../auth/itch";
import { userQueries } from "../../database";
import { log } from "../../utils/logger";
import {
  getConstraintError,
  ERROR_CODES,
  errorResponse,
} from "../../utils/errorHandler";

const router = Router();

// GET /auth/itchio/authorization-url - get itch.io OAuth authorization URL
router.get("/authorization-url", async (req: Request, res: Response) => {
  try {
    const pollId = req.query.poll_id as string;
    const { authUrl, state, expiresAt } =
      await itchAuth.generateAuthUrl(pollId);

    res.json({
      authUrl,
      state,
      expiresAt,
    });
  } catch (error) {
    log.error("Get itch.io auth URL error", { error });
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Failed to generate Itch.io authentication URL",
        ),
      );
  }
});

// GET /auth/itchio/callback - serve HTML for token extraction
router.get("/callback", (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Itch.io Authentication</title>
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




        async function storeOAuthResultOnServer(data) {
            try {
                const params = getUrlParams();
                const state = params.state;
                let pollId = null;

                if (state && state.includes('_pollid_')) {
                    pollId = state.split('_pollid_')[1];
                }

                if (!pollId) {
                    console.error('No poll_id found in state parameter. State:', state);
                    return false;
                }


                const response = await fetch(\`/auth/oauth/store/\${pollId}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const result = await response.json();
                return true;
            } catch (error) {
                console.error('Failed to store OAuth result on server:', error);
                return false;
            }
        }

        function sendResultAndClose(data) {
            storeOAuthResultOnServer(data).then(success => {
                if (!success) {
                    console.error('Failed to store OAuth result on server');
                }

                setTimeout(() => {
                    try {
                        window.close();
                    } catch (e) {
                        updateMessage('Authentication complete. You may close this window.');
                    }
                }, 1000);
            }).catch(error => {
                console.error('Error in OAuth result storage:', error);
                updateMessage('Authentication complete. Please close this window manually.');
            });
        }

        function handleSuccess(authData) {
            hideSpinner();
            updateStatus('Authentication successful!', 'success');
            updateMessage('You may close this window or it will close automatically.');

            const message = {
                success: true,
                sessionId: authData.sessionId,
                user: authData.user,
                message: authData.message,
                timestamp: Date.now()
            };

            sendResultAndClose(message);
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

            sendResultAndClose(message);
        }

        async function exchangeTokenForSession(accessToken, state) {
            try {
                const response = await fetch('/auth/itchio/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: accessToken,
                        state: state
                    })
                });

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

                if (params.error) {
                    const errorDescription = params.error_description || params.error;
                    console.error('OAuth error received:', { error: params.error, description: errorDescription });
                    throw new Error('OAuth Error: ' + errorDescription);
                }

                const accessToken = params.access_token;
                if (!accessToken) {
                    throw new Error('No access token received from Itch.io');
                }

                const state = params.state;
                if (!state) {
                    throw new Error('No state parameter received');
                }


                updateStatus('Exchanging token for session...', 'loading');

                const authData = await exchangeTokenForSession(accessToken, state);

                if (!authData || !authData.sessionId) {
                    console.error('Invalid auth response:', authData);
                    throw new Error('Invalid response from authentication server');
                }

                handleSuccess(authData);

            } catch (error) {
                console.error('Callback processing error:', error);
                let errorMessage = error.message;
                if (error.message.includes('account_exists')) {
                    errorMessage = 'An account with this Itch.io profile already exists. Try logging in instead.';
                } else if (error.message.includes('username_taken')) {
                    errorMessage = 'This username is already taken. Your Itch.io account cannot be linked.';
                } else if (error.message.includes('invalid_token')) {
                    errorMessage = 'Authentication session expired. Please close this window and try again.';
                } else if (error.message.includes('network_error')) {
                    errorMessage = 'Connection failed. Please check your internet and try again.';
                }
                handleError(error.name || 'authentication_failed', errorMessage);
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

        function initialize() {

            const params = getUrlParams();
            if (params.access_token || params.error) {
                processCallback();
            } else {
                handleDirectNavigation();
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize();
        }

    })();
    </script>
</body>
</html>
`;

  res.setHeader("Content-Type", "text/html");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'none'; frame-ancestors 'none';",
  );
  res.send(html);
});

// POST /auth/itchio/callback - handle extracted token
router.post("/callback", async (req: Request, res: Response) => {
  try {
    const { access_token, state } = req.body;

    if (!access_token) {
      return res
        .status(400)
        .json(
          errorResponse(
            ERROR_CODES.MISSING_PARAMETERS,
            "Missing access token from Itch.io authentication",
          ),
        );
    }

    const { sessionId, user: itchUser } = await itchAuth.authenticateWithCode(
      access_token as string,
      state as string,
    );

    const user = await userQueries.findByPlatformId("itch", itchUser.id);

    if (!user) {
      return res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.USER_NOT_FOUND,
            "User account was not properly created during Itch.io authentication",
          ),
        );
    }

    res.json({
      success: true,
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        platform: user.platform,
        isAdmin: user.is_admin || false,
      },
      message: "Itch.io authentication successful",
    });
  } catch (error) {
    log.error("Itch.io callback error", { error });

    const constraintError = getConstraintError(error);
    if (constraintError) {
      return res
        .status(400)
        .json(errorResponse(constraintError.error, constraintError.message));
    }

    if (error instanceof Error) {
      if (error.message.includes("Invalid or expired access token")) {
        return res
          .status(401)
          .json(
            errorResponse(
              ERROR_CODES.EXPIRED_TOKEN,
              "Your Itch.io access token has expired. Please try signing in again.",
            ),
          );
      }

      if (error.message.includes("Failed to get user info")) {
        return res
          .status(503)
          .json(
            errorResponse(
              ERROR_CODES.PLATFORM_ERROR,
              "Unable to retrieve your Itch.io profile information. Please try again later.",
            ),
          );
      }

      if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        return res
          .status(503)
          .json(
            errorResponse(
              ERROR_CODES.NETWORK_ERROR,
              "Unable to connect to Itch.io servers. Please try again later.",
            ),
          );
      }
    }

    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Itch.io authentication failed due to an unexpected error",
        ),
      );
  }
});

export default router;

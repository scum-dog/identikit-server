import { Router, Request, Response } from "express";
import { googleAuth } from "../../auth/google";
import { userQueries } from "../../database";
import { log } from "../../utils/logger";
import {
  getConstraintError,
  ERROR_CODES,
  errorResponse,
} from "../../utils/errorHandler";

const router = Router();

router.get("/authorization-url", async (req: Request, res: Response) => {
  try {
    const pollId = req.query.poll_id as string;
    const { authUrl, state, expiresAt } =
      await googleAuth.generateAuthUrl(pollId);

    res.json({ authUrl, state, expiresAt });
  } catch (error) {
    log.error("Google auth URL error", { error });
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Failed to generate Google authentication URL",
        ),
      );
  }
});

// GET /auth/google/callback - serve HTML for OAuth response processing
router.get("/callback", (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/@sakun/system.css" />
    <link
      rel="icon"
      type="image/png"
      sizes="32x32"
      href="/public/images/favicon-32x32.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="16x16"
      href="/public/images/favicon-16x16.png"
    />
    <title>SCUM DOG</title>
    <style>
      body {
        background: url("/public/images/oauthbackground.png") !important;
        background-size: cover !important;
        image-rendering: pixelated;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
      }
      p {
        font-family:
          "Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif;
        font-weight: bold;
      }
      #container {
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="standard-dialog scale-down" id="container" style="width: 27rem">
      <h1 id="status" class="dialog-text">Processing authentication...</h1>
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
            return Object.fromEntries(urlParams.entries());
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
                message: authData.message
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
                message: description
            };

            sendResultAndClose(message);
        }

        async function exchangeCodeForSession(code, state) {
            try {
                const response = await fetch('/auth/google/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: code,
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
                console.error('Code exchange error:', error);
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

                const code = params.code;
                if (!code) {
                    throw new Error('No authorization code received from Google');
                }

                const state = params.state;
                if (!state) {
                    throw new Error('No state parameter received');
                }

                updateStatus('Exchanging code for session...', 'loading');

                const authData = await exchangeCodeForSession(code, state);

                if (!authData || !authData.sessionId) {
                    console.error('Invalid auth response:', authData);
                    throw new Error('Invalid response from authentication server');
                }

                handleSuccess(authData);

            } catch (error) {
                console.error('Callback processing error:', error);
                let errorMessage = error.message;
                if (error.message.includes('account_exists')) {
                    errorMessage = 'An account with this Google profile already exists. Try logging in instead.';
                } else if (error.message.includes('username_taken')) {
                    errorMessage = 'This username is already taken. Your Google account cannot be linked.';
                } else if (error.message.includes('invalid_grant') || error.message.includes('authorization code')) {
                    errorMessage = 'Authentication session expired. Please close this window and try again.';
                } else if (error.message.includes('network') || error.message.includes('timeout')) {
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

            if (params.code || params.error) {
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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data:; form-action 'none'; frame-ancestors 'none';",
  );
  res.send(html);
});

// POST /auth/google/callback - handle code exchange for session
const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res
        .status(400)
        .json(
          errorResponse(
            ERROR_CODES.MISSING_PARAMETERS,
            "Missing required authentication parameters (code or state)",
          ),
        );
    }

    const { sessionId, user: googleUser } =
      await googleAuth.authenticateWithCode(code as string, state as string);
    const user = await userQueries.findByPlatformId("google", googleUser.id);

    if (!user) {
      return res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.USER_NOT_FOUND,
            "User account was not properly created during authentication",
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
      message: "Google authentication successful",
    });
  } catch (error) {
    log.error("Google callback error", { error });

    const constraintError = getConstraintError(error);
    if (constraintError) {
      return res
        .status(400)
        .json(errorResponse(constraintError.error, constraintError.message));
    }

    if (error instanceof Error) {
      if (
        error.message.includes("invalid_grant") ||
        error.message.includes("authorization code")
      ) {
        return res
          .status(400)
          .json(
            errorResponse(
              ERROR_CODES.INVALID_TOKEN,
              "Invalid or expired Google authorization code. Please try signing in again.",
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
              "Unable to connect to Google's servers. Please try again later.",
            ),
          );
      }
    }

    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Google authentication failed due to an unexpected error",
        ),
      );
  }
};

router.post("/callback", handleGoogleCallback);

export default router;

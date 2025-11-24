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
    const { authUrl, state, expiresAt } = await googleAuth.generateAuthUrl();
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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Authentication</title>
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
            border-top: 3px solid #4285f4;
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
            return Object.fromEntries(urlParams.entries());
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
                }, 100);
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
                console.log('Google callback processing started:', params);

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
                console.log('Exchanging authorization code for session...');

                const authData = await exchangeCodeForSession(code, state);
                console.log('Authentication exchange completed:', {
                    hasSessionId: !!(authData?.sessionId),
                    hasUser: !!(authData?.user),
                    success: !!(authData?.success)
                });

                if (!authData || !authData.sessionId) {
                    console.error('Invalid auth response:', authData);
                    throw new Error('Invalid response from authentication server');
                }

                console.log('Google authentication successful, sending to parent window');
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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'none'; frame-ancestors 'none';",
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

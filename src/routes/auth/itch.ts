import { Router, Request, Response } from "express";
import crypto from "crypto";
import { itchAuth } from "../../auth/itch";
import { userQueries } from "../../database";
import { log } from "../../utils/logger";
import {
  getConstraintError,
  ERROR_CODES,
  errorResponse,
} from "../../utils/errorHandler";

const router = Router();

// GET /auth/itchio/url - get itch.io OAuth URL
router.get("/url", (req: Request, res: Response) => {
  try {
    const { authUrl, state, expiresAt } = itchAuth.generateAuthUrl();

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
  const nonce = crypto.randomBytes(16).toString("base64");
  const html = `
<!DOCTYPE html>
<html>
  <body>
    <div id="status" style="font-size: 200%;">Processing authentication...</div>
    
    <script nonce="${nonce}">
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const state = params.get('state');

      if (accessToken) {
        fetch('/auth/itchio/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, state: state })
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              document.getElementById('status').innerHTML = 'Authentication successful!';
              if (window.opener) {
                window.opener.postMessage(data, '*');
                window.close();
              } else {
                document.getElementById('status').innerHTML += '<br><br>You may now close this window and return to IDENTI-NET.';
              }
            } else {
              let errorMessage = data.message || 'Unknown error';
              if (data.error === 'account_exists') {
                errorMessage = 'An account with this Itch.io profile already exists. Try logging in instead.';
              } else if (data.error === 'username_taken') {
                errorMessage = 'This username is already taken. Your Itch.io account cannot be linked.';
              } else if (data.error === 'invalid_token') {
                errorMessage = 'Authentication session expired. Please close this window and try again.';
              } else if (data.error === 'network_error') {
                errorMessage = 'Connection failed. Please check your internet and try again.';
              }
              document.getElementById('status').innerHTML = \`Authentication failed: \${errorMessage}\`;
            }
          })
          .catch(() => {
            document.getElementById('status').innerHTML = 'Authentication failed: Unable to connect to server. Please check your internet connection and try again.';
          });
      } else {
        document.getElementById('status').innerHTML = 'Authentication failed: Itch.io did not provide an access token. Please try the authentication process again.';
      }
    </script>
  </body>
</html>
`;

  res.setHeader("Content-Type", "text/html");
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'`,
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

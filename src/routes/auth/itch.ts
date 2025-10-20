import { Router, Request, Response } from "express";
import crypto from "crypto";
import { itchAuth } from "../../auth/itch";
import { userQueries } from "../../database";

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
    console.error("Get itch.io auth URL error:", error);
    res.status(500).json({ error: "Failed to generate authentication URL" });
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
              document.getElementById('status').innerHTML = 'Authentication failed: ' + data.message;
            }
          })
          .catch(() => {
            document.getElementById('status').innerHTML = 'Authentication failed: Network error';
          });
      } else {
        document.getElementById('status').innerHTML = 'Authentication failed: No access token found';
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
      return res.status(400).json({
        success: false,
        error: "missing_parameters",
        message: "Missing access_token parameter",
      });
    }

    const { sessionId, user: itchUser } = await itchAuth.authenticateWithCode(
      access_token as string,
      state as string,
    );

    const user = await userQueries.findByPlatformId(
      "itchio",
      itchUser.id.toString(),
    );

    if (!user) {
      throw new Error("User not found after OAuth flow");
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
    console.error("Itch.io callback error:", error);
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Itch.io authentication failed",
    });
  }
});

export default router;

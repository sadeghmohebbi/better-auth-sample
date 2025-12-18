const express = require("express");
const Database = require("better-sqlite3");
const { betterAuth } = require("better-auth");
const { oidcProvider, jwt } = require("better-auth/plugins");
const { toNodeHandler } = require("better-auth/node");

// 1. Initialize Database
const db = new Database("/tmp/baseapp/database.sqlite");

// 2. Configure Better Auth with OIDC Provider
const auth = betterAuth({
  database: db,
  plugins: [
    jwt(), // Required for OIDC to sign tokens
    oidcProvider({
      loginPage: "/login",
      useJWTPlugin: true,
    }),
  ],
  emailAndPassword: { enabled: true },
  disabledPaths: ["/token"], // Disable default token endpoint to avoid conflicts
});

// 3. Setup Express Server
const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse form data

// 4. Mount Better Auth API Handler
app.use("/api/auth", toNodeHandler(auth));

// 5. Serve Custom Login Page
app.get("/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>OIDC Login</title></head>
      <body style="font-family: sans-serif; padding: 2rem; display: flex; justify-content: center;">
        <div style="border: 1px solid #ccc; padding: 2rem; border-radius: 8px; width: 300px;">
          <h2 style="margin-top:0;">Sign In</h2>
          <form id="loginForm">
            <div style="margin-bottom: 1rem;">
              <label>Email</label><br>
              <input type="email" id="email" required style="width: 100%; padding: 8px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 1rem;">
              <label>Password</label><br>
              <input type="password" id="password" required style="width: 100%; padding: 8px; box-sizing: border-box;">
            </div>
            <button type="submit" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; cursor: pointer;">Login</button>
          </form>
          <p id="error" style="color: red; display: none;"></p>
        </div>
        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const res = await fetch('/api/auth/sign-in/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (res.ok) {
              // Redirect back to the OIDC flow (the 'other app')
              window.location.href = "/"; 
            } else {
              document.getElementById('error').innerText = data.message || "Login failed";
              document.getElementById('error').style.display = 'block';
            }
          });
        </script>
      </body>
    </html>
  `);
});

// 6. HELPER: Route to Create a User & Register a Client (Run this once)
app.get("/setup", async (req, res) => {
  try {
    // A. Create a dummy user
    await auth.api.signUpEmail({
      body: { email: "user@demo.com", password: "password1234", name: "Demo User" },
      asResponse: false // internal call
    }).catch(() => console.log("User likely already exists"));

    // B. Register an OIDC Client
    const client = await auth.api.registerOAuthApplication({
      body: {
        name: "My External App",
        client_uri: "http://localhost:4000",
        redirect_uris: ["http://localhost:4000/api/auth/callback/my-provider"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_basic",
      }
    });

    res.json({
      message: "Setup complete! Save these credentials for your other app.",
      user: { email: "user@demo.com", password: "password1234" },
      client_config: {
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        discoveryUrl: "http://localhost:3000/.well-known/openid-configuration"
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(4000, () => {
  console.log("----------------------------------------------------------");
  console.log("🚀 OIDC Provider running at http://localhost:3000");
  console.log("👉 1. Run 'npx @better-auth/cli migrate' if you haven't yet.");
  console.log("👉 2. Visit http://localhost:3000/setup to generate Client ID/Secret.");
  console.log("👉 3. Discovery URL: http://localhost:3000/.well-known/openid-configuration");
  console.log("----------------------------------------------------------");
});
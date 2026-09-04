#!/usr/bin/env node
// google-login-helper.mjs — QuickDrop Google login made easy
//
// USAGE:
//   1. Make sure the QuickDrop server is running (npm run dev)
//   2. Run:  node scripts/google-login-helper.mjs
//   3. A browser tab opens for Google sign-in
//   4. After signing in, Google redirects to localhost:5000/... (your API).
//      The browser may show the API's 404 — THAT'S FINE. Just copy the
//      FULL address from the address bar (it contains ?code=...).
//   5. Paste that URL back here and press Enter.
//   6. The script exchanges the code and logs you in.
//
// This avoids needing a separate callback server / port conflicts.

import { exec } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import "dotenv/config";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = process.env.GOOGLE_REDIRECT_URI;
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5000";

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env");
	process.exit(1);
}

const scope = "openid email profile";
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

console.log("\n🔑  QuickDrop Google Login Helper\n");
console.log("Your redirect URI is:", REDIRECT, "\n");
console.log("Opening Google sign-in in your browser...\n");

if (process.platform === "darwin") {
	exec(`open "${authUrl}"`);
} else if (process.platform === "win32") {
	exec(`start "" "${authUrl}"`);
} else {
	exec(`xdg-open "${authUrl}"`);
}

console.log("If the browser didn't open, paste this into your address bar:\n");
console.log("   " + authUrl + "\n");

const rl = readline.createInterface({ input, output });

rl.question(
	"👉  Two ways to continue:\n" +
	"   [1] Paste the FULL redirect URL from the address bar (contains ?code=...)\n" +
	"   [2] Paste a Google ID TOKEN directly (JWT starting with 'eyJ...')\n\n" +
	"    Enter here: ",
	async (answer) => {
		rl.close();
		const trimmed = answer.trim();

		// Path 2: user pasted a raw id_token
		if (trimmed.startsWith("eyJ")) {
			console.log("\n✅ Got an ID token. Sending to QuickDrop backend...");
			const resp = await fetch(`${BACKEND}/api/v1/auth/google/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken: trimmed }),
			});
			await printLoginResult(resp);
			return;
		}

		// Path 1: user pasted the redirect URL containing ?code=
		try {
			const target = new URL(trimmed);
			const code = target.searchParams.get("code");
			const err = target.searchParams.get("error");

			if (!code) {
				console.error("\n❌ No code found in that URL.");
				console.error("   Google error param:", err ?? "(none)");
				if (err === "redirect_uri_mismatch" || err?.includes("redirect_uri_mismatch") || decodedError(trimmed).includes("redirect_uri_mismatch")) {
					console.error("\n🔧 FIX: Add this exact URI to GCP OAuth Client > 'Authorized redirect URIs':");
					console.error("   " + REDIRECT);
					console.error("   (Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > your client > Authorized redirect URIs)\n");
				}
				process.exit(1);
			}

			console.log("\n✅ Got auth code. Exchanging with QuickDrop backend...");
			const resp = await fetch(`${BACKEND}/api/v1/auth/google/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code, redirectUri: REDIRECT }),
			});
			await printLoginResult(resp);
		} catch (e) {
			console.error("\n❌ Could not parse that URL:", e.message);
		}
	},
);

function decodedError(input) {
	try {
		const url = new URL(input);
		const err = url.searchParams.get("authError");
		if (err) return Buffer.from(err, "base64").toString("utf8");
	} catch {
		/* ignore */
	}
	return "";
}

async function printLoginResult(resp) {
	const data = await resp.json();
	if (data.success) {
		console.log("\n🎉 SUCCESS! Logged in as:", data.data.user.email, "(" + data.data.user.role + ")");
		console.log("\n   Copy this full accessToken into Postman's {{accessToken}} variable:\n");
		console.log("   " + data.data.accessToken);
		console.log("\n   For the customer-token variable, your role is: " + data.data.user.role);
	} else {
		console.log("\n❌ Backend rejected login:", JSON.stringify(data, null, 2));
		if (/redirect_uri_mismatch|client_id/i.test(JSON.stringify(data, null, 2))) {
			console.error("\n🔧 If it's a redirect_uri_mismatch, add this to GCP OAuth Authorized redirect URIs:\n   " + REDIRECT);
		}
	}
	process.exit(0);
}
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";

import { sendResponse } from "../../utils/sendResponse";

import { setAuthCookies } from "../../utils/cookies";

import { AuthService } from "./auth.service";

const googleLogin = catchAsync(async (req, res) => {
	const result = await AuthService.googleLogin({
		code: req.body.code,
		idToken: req.body.idToken,
		redirectUri: req.body.redirectUri,
	});

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Google login successful.",
		data: result,
	});
});

const googleCallback = catchAsync(async (req, res) => {
	const code = req.query.code as string | undefined;
	const error = req.query.error as string | undefined;

	if (error) {
		res.status(httpStatus.BAD_REQUEST).send(
			`<h2>Google login failed</h2><p>${encodeURIComponent(error)}</p><p>Make sure ${process.env.GOOGLE_REDIRECT_URI ?? ""} is added to your GCP OAuth client "Authorized redirect URIs".</p>`,
		);
		return;
	}

	if (!code) {
		res.status(httpStatus.BAD_REQUEST).send("<h2>Google login failed</h2><p>No authorization code was returned.</p>");
		return;
	}

	const result = await AuthService.googleLogin({
		code,
		redirectUri: (req.body?.redirectUri as string | undefined) ?? process.env.GOOGLE_REDIRECT_URI ?? "",
	});

	setAuthCookies(res, result.accessToken, result.refreshToken);

	const data = `
<!DOCTYPE html>
<html lang="en" style="font-family:system-ui">
  <head><meta charset="utf-8"><title>QuickDrop — Google Login</title></head>
  <body style="max-width:720px;margin:48px auto;padding:0 24px">
    <h1>✅ Logged in via Google</h1>
    <p>You are signed in as <strong>${result.user.name}</strong> (<code>${result.user.email}</code>) with role <strong>${result.user.role}</strong>.</p>
    <p>You can now use the API. This browser session holds your access &amp; refresh cookies.</p>
    <h3>Tokens (for Postman):</h3>
    <p><strong>accessToken:</strong></p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:8px;word-break:break-all;font-size:12px">${result.accessToken}</pre>
    <p>...refreshToken (see login JSON in server log)...</p>
    <p><a href="/api/v1/auth/logout">Logout</a></p>
  </body>
</html>`;

	res.status(httpStatus.OK).send(data);
});

export const GoogleAuthController = {
	googleLogin,
	googleCallback,
};

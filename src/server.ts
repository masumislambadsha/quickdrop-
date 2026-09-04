import app from "./app";

import config from "./app/config";

const PORT = config.app.port;

const startServer = (): void => {
	if (process.env.VERCEL) {
		// Vercel manages the server lifecycle — export the app instead of listening.
		return;
	}

	app.listen(PORT, () => {
		console.log(`🚚 QuickDrop API running on ${config.app.backendUrl} (${config.app.env})`);
	});
};

startServer();

export default app;
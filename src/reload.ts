// @ts-nocheck

import fs from 'fs';
import { appConfig } from './config';

export function reload({ app, watch, options = {} }) {
	if (appConfig.env !== 'development') return;

	const pollInterval = options.pollInterval || 50;
	const quiet = options.quiet || false;
	let changeDetected = false;

	watch.forEach(({ path: dir, extensions }) => {
		const extensionsSet = new Set(extensions);

		fs.watch(dir, { recursive: true }, (_, filename) => {
			if (filename && extensionsSet.has(filename.slice(filename.lastIndexOf('.')))) {
				if (!quiet) console.log('File changed:', filename);
				changeDetected = true;
			}
		});
	});

	app.get('/wait-for-reload', (req, res) => {
		const timer = setInterval(() => {
			if (changeDetected) {
				changeDetected = false;
				clearInterval(timer);
				res.send();
			}
		}, pollInterval);

		req.on('close', () => clearInterval(timer));
	});

	const clientScript = `
    <script>
    (async function poll() {
        try {
            await fetch('/wait-for-reload');
            location.reload();
        } catch {
            location.reload();
        }
    })();
    </script>`;

	app.use((req, res, next) => {
		const originalRender = res.render;
		const originalSend = res.send;

		res.send = function (body) {
			if (typeof body === 'string' && body.includes('</head>')) {
				body = body.replace('</head>', clientScript + '</head>');
			}

			return originalSend.call(this, body);
		};

		next();
	});
}

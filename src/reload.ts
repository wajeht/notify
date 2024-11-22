// @ts-nocheck

import fs from 'fs';

export function reload({ app, watch, options = {} }) {
	if (process.env.NODE_ENV === 'production') return;

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
				res.send(); // Empty 200 OK
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
		res.render = function (view, options, callback) {
			originalRender.call(this, view, options, (err, html) => {
				if (err) return callback ? callback(err) : next(err);
				res.send(html.replace('</head>', clientScript + '</head>'));
			});
		};
		next();
	});
}

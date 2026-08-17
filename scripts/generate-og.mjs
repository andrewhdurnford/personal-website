// Rebuilds the site, boots a local preview server, screenshots the homepage,
// and overwrites public/meta.jpeg so OG/Twitter cards stay in sync with the live design.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = 4322;
const url = `http://localhost:${port}`;
const outFile = path.join(rootDir, 'public', 'meta.jpeg');

function run(cmd, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd: rootDir, stdio: 'inherit' });
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
	});
}

async function waitForServer(target, timeoutMs = 30000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(target);
			if (res.ok) return;
		} catch {}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error('preview server did not come up in time');
}

console.log('Building site...');
await run('npx', ['astro', 'build']);

console.log('Starting preview server...');
const preview = spawn('npx', ['astro', 'preview', '--port', String(port)], {
	cwd: rootDir,
	stdio: 'inherit',
});

try {
	await waitForServer(url);

	console.log('Screenshotting...');
	const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
	const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.addStyleTag({ content: '#toggle-crt { display: none !important; }' });
	await page.screenshot({ path: outFile, type: 'jpeg', quality: 92 });
	await browser.close();

	console.log(`Saved ${outFile}`);
} finally {
	preview.kill();
}

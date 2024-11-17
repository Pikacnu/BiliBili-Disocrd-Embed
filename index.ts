import { readFile } from 'fs/promises';
import YTDlpWrap from 'yt-dlp-wrap';
import { mkdir, exists } from 'fs/promises';

if (!(await exists('./download'))) {
	await mkdir('./download');
}

enum VideoType {
	Video = '/video',
	Bangumi = '/bangumi/play',
}

async function downloadVideo(id: string, type: VideoType = VideoType.Video) {
	console.log('Downloading', id);
	console.log('Type', type);
	if (
		!(await exists(`./download/${id}`)) ||
		!(await exists(`./download/${id}/video.mp4`))
	) {
		if (!(await exists(`./download/${id}`))) await mkdir(`./download/${id}`);

		const ytdlp = new YTDlpWrap();
		await ytdlp.execPromise([
			'--write-thumbnail',
			'--write-info-json',
			'-o',
			`${__dirname}/download/${id}/video.%(ext)s`,
			`https://www.bilibili.com${type}/${id}`,
		]);
	}

	const video_info = JSON.parse(
		(await readFile(`./download/${id}/video.info.json`)).toString(),
	);
	return new Response(
		(await readFile('./embed.html'))
			.toString()
			.replaceAll('@@video_url@@', `/video_data/${id}`)
			.replaceAll('@@thumbnail_url@@', `/thumbnail/${id}`)
			.replaceAll('@@video_player@@', `/player/${id}`)
			.replaceAll('@@title@@', video_info.title)
			.replaceAll('@@description@@', video_info.description)
			.replaceAll('@@bilibili_link@@', `https://www.bilibili.com${type}/${id}`)
			.replaceAll('@@author@@', video_info.uploader)
			.replaceAll('@@keywords@@', video_info.tags.join(', ')),
		{
			status: 200,
			headers: {
				'Content-Type': 'text/html',
				'Cache-Control': 'no-cache,max-age=0',
			},
		},
	);
}

Bun.serve({
	port: 5173,
	/*
	hostname: '0.0.0.0',
	key: readFileSync('./key.pem'),
	cert: readFileSync('./cert.pem'),
	*/
	async fetch(request, server) {
		const url = new URL(request.url);
		console.log(url.pathname);

		if (url.pathname.startsWith('/video_data')) {
			const id = url.pathname.split('/').pop();
			const file = `./download/${id}/video.mp4`;
			if (await exists(file)) {
				return new Response(Bun.file(file), {
					status: 200,
					headers: {
						'Content-Type': 'video/mp4',
						'Cache-Control': 'no-cache,max-age=0',
					},
				});
			}
		}
		if (url.pathname.startsWith('/video')) {
			const id = url.pathname.split('/')[2];
			return await downloadVideo(id);
		}
		if (url.pathname.startsWith('/bangumi')) {
			const id = url.pathname.split('/')[3];
			return await downloadVideo(id, VideoType.Bangumi);
		}

		if (url.pathname.startsWith('/thumbnail')) {
			const id = url.pathname.split('/').pop();
			const file = `./download/${id}/video.jpg`;
			if (await exists(file)) {
				return new Response(Bun.file(file), {
					status: 200,
					headers: {
						'Content-Type': 'image/jpeg',
						'Cache-Control': 'no-cache,max-age=0',
					},
				});
			}
		}
		if (url.pathname.startsWith('/player')) {
			const id = url.pathname.split('/').pop();
			return new Response(
				(await readFile('./player.html'))
					.toString()
					.replace('@@url@@', `/video_data/${id}`),
				{
					status: 200,
					headers: {
						'Content-Security-Policy': "frame-ancestors 'self' *",
						'Content-Type': 'text/html',
						'Cache-Control': 'no-cache,max-age=0',
					},
				},
			);
		}
		if (url.pathname === '/') {
			return new Response(await readFile('./index.html'), {
				status: 200,
				headers: {
					'Content-Type': 'text/html',
					'Cache-Control': 'no-cache,max-age=0',
				},
			});
		}
		return new Response('404 Not Found PABAO', { status: 404 });
	},
});

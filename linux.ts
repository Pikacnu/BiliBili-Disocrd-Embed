import { mkdir, exists } from 'fs/promises';
import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';
import { writeFile } from 'fs/promises';
import Bun from 'bun';

if (!(await exists('./download'))) {
	await mkdir('./download');
}

enum VideoType {
	Video = '/video',
	Bangumi = '/bangumi/play',
}

async function streamMergedVideo(
	id: string,
	type: VideoType,
): Promise<Response> {
	console.log('Streaming merged video live:', id);

	const videoStream = spawn(
		'yt-dlp',
		`-f bestvideo -o - https://www.bilibili.com${type}/${id}`.split(' '),
		{
			stdio: ['pipe', 'pipe', 'ignore'],
		},
	);
	const audioStream = spawn(
		`yt-dlp`,
		`-f bestaudio -o - https://www.bilibili.com${type}/${id}`.split(' '),
		{
			stdio: ['pipe', 'pipe', 'ignore'],
		},
	);

	// 合併流
	const ffmpeg = spawn(
		`ffmpeg`,
		`-i pipe:0 -thread_queue_size 1024 -i pipe:3 -filter_complex "[0:v] [1:v] concat=n=2:v=1:a=1 [v] [a]" -map "[v]" -map "[a]" -shortest -thread_queue_size 1024 -c:v copy -c:a aac -movflags frag_keyframe+empty_moov -f mp4 pipe:1`.split(
			' ',
		),
		{
			stdio: ['pipe', 'pipe', 'ignore', 'pipe'], // 配置 stdio 管道
			shell: true,
		},
	);

	ffmpeg.unref();
	videoStream.on('error', (err) => {
		console.error('videoStream error', err);
	});
	(videoStream.stdout as Readable).pipe(ffmpeg.stdio[0] as Writable, {
		end: false,
	});
	(audioStream.stdout as Readable).pipe(ffmpeg.stdio[3] as Writable, {
		end: false,
	});
	// 將影片和音訊流寫入 ffmpeg

	writeFile(
		`./download/${id}/video.mp4`,
		ffmpeg.stdio[1] as Readable,
		'binary',
	);

	// 返回合併流
	return new Response(
		new ReadableStream({
			start(controller) {
				(ffmpeg.stdio[1] as Readable).on('data', (chunk) => {
					controller.enqueue(chunk);
				});
				(ffmpeg.stdio[1] as Readable).on('end', () => {
					controller.close();
				});
			},
		}),
		{
			headers: {
				'Content-Type': 'video/mp4',
				'Cache-Control': 'no-cache,max-age=0',
			},
		},
	);
}

async function downloadVideo(id: string, type: VideoType = VideoType.Video) {
	console.log('Type', type);
	if (
		!(await exists(`./download/${id}`)) ||
		!(await exists(`./download/${id}/video.mp4`))
	) {
		if (!(await exists(`./download/${id}`))) await mkdir(`./download/${id}`);
		await new Promise((resolve, reject) => {
			spawn('yt-dlp', [
				'--write-thumbnail',
				'--write-info-json',
				'-o',
				`${__dirname}/download/${id}/video.%(ext)s`,
				`https://www.bilibili.com${type}/${id}`,
			]).on('exit', (code) => {
				if (code === 0) {
					resolve(void 0);
				} else {
					reject(code);
				}
			});
		});
	}

	const video_info = JSON.parse(
		(await readFile(`./download/${id}/video.info.json`)).toString(),
	);
	console.log('Send Embed html', id);
	return new Response(
		(await readFile('./embed.html'))
			.toString()
			.replaceAll('@@video_url@@', `/video_data/${id}`)
			.replaceAll('@@thumbnail_url@@', `/thumbnail/${id}`)
			.replaceAll(
				'@@video_player@@',
				`https://www.bilibili.com${type}/${id}` /* `/player/${id}` `https://www.bilibili.com/blackboard/newplayer.html?bvid=${id}&danmaku=0&autoplay=1`*/,
			)
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
	idleTimeout: 1000 * 60 * 60 * 24,
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
			if (!id || /\/\S{12}\//.test(id)) {
				return new Response('404 Not Found PABAO', { status: 404 });
			}
			if (await exists(file)) {
				console.log('File exists:', file);
				return new Response(Bun.file(file), {
					status: 200,
					headers: {
						'Content-Type': 'video/mp4',
						'Cache-Control': 'no-cache,max-age=0',
						'Content-Disposition': `attachment; filename="${id}.mp4"`,
						'Content-Ranges': `bytes */${Bun.file(file).size}`,
					},
				});
			}
			console.log('Streaming merged video:', id);
			return await streamMergedVideo(id, VideoType.Video);
		}
		if (url.pathname.startsWith('/video')) {
			const id = url.pathname.split('/')[2];
			if (!id || /\/\S{12}\//.test(id)) {
				return new Response('404 Not Found PABAO', { status: 404 });
			}
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

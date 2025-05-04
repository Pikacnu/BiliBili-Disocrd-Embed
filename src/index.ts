import type { AudioQuality, BilibiliVideoInfo, VideoQuality } from './bilibili';
import { isDiscordBot, isValidBVID } from './bilibili';
import { BilibiliVideo } from './bilibili/classes';
import { exists } from 'fs/promises';

let cache: Map<string, string> = new Map();
let fileSize: Map<string, number> = new Map();
let videoInfoCache: Map<string, BilibiliVideoInfo> = new Map();

await loadCache();

let discordVideoDownloadCounter: Map<string, number> = new Map();

const sessionData = await Bun.file('./cookies/bilibili.json').json();
const session = sessionData?.cookie.SESSDATA;

const currentURL = process.env.CURRENTURL || 'https://your-domain.com';
const chunkSize = 1024 * 1024 * 10; // 20MB

const cfTest = false; // Set to true to use Cloudflare test mode

Bun.serve({
	port: 3000,
	idleTimeout: 200,
	async fetch(request) {
		const process = async (request: Request) => {
			const url = new URL(request.url);
			console.log(url.pathname);
			const path = url.pathname.split('/');
			const isBot = isDiscordBot(request.headers);
			if (path[1] === 'video_data') {
				const bvid = path[2];
				let filepath = cache.get(bvid);
				if (!filepath) {
					console.log(`awaiting for file to be downloaded`);
					await Bun.sleep(6 * 1000);
					filepath = cache.get(bvid);
				}

				const counter = discordVideoDownloadCounter.get(bvid) || 0;
				if (isBot) {
					if (counter >= 4) {
						discordVideoDownloadCounter.set(bvid, 0);
					} else {
						discordVideoDownloadCounter.set(bvid, counter + 1);
					}
				}

				if (!filepath) {
					console.error(`File not found for BVID: ${bvid}`);
					return new Response('Error', {
						status: 500,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}

				let range = request.headers.get('Range');
				if (!range) {
					console.log(`No range header, sending full file`);
					return new Response(Bun.file(filepath).stream(), {
						status: 200,
						headers: {
							'Content-Type': 'video/mp4',
							'Accept-Ranges': 'bytes',
							'Content-Length': (fileSize.get(bvid) || 0).toString(),
							'Content-Disposition': `inline; filename="${bvid}.mp4"`,
						},
					});
				}

				if (isBot) {
					console.log(`Bot detected, using chunked download`);
					const chunk = parseInt(((fileSize.get(bvid) || 0) / 2).toFixed(0));
					//const chunk = chunkSize;
					console.log(`Chunk size: ${chunk}`);
					let start = counter * chunk;
					let end = start + chunk - 1;
					if (end > (fileSize.get(bvid) || 0)) {
						end = (fileSize.get(bvid) || 0) - 1;
					}
					if (start > end) {
						start = end;
					}
					range = `bytes=${start}-${end}`;
				}

				if (!range) {
					return new Response('Range Parse Error', {
						status: 500,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
				console.log(`Range header: ${range}`);
				let [start, end] = range
					.replace('bytes=', '')
					.split('-')
					.map((v) => parseInt(v, 10));
				if (isNaN(start)) start = 0;
				if (isNaN(end)) end = fileSize.get(bvid) || 0;
				console.log(`Range: ${start} - ${end}`);

				return new Response(Bun.file(filepath).slice(start, end).stream(), {
					status: 206,
					headers: {
						'Content-Type': 'video/mp4',
						'Accept-Ranges': 'bytes',
						'Content-Length': (end - start).toString(),
						'Content-Disposition': `inline; filename="${bvid}.mp4"`,
						'Content-Range': `bytes ${start}-${end}/${
							(fileSize.get(bvid) || 0) - 1
						}`,
					},
				});
			}

			if (path[1] === 'player') {
				const bvid = path[2];
				if (!isValidBVID(bvid)) {
					return new Response('Invalid BVID', {
						status: 400,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
				const video = videoInfoCache.get(bvid);
				if (!video) {
					return new Response('Video not found', {
						status: 404,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
				return new Response(
					(await Bun.file('./player.html').text()).replaceAll(
						'@@url@@',
						`${currentURL}/video_data/${bvid}`,
					) || '',
					{
						status: 200,
						headers: {
							'Content-Type': 'text/html',
							'Cache-Control': 'no-cache,max-age=0',
						},
					},
				);
			}

			if (path[1] === 'thumbnail') {
				const bvid = path[2];
				const fileurl = videoInfoCache.get(bvid)?.pic;
				//redirect to the thumbnail url
				if (fileurl) {
					return new Response(null, {
						status: 302,
						headers: {
							Location: fileurl,
						},
					});
				} else {
					return new Response('Error', {
						status: 500,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
			}
			if (url.pathname.startsWith('/oembed')) {
				const bvid = path[2] || '';
				if (!isValidBVID(bvid)) {
					return new Response('Invalid BVID', {
						status: 400,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
				const video = new BilibiliVideo(
					`https://www.bilibili.com/video/${bvid}`,
					session,
				);
				const info = await video.getVideoInfo();
				return Response.json(
					{
						version: '1.0',
						type: 'video',
						provider_name: 'biliwarp',
						provider_url: currentURL,
						//title: info.title,
						author_name: info.owner.name,
						html: `<video src="${currentURL}/video_data/${bvid}" controls></video>`,
						width: 1920,
						height: 1080,
					},
					{
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}

			// fetch video info
			if (['video'].includes(path[1])) {
				try {
					const bvid = path[2];
					console.log(`Fetching video with BVID: ${bvid}`);
					const video = new BilibiliVideo(
						`https://www.bilibili.com/video/${bvid}`,
						session,
						cfTest,
					);
					const info = await video.getVideoInfo();
					await video.getVideoPlayInfo();
					videoInfoCache.set(bvid, info);

					let CFVideoLink = '';
					if (!cfTest) {
						(async () => {
							const [videoPath, videoSize] = await video.getBestDASHVideoFile(
								'./download',
							);
							if (videoPath) {
								cache.set(bvid, videoPath);
								fileSize.set(bvid, videoSize);
							} else {
								return new Response('Error', {
									status: 500,
									headers: {
										'Content-Type': 'text/plain',
									},
								});
							}
						})();
					} else {
						const [link] = await video.getBestDASHVideoFile('./download');
						CFVideoLink = link;
						console.log(link);
					}

					if (isBot) {
						discordVideoDownloadCounter.set(bvid, 0);
					}

					return new Response(
						(await Bun.file('./embed.html').text())
							.replaceAll(
								'@@video_url@@',
								cfTest ? CFVideoLink : `/video_data/${bvid}`,
							)
							.replaceAll('@@thumbnail_url@@', `/thumbnail/${bvid}`)
							.replaceAll(
								'@@video_player@@',
								`/player/${bvid}` /*`https://www.bilibili.com/blackboard/newplayer.html?bvid=${id}&danmaku=0&autoplay=1`*/,
							)
							.replaceAll('@@title@@', info.title)
							.replaceAll('@@description@@', info.desc)
							.replaceAll(
								'@@bilibili_link@@',
								`https://www.bilibili.com/video/${bvid}`,
							)
							.replaceAll('@@author@@', info.owner.name)
							.replaceAll('@@url@@', currentURL)
							.replaceAll('@@bvid@@', bvid) || '',
						{
							status: 200,
							headers: {
								'Content-Type': 'text/html',
								'Cache-Control': 'no-cache,max-age=0',
							},
						},
					);
				} catch (e) {
					console.error(e);
					return new Response('Error', {
						status: 500,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}
			}
			return new Response('Not Found', {
				status: 404,
				headers: {
					'Content-Type': 'text/plain',
				},
			});
		};
		const result = await process(request);
		result.headers.set('Access-Control-Allow-Origin', '*');
		result.headers.set('Cache-Control', 'no-cache, max-age=0');
		return result;
	},
});

type CacheData = {
	cache: [string, string][];
	fileSize: [string, number][];
	videoInfoCache: [string, BilibiliVideoInfo][];
};

async function exit() {
	console.log('Exiting...');
	let saveObject: CacheData = {
		cache: Array.from(cache.entries()),
		fileSize: Array.from(fileSize.entries()),
		videoInfoCache: Array.from(videoInfoCache.entries()),
	};
	await Bun.write('./cache.json', JSON.stringify(saveObject, null, 2));
	console.log('Cache saved.');
	cache.clear();
	fileSize.clear();
	videoInfoCache.clear();
	console.log('Cache cleared.');
	process.exit(0);
}

async function loadCache() {
	if (await exists('./cache.json')) {
		try {
			const cacheData = (await Bun.file('./cache.json').json()) as CacheData;
			cache = new Map(cacheData.cache);
			fileSize = new Map(cacheData.fileSize);
			videoInfoCache = new Map(cacheData.videoInfoCache);
			console.log('Cache loaded.');
			fileSize.forEach((size, bvid) => {
				if (size === 0) {
					console.log(`File size for ${bvid} is 0, removing from cache`);
					cache.delete(bvid);
					fileSize.delete(bvid);
					videoInfoCache.delete(bvid);
				}
			});
		} catch (e) {
			console.error('Error loading cache:', e);
			cache = new Map();
			fileSize = new Map();
			videoInfoCache = new Map();
			console.log('Cache cleared.');
		}
	}
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
	exit();
});
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled Rejection:', reason);
	exit();
});

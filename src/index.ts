import type { AudioQuality, BilibiliVideoInfo, VideoQuality } from './bilibili';
import { isValidBVID } from './bilibili';
import { BilibiliVideo } from './bilibili/classes';

let cache: Map<string, string> = new Map();
let fileSize: Map<string, number> = new Map();
let videoInfoCache: Map<string, BilibiliVideoInfo> = new Map();

const sessionData = await Bun.file('./cookies/bilibili.json').json();
const session = sessionData?.cookie.SESSDATA;

Bun.serve({
	port: 3000,
	idleTimeout: 100,
	async fetch(request) {
		const process = async (request: Request) => {
			const url = new URL(request.url);
			console.log(url.pathname);
			const path = url.pathname.split('/');
			if (path[1] === 'video_data') {
				const bvid = path[2];
				let filepath = cache.get(bvid);
				if (!filepath) {
					await Bun.sleep(4 * 1000);
					filepath = cache.get(bvid);
				}
				const range = request.headers.get('Range');
				if (range) {
					const [start, end] = range.replace(/bytes=/, '').split('-');
					const startByte = parseInt(start, 10);
					const endByte = end ? parseInt(end, 10) : fileSize.get(bvid) || 0;
					const chunkSize = endByte - startByte + 1;
					const fileStream = Bun.file(filepath || '').slice(
						startByte,
						endByte + 1,
					);
					return new Response(fileStream.stream(), {
						status: 206,
						headers: {
							'Content-Type': 'video/mp4',
							'Accept-Ranges': 'bytes',
							'Content-Range': `bytes ${startByte}-${endByte}/${fileSize.get(
								bvid,
							)}`,
							'Content-Length': chunkSize.toString(),
						},
					});
				}

				if (!filepath) {
					return new Response('Error', {
						status: 500,
						headers: {
							'Content-Type': 'text/plain',
						},
					});
				}

				return new Response(Bun.file(filepath).stream(), {
					status: 200,
					headers: {
						'Content-Type': 'video/mp4',
						'Accept-Ranges': 'bytes',
						'Cache-Control': 'no-cache, max-age=0',
					},
				});
			}
			if (path[1] === 'favicon.ico') {
				return new Response(null, {
					status: 404,
					headers: {
						'Content-Type': 'text/plain',
					},
				});
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

			if (!isValidBVID(path[1])) {
				return new Response('Invalid BVID', {
					status: 400,
					headers: {
						'Content-Type': 'text/plain',
					},
				});
			}
			// fetch video info
			try {
				const bvid = path[1];
				console.log(`Fetching video with BVID: ${bvid}`);
				const video = new BilibiliVideo(
					`https://www.bilibili.com/video/${bvid}`,
					session,
				);
				const info = await video.getVideoInfo();
				await video.getVideoPlayInfo();
				videoInfoCache.set(bvid, info);

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

				return new Response(
					(await Bun.file('./embed.html').text())
						.replaceAll('@@video_url@@', `/video_data/${bvid}`)
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
						.replaceAll('@@author@@', info.owner.name) || '',
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
		};
		const result = await process(request);
		result.headers.set('Access-Control-Allow-Origin', '*');
		result.headers.set('Cache-Control', 'no-cache, max-age=0');
		return result;
	},
});

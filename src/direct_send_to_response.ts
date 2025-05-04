import { isValidBVID } from './bilibili';
import { BilibiliVideo } from './bilibili/classes';

Bun.serve({
	port: 3000,
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname.split('/');
		console.log(path);
		const bvid = path[1];
		if (!isValidBVID(bvid)) {
			return new Response('Invalid BVID', {
				status: 400,
				headers: {
					'Content-Type': 'text/plain',
				},
			});
		}
		try {
			console.log(`Fetching video with BVID: ${bvid}`);
			// Check if the BVID is valid
			if (!bvid || bvid.length < 2) {
				return new Response('Invalid BVID', {
					status: 400,
					headers: {
						'Content-Type': 'text/plain',
					},
				});
			}
			const video = new BilibiliVideo(`https://www.bilibili.com/video/${bvid}`);
			await video.getVideoInfo();
			await video.getVideoPlayInfo('html5');
			const body = await video.getVideoStream();
			if (!body) {
				return new Response('Error', {
					status: 500,
					headers: {
						'Content-Type': 'text/plain',
					},
				});
			}
			const reader = body.getReader();
			const stream = new ReadableStream({
				start(controller) {
					this.cancel = () => {
						controller.error('Stream cancelled by consumer');
						reader.cancel().catch(() => {});
					};
				},
				pull(controller) {
					return reader
						.read()
						.then(({ value, done }) => {
							if (done) {
								controller.close();
							} else {
								controller.enqueue(value);
							}
						})
						.catch((err) => {
							controller.error(err);
						});
				},
				cancel(reason) {
					return reader.cancel(reason);
				},
			});
			return new Response(stream, {
				status: 200,
				headers: { 'Content-Type': 'video/mp4' },
			});
		} catch (e) {
			console.error(e);
			return new Response('Error', {
				status: 500,
				headers: {
					'Content-Type': 'text/plain',
				},
			});
		}
	},
});

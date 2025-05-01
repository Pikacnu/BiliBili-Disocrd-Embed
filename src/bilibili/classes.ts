import { mkdir, exists } from 'fs/promises';
import {
	VideoQuality,
	type BilibiliVideoInfo,
	type VideoPlayInfo,
	VideoQualityText,
	AudioQualityText,
	AudioQuality,
	type DashVideoItem,
	type DashAudioItem,
} from './';
import { $ } from 'bun';
import { writeFile } from 'fs/promises';

const API_URL = 'https://api.bilibili.com';
const ProxyLink = process.env.PROXY_LINK!;

const SliceSize = 1024 * 1024 * 10;

const headers = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
	'Accept-Language': 'zh-CN,zh;q=0.9',
	'Accept-Encoding': 'gzip, deflate, br',
	Connection: 'keep-alive',
	Referer: 'https://www.bilibili.com/',
	Origin: 'https://www.bilibili.com',
};

export class BilibiliVideo {
	private bvid: string;
	private videoInfo: BilibiliVideoInfo | null = null;
	private videoPlayInfo: VideoPlayInfo | null = null;
	private headers: HeadersInit = headers;

	constructor(url: string, session?: string) {
		this.bvid = this.getBVIDFromURL(url);
		if (session && session.length > 0) {
			this.headers = new Headers({
				...this.headers,
				Cookie: `SESSDATA=${session};`,
			});
		}
	}

	getBVIDFromURL(url: string): string {
		const regex = /\/(video|bangumi)\/([^/?#]+)/;
		const match = url.match(regex);
		if (match) {
			return match[2];
		} else {
			throw new Error('Invalid URL format');
		}
	}

	async getVideoInfo(): Promise<BilibiliVideoInfo> {
		const url = `${API_URL}/x/web-interface/view?bvid=${this.bvid}`;
		const data = await this.fetch(url);
		this.videoInfo = data;
		return data;
	}

	async fetch(
		url: string | URL | globalThis.Request,
		requestInit?: RequestInit,
	): Promise<any> {
		const response = await fetch(url, requestInit);
		if (!response.ok) {
			throw new Error(`Error fetching data: ${response.statusText}`);
		}
		const data = await response.json();
		const code = Math.abs(data.code || 0); // Default to 0 if code is not present
		switch (true) {
			case [0, 200].includes(data.code):
				return data.data;
			case code === 400:
				throw new Error(`Bad Request: ${data.message}`);
			case code === 404:
				throw new Error(`Not Found: ${data.message}`);
			case [352, 412].includes(code):
				throw new Error(`Be Rick Control: ${data.message}`);
			case [10403, 688, 6002003].includes(code):
				throw new Error(`Area Limit: ${data.message}`);
			default:
				console.error(data);
				throw new Error(`Unexpected error: ${data.message}`);
		}
	}

	async getVideoPlayInfo(): Promise<VideoPlayInfo> {
		const data = await this.fetch(
			`${API_URL}/x/player/wbi/playurl?bvid=${this.bvid}&cid=${this.videoInfo?.cid}&fnver=0&fnval=4048&fourk=1`,
			{
				headers: this.headers,
			},
		);
		this.videoPlayInfo = data;
		return data;
	}

	getVideoQuality(): VideoQuality[] {
		if (!this.videoPlayInfo) {
			throw new Error(
				'Video play info not fetched. Call getVideoPlayInfo() first.',
			);
		}
		return this.videoPlayInfo.accept_quality;
	}

	async getVideoStream() {
		if (!this.videoPlayInfo) {
			throw new Error(
				'Video play info not fetched. Call getVideoPlayInfo() first.',
			);
		}
		const videoStream = await fetch(this.videoPlayInfo.durl[0].url, {
			headers: this.headers,
		});
		if (!videoStream.ok) {
			throw new Error(`Error fetching video stream: ${videoStream.statusText}`);
		}
		const reader = videoStream.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get reader from video stream');
		}
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				function push() {
					reader?.read().then(({ done, value }) => {
						if (done) {
							controller.close();
							return;
						}
						controller.enqueue(value);
						push();
					});
				}
				push();
			},
			cancel() {
				reader?.cancel();
			},
		});
		return stream;
	}

	async getVideoResponse() {
		if (!this.videoPlayInfo) {
			throw new Error(
				'Video play info not fetched. Call getVideoPlayInfo() first.',
			);
		}
		return fetch(this.videoPlayInfo.durl[0].url, {
			headers: this.headers,
		});
	}
	/*
	async getVideoArrayBuffer() {
		const videoStream = await this.getVideoStream();
		if (!videoStream) {
			throw new Error('Video stream is null or undefined');
		}
		const reader = videoStream.getReader();
		const arrayBuffer = await createUint8ArrayFromReader(reader);
		return arrayBuffer;
	}*/
	async getBestDASHVideoFile(path = './video'): Promise<[string, number]> {
		if (!this.videoPlayInfo) {
			throw new Error(
				'Video play info not fetched. Call getVideoPlayInfo() first.',
			);
		}
		console.time('Preparing video...');
		if (await exists(`${path}/${this.bvid}/${this.bvid}.mp4`)) {
			return [
				`${path}/${this.bvid}/${this.bvid}.mp4`,
				Bun.file(`${path}/${this.bvid}/${this.bvid}.mp4`).size,
			];
		}

		await mkdir(path + `/${this.bvid}`, { recursive: true });
		path = path + `/${this.bvid}`;

		const dash = this.videoPlayInfo.dash;
		if (!dash) {
			throw new Error('DASH data not available');
		}
		const bestVideo = findBestQuality(dash.video);
		const bestAudio = findBestQuality(dash.audio);
		console.log(
			`Video Quality: ${VideoQualityText[bestVideo.id as VideoQuality]}`,
		);
		console.log(
			`Audio Quality: ${AudioQualityText[bestAudio.id as AudioQuality]}`,
		);

		const [videos, videoSliceCount] = await sourceProcessing.call(
			this,
			bestVideo,
			path,
			'video',
		);

		const [audios, audioSliceCount] = await sourceProcessing.call(
			this,
			bestAudio,
			path,
			'audio',
		);
		console.timeEnd('Preparing video...');
		console.time('Downloading slices...');
		await Promise.allSettled([...videos, ...audios]);
		console.timeEnd('Downloading slices...');
		console.log('All slices downloaded.');

		console.log('Merging video and audio...');
		try {
			await Promise.allSettled([
				new Promise<void>(async (r) => {
					for (const index of Array(videoSliceCount).keys()) {
						await writeFile(
							`${path}/video.mp4`,
							new Uint8Array(
								await Bun.file(
									`${path}/${this.bvid}_video_${index}.m4s`,
								).arrayBuffer(),
							),
							{
								flag: 'a',
							},
						);
					}
					r();
				}),
				new Promise<void>(async (r) => {
					for (const index of Array(audioSliceCount).keys()) {
						await writeFile(
							`${path}/audio.mp4`,
							new Uint8Array(
								await Bun.file(
									`${path}/${this.bvid}_audio_${index}.m4s`,
								).arrayBuffer(),
							),
							{
								flag: 'a',
							},
						);
					}
					r();
				}),
			]);

			await $`ffmpeg -i ${path}/video.mp4 -i ${path}/audio.mp4 -c copy ${path}/${this.bvid}.mp4`.quiet();
			return [
				`${path}/${this.bvid}.mp4`,
				Bun.file(`${path}/${this.bvid}.mp4`).size,
			];
		} catch (error) {
			console.error('Error merging video and audio:', error);
			return [`${path}/${this.bvid}.mp4`, 0];
		}
	}
	getBVID() {
		return this.bvid;
	}
}

async function getDashPart(
	videoData: DashVideoItem | DashAudioItem,
	data: {
		path: string;
		start: number;
		end: number;
		index: number;
	},
): Promise<ArrayBuffer> {
	const urlList: string[] = [videoData.base_url, ...videoData.backup_url];
	let retryCount = 3;
	let url = urlList.shift()!;
	while (true) {
		try {
			const response = await fetch(ProxyLink, {
				headers: {
					...headers,
					Range: `bytes=${data.start}-${data.end}`,
					'x-url': url,
				},
			});
			if (!response.ok) {
				throw new Error(
					`Error downloading slice ${data.index + 1}: ${response.status}`,
				);
			}
			const buffer = await response.arrayBuffer();
			Bun.write(data.path, buffer);
			return buffer;
		} catch (error) {
			if (urlList.length > 0) {
				url = urlList.shift()!;
			} else {
				retryCount--;
				if (retryCount > 0) {
					urlList.push(...[videoData.base_url, ...videoData.backup_url]);
					url = urlList.shift()!;
					continue;
				}
				throw new Error(`All URLs failed: ${error}`);
			}
		}
	}
}

function findBestQuality(
	qualityArray: DashAudioItem[] | DashVideoItem[],
): DashAudioItem | DashVideoItem {
	const sortedArray = qualityArray.sort((a, b) => Number(a.id) - Number(b.id));
	return sortedArray[sortedArray.length - 1];
}

async function sourceProcessing(
	this: BilibiliVideo,
	item: DashAudioItem | DashVideoItem,
	path: string,
	type: string,
) {
	const sourceResponse = await fetch(item.base_url, {
		headers: headers,
	});

	const sourceLength =
		Number(sourceResponse.headers.get('Content-Length')) || 0;
	const sliceCount = Math.ceil(sourceLength / SliceSize);

	const slices: Promise<ArrayBuffer | void>[] = Array(sliceCount)
		.fill(0)
		.map(async (_, index) => {
			const start = index * SliceSize;
			const end = Math.min(start + SliceSize - 1, sourceLength - 1);
			const currentFilePath = `${path}/${this.getBVID()}_${type}_${index}.m4s`;

			if ((await exists(currentFilePath)) && Bun.file(currentFilePath).size > 0)
				return;

			try {
				await getDashPart(item, {
					path: currentFilePath,
					start: start,
					end: end,
					index: index,
				});
			} catch (error) {
				console.error(
					`Video Slice ${index + 1}/${sliceCount} Download Failed:\n`,
					error,
				);
				throw error;
			}
		});

	await Bun.write(
		`${path}/video_list.txt`,
		Array(sliceCount)
			.fill(0)
			.map((_, index) => `file '${this.getBVID()}_video_${index}.m4s'`)
			.join('\n'),
	);
	return [slices, sliceCount] as const;
}

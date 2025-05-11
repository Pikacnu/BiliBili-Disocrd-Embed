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
	BilibiliVideoIdType,
	isValidBVID,
	isValidAVID,
	getVideoInfo,
	type VideoDownloadURL,
	BilibiliPlatform,
} from './';
import { $ } from 'bun';
import { writeFile } from 'fs/promises';

const API_URL = 'https://api.bilibili.com';
const ProxyLink = process.env.PROXYLINK!;
const ProxyApiKey = process.env.PROXY_APIKEY!;

const SliceSize = 1024 * 1024 * 8;

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
	private idType: BilibiliVideoIdType = BilibiliVideoIdType.bvid;
	private videoInfo: BilibiliVideoInfo | null = null;
	private videoPlayInfo: VideoPlayInfo | null = null;
	private headers: HeadersInit = headers;
	private cfTest: boolean = false;

	constructor(url: string, session?: string, cfTest = false) {
		this.bvid = this.getIDFromURL(url);
		this.idType = BilibiliVideo.getIdType(this.bvid);
		if (session && session.length > 0) {
			this.headers = new Headers({
				...this.headers,
				Cookie: `SESSDATA=${session};`,
			});
		}
		this.cfTest = cfTest;
	}

	static getIdType(id: string) {
		if (isValidBVID(id)) return BilibiliVideoIdType.bvid;
		if (isValidAVID(id)) return BilibiliVideoIdType.avid;
		if (id.startsWith('ss')) return BilibiliVideoIdType.season;
		if (id.startsWith('ep')) return BilibiliVideoIdType.episode;
		return BilibiliVideoIdType.unknown;
	}

	getIDFromURL(url: string): string {
		const regex = /\/(video|bangumi)\/([^/?#]+)/;
		const match = url.match(regex);
		if (match) {
			return match[2];
		} else {
			throw new Error('Invalid URL format');
		}
	}

	async getVideoInfo(): Promise<BilibiliVideoInfo> {
		const url =
			this.idType === BilibiliVideoIdType.bvid
				? `${API_URL}/x/web-interface/view?bvid=${this.bvid}`
				: `${API_URL}/x/web-interface/view?aid=${this.bvid}`;
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
				throw new Error(`Bad Request: ${data.message} ${url}`);
			case code === 404:
				throw new Error(`Not Found: ${data.message} ${url}`);
			case [352, 412].includes(code):
				throw new Error(`Be Rick Control: ${data.message} ${url}`);
			case [10403, 688, 6002003].includes(code):
				throw new Error(`Area Limit: ${data.message} ${url}`);
			default:
				console.error(data);
				throw new Error(`Unexpected error: ${data.message}`);
		}
	}

	async getVideoPlayInfo(
		platform = BilibiliPlatform.dash,
	): Promise<VideoPlayInfo> {
		let url;
		if (platform === BilibiliPlatform.dash) {
			url = `${API_URL}/x/player/wbi/playurl?bvid=${this.bvid}&cid=${this.videoInfo?.cid}&fnver=0&fnval=4048&fourk=1`;
		} else {
			url = `${API_URL}/x/player/wbi/playurl?bvid=${this.bvid}&cid=${
				this.videoInfo?.cid
			}&platfrom=html5&qn=${VideoQuality._720P}&high_quality=${
				this.cfTest ? 1 : 0
			}`;
		}
		const data = await this.fetch(url, {
			headers: this.headers,
		});
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
		try {
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					function push() {
						reader?.read().then(({ done, value }) => {
							if (done) {
								try {
									controller.close();
								} catch (e) {}
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
		} catch (error) {
			console.error('Error creating stream:', error);
			throw new Error('Failed to create stream from video response');
		}
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

		if (
			(await exists(`${path}/${this.bvid}/${this.bvid}.mp4`)) &&
			!this.cfTest
		) {
			console.log('Video file already exists. Skipping download.');
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
		const bestVideo = findBestQuality(
			dash.video.filter((item) => item.codecs.includes('avc')),
		);
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
		console.time('Downloaded slices');
		await Promise.allSettled([...videos, ...audios]);
		console.timeEnd('Downloaded slices');

		console.log('Merging video and audio...');
		try {
			const mergeArray = [];

			if (
				!(await exists(`${path}/video.m4s`)) ||
				Bun.file(`${path}/video.m4s`).size === 0
			) {
				mergeArray.push(
					new Promise<void>(async (r) => {
						for (const index of Array(videoSliceCount).keys()) {
							await writeFile(
								`${path}/video.m4s`,
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
				);
			}
			if (
				!(await exists(`${path}/audio.m4s`)) ||
				Bun.file(`${path}/audio.m4s`).size === 0
			) {
				mergeArray.push(
					new Promise<void>(async (r) => {
						for (const index of Array(audioSliceCount).keys()) {
							await writeFile(
								`${path}/audio.m4s`,
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
				);
			}

			await Promise.allSettled(mergeArray);

			if (
				!(await exists(`${path}/video.m4s`)) ||
				!(await exists(`${path}/audio.m4s`))
			) {
				throw new Error('Video or audio file is missing or corrupted.');
			}

			try {
				await $`ffmpeg -y -i ${path}/video.m4s -i ${path}/audio.m4s -c:v copy -c:a copy ${path}/${this.bvid}.mp4`.quiet();
			} catch (error) {
				console.error('Error merging video and audio:', error);
			}

			return [
				`${path}/${this.bvid}.mp4`,
				Bun.file(`${path}/${this.bvid}.mp4`).size,
			];
		} catch (error) {
			console.error('Error merging video and audio:', error);
			return [`${path}/${this.bvid}.mp4`, 0];
		}
	}

	async getBestDurlFile(path = './video'): Promise<[string, number]> {
		if (!this.videoPlayInfo) {
			throw new Error(
				'Video play info not fetched. Call getVideoPlayInfo() first.',
			);
		}
		console.time('Preparing video...');

		if (
			(await exists(`${path}/${this.bvid}/${this.bvid}.mp4`)) &&
			!this.cfTest
		) {
			console.log('Video file already exists. Skipping download.');
			return [
				`${path}/${this.bvid}/${this.bvid}.mp4`,
				Bun.file(`${path}/${this.bvid}/${this.bvid}.mp4`).size,
			];
		}

		await mkdir(path + `/${this.bvid}`, { recursive: true });
		path = path + `/${this.bvid}`;
		const durl = this.videoPlayInfo.durl;
		if (!durl) {
			throw new Error('DURL data not available');
		}
		const bestVideo = durl[0];
		const [video, videoSliceCount] = await sourceProcessing.call(
			this,
			bestVideo,
			path,
			'video',
			BilibiliPlatform.html5,
		);
		console.timeEnd('Preparing video...');
		console.time('Downloaded slices');
		await Promise.allSettled(video);
		console.timeEnd('Downloaded slices');
		console.log('Merging video...');
		try {
			const mergeArray = [];

			if (
				!(await exists(`${path}/video.mp4`)) ||
				Bun.file(`${path}/video.mp4`).size === 0
			) {
				mergeArray.push(
					new Promise<void>(async (r) => {
						for (const index of Array(videoSliceCount).keys()) {
							await writeFile(
								`${path}/video.mp4`,
								new Uint8Array(
									await Bun.file(
										`${path}/${this.bvid}_video_${index}.mp4`,
									).arrayBuffer(),
								),
								{
									flag: 'a',
								},
							);
						}
						r();
					}),
				);
			}

			await Promise.allSettled(mergeArray);

			if (!(await exists(`${path}/video.mp4`))) {
				throw new Error('Video file is missing or corrupted.');
			}

			return [
				`${path}/${this.bvid}.mp4`,
				Bun.file(`${path}/${this.bvid}.mp4`).size,
			];
		} catch (error) {
			console.error('Error merging video:', error);
			return [`${path}/${this.bvid}.mp4`, 0];
		}
	}

	getBVID() {
		return this.bvid;
	}

	async useCloudflareWorker() {
		if (!this.cfTest) throw new Error('Cloudflare test is not enabled.');

		const VideoPlayInfo = await this.getVideoPlayInfo(BilibiliPlatform.html5);
		const urlDatas = VideoPlayInfo.durl[0];
		const resp = await fetch(ProxyLink, {
			headers: {
				'x-api-key': ProxyApiKey,
				'x-video-links': [urlDatas.url, ...urlDatas.backup_url].join('|'),
				'x-bvid': this.bvid,
			},
		});
		console.log('Proxy response:', resp.status, await resp.text());
		return `${ProxyLink}video_data/${this.bvid}`;
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
					'x-api-key': ProxyApiKey,
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

async function getDurlPart(
	videoData: VideoDownloadURL,
	data: {
		path: string;
		start: number;
		end: number;
		index: number;
	},
): Promise<ArrayBuffer> {
	const urlList: string[] = [videoData.url, ...videoData.backup_url];
	let retryCount = 3;
	let url = urlList.shift()!;
	while (true) {
		try {
			const response = await fetch(ProxyLink, {
				headers: {
					...headers,
					Range: `bytes=${data.start}-${data.end}`,
					'x-url': url,
					'x-api-key': ProxyApiKey,
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
					urlList.push(...[videoData.url, ...videoData.backup_url]);
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

const sourceTypeWithGetPartFunctions: Record<
	BilibiliPlatform,
	typeof getDashPart | typeof getDurlPart
> = {
	[BilibiliPlatform.dash]: getDashPart,
	[BilibiliPlatform.html5]: getDurlPart,
};

async function sourceProcessing(
	this: BilibiliVideo,
	item: DashAudioItem | DashVideoItem | VideoDownloadURL,
	path: string,
	type: string,
	sourceType: BilibiliPlatform = BilibiliPlatform.dash,
) {
	let sourceLength, sourceResponse;
	switch (sourceType) {
		case BilibiliPlatform.dash:
			item = item as DashVideoItem | DashAudioItem;
			sourceResponse = await fetch(item.base_url, {
				headers: headers,
			});

			sourceLength = Number(sourceResponse.headers.get('Content-Length')) || 0;
			break;
		case BilibiliPlatform.html5:
			item = item as VideoDownloadURL;
			sourceResponse = await fetch(item.url, {
				headers: headers,
			});
			sourceLength = Number(sourceResponse.headers.get('Content-Length')) || 0;
			break;
	}
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
				//@ts-ignore
				await sourceTypeWithGetPartFunctions[sourceType](item, {
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

import type { BilibiliVideoInfo } from './type';

export async function getVideoInfo(bvid: string): Promise<BilibiliVideoInfo> {
	const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Error fetching video info: ${response.statusText}`);
	}
	const data = await response.json();
	if (data.code !== 0) {
		throw new Error(`Error fetching video info: ${data.message}`);
	}
	return data.data as BilibiliVideoInfo;
}

export function getBVIDFromURL(url: string): string {
	const regex = /\/(video|bangumi)\/([^/?#]+)/;
	const match = url.match(regex);
	if (match) {
		return match[2];
	} else {
		throw new Error('Invalid URL format');
	}
}

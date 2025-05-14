import { BilibiliPlatform } from './bilibili';

export const currentURL = process.env.CURRENTURL || 'https://your-domain.com'; // Set your current URL here

export const cfTest = false; // Set to true to use Cloudflare test mode

export const platformType: BilibiliPlatform =
	(process.env.PLATFORM as BilibiliPlatform)! || BilibiliPlatform.html5; // Set the platform type here
// Set the platform type here
const useSession = true; // Set to true to use session storage for cookies
export const API_URL = 'https://api.bilibili.com'; // Set the API URL here
export const ProxyLink = process.env.PROXYLINK!; // Set the proxy link here
export const ProxyApiKey = process.env.PROXY_APIKEY!; // Set the proxy API key here
export const useProxy =
	(ProxyLink !== undefined && ProxyLink.length > 0) ||
	(process.env.USE_PROXY !== undefined && process.env.USE_PROXY === 'true'); // Set to true to use proxy
export const SliceSize = 1024 * 1024 * 8; // Set the slice size here

const sessionData = await Bun.file('./cookies/bilibili.json').json();
export const session = useSession ? sessionData?.cookie.SESSDATA : null;

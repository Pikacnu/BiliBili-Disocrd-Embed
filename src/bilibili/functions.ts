import type { BilibiliResponse } from '../cookie';
import type { CookieInfoResponse, RefreshCookieResponse } from './type';

export function createUint8ArrayFromReader(
	reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];

		function read() {
			reader
				.read()
				.then((result) => {
					if (result.done) {
						const totalLength = chunks.reduce(
							(acc, chunk) => acc + chunk.length,
							0,
						);
						const videoBuffer = new Uint8Array(totalLength);
						let offset = 0;
						for (const chunk of chunks) {
							videoBuffer.set(chunk, offset);
							offset += chunk.length;
						}
						resolve(videoBuffer);
					} else {
						chunks.push(result.value);
						read();
					}
				})
				.catch(reject);
		}

		read();
	});
}

export function isValidBVID(bvid: string): boolean {
	// BVID 格式: BV 開頭，後面跟著 10 個字元（字母和數字）
	const bvidRegex = /^BV[a-zA-Z0-9]{10}$/;
	return bvidRegex.test(bvid);
}

const publicKey = await crypto.subtle.importKey(
	'jwk',
	{
		kty: 'RSA',
		n: 'y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE',
		e: 'AQAB',
	},
	{ name: 'RSA-OAEP', hash: 'SHA-256' },
	true,
	['encrypt'],
);

export async function getCorrespondPath(timestamp: number) {
	const data = new TextEncoder().encode(`refresh_${timestamp}`);
	const encrypted = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data),
	);
	return encrypted.reduce(
		(str, c) => str + c.toString(16).padStart(2, '0'),
		'',
	);
}

const headers = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
	'Accept-Language': 'zh-CN,zh;q=0.9',
	'Accept-Encoding': 'gzip, deflate, br',
	Connection: 'keep-alive',
	Referer: 'https://www.bilibili.com/',
	Origin: 'https://www.bilibili.com',
};

export async function getRefreshCSRF(corsspath: string, session: string) {
	const response = await fetch(
		`https://www.bilibili.com/correspond/1/${corsspath}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `SESSDATA=${session}`,
				...headers,
			},
		},
	);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch refresh CSRF: ${response.status} ${response.statusText}`,
		);
	}
	const text = await response.text();
	//get csrf token which match /\<div id=\"1-name\">(.*)<\/div>/gm
	const csrf = /<div id="1-name">(.*)<\/div>/.exec(text)?.[1];
	if (!csrf) {
		throw new Error('Failed to get CSRF token from response');
	}
	return csrf;
}

export async function checkIsCookieExpired(session: string) {
	const response = await fetch(
		`https://passport.bilibili.com/x/passport-login/web/cookie/info?csrf=${getRefreshCSRF(
			await getCorrespondPath(Date.now()),
			session,
		)}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `SESSDATA=${session}`,
			},
		},
	);
	const data = (await response.json()) as BilibiliResponse<CookieInfoResponse>;
	if (data.code === -101) {
		throw new Error('Cookie expired, please re-login.');
	}
	return data.data.refresh;
}

export async function refreshCookie(
	session: string,
	csrf: string,
	refreshToken: string,
) {
	const response = await fetch(
		`https://passport.bilibili.com/x/passport-login/web/cookie/refresh?csrf=${csrf}&refresh_csrf=${await getRefreshCSRF(
			await getCorrespondPath(Date.now()),
			session,
		)}&source=main_web&refresh_token=${refreshToken}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `SESSDATA=${session}`,
			},
		},
	);
	if (!response.ok) {
		throw new Error(
			`Failed to refresh cookie: ${response.status} ${response.statusText}`,
		);
	}
	const data =
		(await response.json()) as BilibiliResponse<RefreshCookieResponse>;
	if (data.code !== 0) {
		throw new Error(`Failed to refresh cookie: ${data.message}`);
	}
	const refresh_token = data.data.refresh_token;
	const cookieString = response.headers.get('set-cookie') || '';
	const cookies = cookieString
		.split(',')
		.filter((s) => s.includes('='))
		.map((s) => s.split(';')[0].trim().split('='));
	const cookie = Object.fromEntries(cookies);
	Bun.write(
		`./cookies/bilibili.json`,
		JSON.stringify({
			cookie: cookie,
			refresh_token,
			timestamp: Date.now(),
		}),
	);
	await fetch(
		`https://passport.bilibili.com/x/passport-login/web/confirm/refresh?csrf=${
			cookie.bili_jct || ''
		}&refresh_token=${refreshToken}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `SESSDATA=${session}`,
			},
		},
	);
	return true;
}

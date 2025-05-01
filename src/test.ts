import { checkIsCookieExpired, refreshCookie } from './bilibili';

const sessionData = await Bun.file('./cookies/bilibili.json').json();
const result = await refreshCookie(
	sessionData.cookie.SESSDATA,
	sessionData.cookie.bili_jct,
	sessionData.refresh_token,
);

console.log(result);

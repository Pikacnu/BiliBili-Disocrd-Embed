const response = await fetch('https://cf-proxy.pikacnu.workers.dev/', {
	method: 'GET',
	headers: {
		'x-api-key': 'yvftgbuhjnikmolp',
		'x-url': 'https://api.bilibili.com/x/web-interface/view?bvid=BV1FC4y1e7jm',
	},
});
console.log(response.status);

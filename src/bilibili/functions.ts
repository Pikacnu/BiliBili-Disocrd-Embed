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
